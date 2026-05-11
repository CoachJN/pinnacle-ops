import "server-only";

import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { toFirestoreTimestamp, toIsoDateTime } from "@/server/repositories";
import {
  buildRuntimeLoopId,
  type RuntimeLoop,
  type RuntimeLoopType,
} from "../domain/runtime-loop";
import {
  createDefaultRuntimeLoopState,
  type RuntimeLoopState,
} from "../domain/runtime-loop-state";
import type { RuntimeLoopEvent } from "../domain/runtime-loop-heartbeat";
import type { RuntimeLoopResult } from "../domain/runtime-loop-result";

const RUNTIME_LOOP_COLLECTIONS = {
  loops: "runtimeLoops",
  state: "runtimeLoopStates",
  events: "runtimeLoopEvents",
  results: "runtimeLoopResults",
} as const;

type RuntimeLoopDocument = Omit<
  RuntimeLoop,
  | "leaseExpiresAt"
  | "heartbeatAt"
  | "lastRunStartedAt"
  | "lastRunCompletedAt"
  | "createdAt"
  | "updatedAt"
> & {
  leaseExpiresAt: FirebaseFirestore.Timestamp | null;
  heartbeatAt: FirebaseFirestore.Timestamp | null;
  lastRunStartedAt: FirebaseFirestore.Timestamp | null;
  lastRunCompletedAt: FirebaseFirestore.Timestamp | null;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
};

type RuntimeLoopStateDocument = Omit<
  RuntimeLoopState,
  | "pauseRequestedAt"
  | "pauseReleasedAt"
  | "drainRequestedAt"
  | "drainReleasedAt"
  | "drainDeadlineAt"
  | "updatedAt"
> & {
  pauseRequestedAt: FirebaseFirestore.Timestamp | null;
  pauseReleasedAt: FirebaseFirestore.Timestamp | null;
  drainRequestedAt: FirebaseFirestore.Timestamp | null;
  drainReleasedAt: FirebaseFirestore.Timestamp | null;
  drainDeadlineAt: FirebaseFirestore.Timestamp | null;
  updatedAt: FirebaseFirestore.Timestamp;
};

type RuntimeLoopEventDocument = Omit<RuntimeLoopEvent, "detectedAt"> & {
  detectedAt: FirebaseFirestore.Timestamp;
};

type RuntimeLoopResultDocument = Omit<
  RuntimeLoopResult,
  "runStartedAt" | "runCompletedAt" | "createdAt" | "updatedAt"
> & {
  runStartedAt: FirebaseFirestore.Timestamp;
  runCompletedAt: FirebaseFirestore.Timestamp;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
};

export interface RuntimeLoopRepository {
  newResultId(): string;
  newEventId(): string;
  getLoop(input: {
    organizationId: string;
    loopType: RuntimeLoopType;
  }): Promise<RuntimeLoop | null>;
  listLoops(input: { organizationId: string }): Promise<readonly RuntimeLoop[]>;
  saveLoop(loop: RuntimeLoop): Promise<RuntimeLoop>;
  claimLoop(input: {
    organizationId: string;
    loopType: RuntimeLoopType;
    leaseOwner: string;
    now: string;
    leaseDurationMs: number;
    createDefault: () => RuntimeLoop;
  }): Promise<{
    acquired: boolean;
    recovered: boolean;
    previousLeaseOwner: string | null;
    loop: RuntimeLoop;
  }>;
}

export interface RuntimeLoopStateRepository {
  getState(input: {
    organizationId: string;
    now: string;
  }): Promise<RuntimeLoopState>;
  saveState(state: RuntimeLoopState): Promise<RuntimeLoopState>;
}

export interface RuntimeLoopEventRepository {
  saveEvent(event: RuntimeLoopEvent): Promise<RuntimeLoopEvent>;
  listRecentEvents(input: {
    organizationId: string;
    limit?: number;
  }): Promise<readonly RuntimeLoopEvent[]>;
}

export interface RuntimeLoopResultRepository {
  saveResult(result: RuntimeLoopResult): Promise<RuntimeLoopResult>;
  listRecentResults(input: {
    organizationId: string;
    loopType?: RuntimeLoopType;
    limit?: number;
  }): Promise<readonly RuntimeLoopResult[]>;
}

export function createInMemoryRuntimeLoopRepositories(seed?: {
  loops?: RuntimeLoop[];
  states?: RuntimeLoopState[];
  events?: RuntimeLoopEvent[];
  results?: RuntimeLoopResult[];
}): {
  loops: RuntimeLoopRepository;
  state: RuntimeLoopStateRepository;
  events: RuntimeLoopEventRepository;
  results: RuntimeLoopResultRepository;
} {
  const loops = [...(seed?.loops ?? [])];
  const states = [...(seed?.states ?? [])];
  const events = [...(seed?.events ?? [])];
  const results = [...(seed?.results ?? [])];

  return {
    loops: {
      newResultId() {
        return `runtime-loop-result-${results.length + 1}`;
      },
      newEventId() {
        return `runtime-loop-event-${events.length + 1}`;
      },
      async getLoop(input) {
        return (
          loops.find(
            (item) =>
              item.organizationId === input.organizationId &&
              item.loopType === input.loopType,
          ) ?? null
        );
      },
      async listLoops(input) {
        return loops
          .filter((item) => item.organizationId === input.organizationId)
          .sort((left, right) => left.loopType.localeCompare(right.loopType));
      },
      async saveLoop(loop) {
        upsertById(loops, loop);
        return loop;
      },
      async claimLoop(input) {
        const existing = await this.getLoop(input);
        const current = existing ?? input.createDefault();
        const activeLease =
          current.leaseOwner &&
          current.leaseExpiresAt &&
          current.leaseExpiresAt > input.now &&
          current.leaseOwner !== input.leaseOwner;
        if (activeLease) {
          return {
            acquired: false,
            recovered: false,
            previousLeaseOwner: current.leaseOwner,
            loop: current,
          };
        }
        const recovered = Boolean(
          current.leaseOwner &&
            current.leaseOwner !== input.leaseOwner &&
            current.leaseExpiresAt &&
            current.leaseExpiresAt <= input.now,
        );
        const next: RuntimeLoop = {
          ...current,
          leaseOwner: input.leaseOwner,
          leaseExpiresAt: new Date(
            Date.parse(input.now) + input.leaseDurationMs,
          ).toISOString(),
          heartbeatAt: input.now,
          updatedAt: input.now,
        };
        await this.saveLoop(next);
        return {
          acquired: true,
          recovered,
          previousLeaseOwner: recovered ? current.leaseOwner : null,
          loop: next,
        };
      },
    },
    state: {
      async getState(input) {
        return (
          states.find((item) => item.organizationId === input.organizationId) ??
          createDefaultRuntimeLoopState(input)
        );
      },
      async saveState(state) {
        upsertByKey(states, state, (item) => item.organizationId);
        return state;
      },
    },
    events: {
      async saveEvent(event) {
        upsertById(events, event);
        return event;
      },
      async listRecentEvents(input) {
        return events
          .filter((item) => item.organizationId === input.organizationId)
          .sort((left, right) => right.detectedAt.localeCompare(left.detectedAt))
          .slice(0, input.limit ?? events.length);
      },
    },
    results: {
      async saveResult(result) {
        upsertById(results, result);
        return result;
      },
      async listRecentResults(input) {
        return results
          .filter((item) => item.organizationId === input.organizationId)
          .filter((item) =>
            input.loopType ? item.loopType === input.loopType : true,
          )
          .sort((left, right) => right.runStartedAt.localeCompare(left.runStartedAt))
          .slice(0, input.limit ?? results.length);
      },
    },
  };
}

export function createFirestoreRuntimeLoopRepositories(
  firestore: Firestore = getFirebaseAdminFirestore(),
): {
  loops: RuntimeLoopRepository;
  state: RuntimeLoopStateRepository;
  events: RuntimeLoopEventRepository;
  results: RuntimeLoopResultRepository;
} {
  const loopCollection = firestore.collection(RUNTIME_LOOP_COLLECTIONS.loops);
  const stateCollection = firestore.collection(RUNTIME_LOOP_COLLECTIONS.state);
  const eventCollection = firestore.collection(RUNTIME_LOOP_COLLECTIONS.events);
  const resultCollection = firestore.collection(RUNTIME_LOOP_COLLECTIONS.results);

  return {
    loops: {
      newResultId() {
        return resultCollection.doc().id;
      },
      newEventId() {
        return eventCollection.doc().id;
      },
      async getLoop(input) {
        const snapshot = await loopCollection
          .doc(buildRuntimeLoopId(input))
          .get();
        return snapshot.exists
          ? runtimeLoopFromDocument(
              snapshot.id,
              snapshot.data() as RuntimeLoopDocument,
            )
          : null;
      },
      async listLoops(input) {
        const snapshot = await loopCollection
          .where("organizationId", "==", input.organizationId)
          .orderBy("loopType", "asc")
          .get();
        return snapshot.docs.map((doc) =>
          runtimeLoopFromDocument(doc.id, doc.data() as RuntimeLoopDocument),
        );
      },
      async saveLoop(loop) {
        await loopCollection
          .doc(loop.id)
          .set(runtimeLoopToDocument(loop) as DocumentData, { merge: true });
        return loop;
      },
      async claimLoop(input) {
        const loopId = buildRuntimeLoopId(input);
        return firestore.runTransaction(async (transaction) => {
          const ref = loopCollection.doc(loopId);
          const snapshot = await transaction.get(ref);
          const current = snapshot.exists
            ? runtimeLoopFromDocument(loopId, snapshot.data() as RuntimeLoopDocument)
            : input.createDefault();
          const activeLease =
            current.leaseOwner &&
            current.leaseExpiresAt &&
            current.leaseExpiresAt > input.now &&
            current.leaseOwner !== input.leaseOwner;
          if (activeLease) {
            return {
              acquired: false,
              recovered: false,
              previousLeaseOwner: current.leaseOwner,
              loop: current,
            };
          }
          const recovered = Boolean(
            current.leaseOwner &&
              current.leaseOwner !== input.leaseOwner &&
              current.leaseExpiresAt &&
              current.leaseExpiresAt <= input.now,
          );
          const next: RuntimeLoop = {
            ...current,
            leaseOwner: input.leaseOwner,
            leaseExpiresAt: new Date(
              Date.parse(input.now) + input.leaseDurationMs,
            ).toISOString(),
            heartbeatAt: input.now,
            updatedAt: input.now,
          };
          transaction.set(ref, runtimeLoopToDocument(next) as DocumentData, {
            merge: true,
          });
          return {
            acquired: true,
            recovered,
            previousLeaseOwner: recovered ? current.leaseOwner : null,
            loop: next,
          };
        });
      },
    },
    state: {
      async getState(input) {
        const ref = stateCollection.doc(input.organizationId);
        const snapshot = await ref.get();
        return snapshot.exists
          ? runtimeLoopStateFromDocument(
              snapshot.data() as RuntimeLoopStateDocument,
            )
          : createDefaultRuntimeLoopState(input);
      },
      async saveState(state) {
        await stateCollection
          .doc(state.organizationId)
          .set(runtimeLoopStateToDocument(state) as DocumentData, { merge: true });
        return state;
      },
    },
    events: {
      async saveEvent(event) {
        await eventCollection
          .doc(event.id)
          .set(runtimeLoopEventToDocument(event) as DocumentData, { merge: true });
        return event;
      },
      async listRecentEvents(input) {
        const snapshot = await eventCollection
          .where("organizationId", "==", input.organizationId)
          .orderBy("detectedAt", "desc")
          .limit(input.limit ?? 50)
          .get();
        return snapshot.docs.map((doc) =>
          runtimeLoopEventFromDocument(doc.id, doc.data() as RuntimeLoopEventDocument),
        );
      },
    },
    results: {
      async saveResult(result) {
        await resultCollection
          .doc(result.id)
          .set(runtimeLoopResultToDocument(result) as DocumentData, {
            merge: true,
          });
        return result;
      },
      async listRecentResults(input) {
        let query = resultCollection.where(
          "organizationId",
          "==",
          input.organizationId,
        );
        if (input.loopType) {
          query = query.where("loopType", "==", input.loopType);
        }
        const snapshot = await query
          .orderBy("runStartedAt", "desc")
          .limit(input.limit ?? 50)
          .get();
        return snapshot.docs.map((doc) =>
          runtimeLoopResultFromDocument(
            doc.id,
            doc.data() as RuntimeLoopResultDocument,
          ),
        );
      },
    },
  };
}

function runtimeLoopFromDocument(id: string, document: RuntimeLoopDocument): RuntimeLoop {
  return {
    ...document,
    id,
    leaseExpiresAt: document.leaseExpiresAt
      ? toIsoDateTime(document.leaseExpiresAt, "runtimeLoops.leaseExpiresAt")
      : null,
    heartbeatAt: document.heartbeatAt
      ? toIsoDateTime(document.heartbeatAt, "runtimeLoops.heartbeatAt")
      : null,
    lastRunStartedAt: document.lastRunStartedAt
      ? toIsoDateTime(document.lastRunStartedAt, "runtimeLoops.lastRunStartedAt")
      : null,
    lastRunCompletedAt: document.lastRunCompletedAt
      ? toIsoDateTime(
          document.lastRunCompletedAt,
          "runtimeLoops.lastRunCompletedAt",
        )
      : null,
    createdAt: toIsoDateTime(document.createdAt, "runtimeLoops.createdAt"),
    updatedAt: toIsoDateTime(document.updatedAt, "runtimeLoops.updatedAt"),
  };
}

function runtimeLoopToDocument(loop: RuntimeLoop): RuntimeLoopDocument {
  return {
    ...loop,
    leaseExpiresAt: loop.leaseExpiresAt
      ? toFirestoreTimestamp(loop.leaseExpiresAt)
      : null,
    heartbeatAt: loop.heartbeatAt ? toFirestoreTimestamp(loop.heartbeatAt) : null,
    lastRunStartedAt: loop.lastRunStartedAt
      ? toFirestoreTimestamp(loop.lastRunStartedAt)
      : null,
    lastRunCompletedAt: loop.lastRunCompletedAt
      ? toFirestoreTimestamp(loop.lastRunCompletedAt)
      : null,
    createdAt: toFirestoreTimestamp(loop.createdAt),
    updatedAt: toFirestoreTimestamp(loop.updatedAt),
  };
}

function runtimeLoopStateFromDocument(
  document: RuntimeLoopStateDocument,
): RuntimeLoopState {
  return {
    ...document,
    pauseRequestedAt: document.pauseRequestedAt
      ? toIsoDateTime(
          document.pauseRequestedAt,
          "runtimeLoopStates.pauseRequestedAt",
        )
      : null,
    pauseReleasedAt: document.pauseReleasedAt
      ? toIsoDateTime(
          document.pauseReleasedAt,
          "runtimeLoopStates.pauseReleasedAt",
        )
      : null,
    drainRequestedAt: document.drainRequestedAt
      ? toIsoDateTime(
          document.drainRequestedAt,
          "runtimeLoopStates.drainRequestedAt",
        )
      : null,
    drainReleasedAt: document.drainReleasedAt
      ? toIsoDateTime(
          document.drainReleasedAt,
          "runtimeLoopStates.drainReleasedAt",
        )
      : null,
    drainDeadlineAt: document.drainDeadlineAt
      ? toIsoDateTime(
          document.drainDeadlineAt,
          "runtimeLoopStates.drainDeadlineAt",
        )
      : null,
    updatedAt: toIsoDateTime(document.updatedAt, "runtimeLoopStates.updatedAt"),
  };
}

function runtimeLoopStateToDocument(
  state: RuntimeLoopState,
): RuntimeLoopStateDocument {
  return {
    ...state,
    pauseRequestedAt: state.pauseRequestedAt
      ? toFirestoreTimestamp(state.pauseRequestedAt)
      : null,
    pauseReleasedAt: state.pauseReleasedAt
      ? toFirestoreTimestamp(state.pauseReleasedAt)
      : null,
    drainRequestedAt: state.drainRequestedAt
      ? toFirestoreTimestamp(state.drainRequestedAt)
      : null,
    drainReleasedAt: state.drainReleasedAt
      ? toFirestoreTimestamp(state.drainReleasedAt)
      : null,
    drainDeadlineAt: state.drainDeadlineAt
      ? toFirestoreTimestamp(state.drainDeadlineAt)
      : null,
    updatedAt: toFirestoreTimestamp(state.updatedAt),
  };
}

function runtimeLoopEventFromDocument(
  id: string,
  document: RuntimeLoopEventDocument,
): RuntimeLoopEvent {
  return {
    ...document,
    id,
    detectedAt: toIsoDateTime(document.detectedAt, "runtimeLoopEvents.detectedAt"),
  };
}

function runtimeLoopEventToDocument(
  event: RuntimeLoopEvent,
): RuntimeLoopEventDocument {
  return {
    ...event,
    detectedAt: toFirestoreTimestamp(event.detectedAt),
  };
}

function runtimeLoopResultFromDocument(
  id: string,
  document: RuntimeLoopResultDocument,
): RuntimeLoopResult {
  return {
    ...document,
    id,
    runStartedAt: toIsoDateTime(
      document.runStartedAt,
      "runtimeLoopResults.runStartedAt",
    ),
    runCompletedAt: toIsoDateTime(
      document.runCompletedAt,
      "runtimeLoopResults.runCompletedAt",
    ),
    createdAt: toIsoDateTime(document.createdAt, "runtimeLoopResults.createdAt"),
    updatedAt: toIsoDateTime(document.updatedAt, "runtimeLoopResults.updatedAt"),
  };
}

function runtimeLoopResultToDocument(
  result: RuntimeLoopResult,
): RuntimeLoopResultDocument {
  return {
    ...result,
    runStartedAt: toFirestoreTimestamp(result.runStartedAt),
    runCompletedAt: toFirestoreTimestamp(result.runCompletedAt),
    createdAt: toFirestoreTimestamp(result.createdAt),
    updatedAt: toFirestoreTimestamp(result.updatedAt),
  };
}

function upsertById<T extends { id: string }>(
  store: T[],
  item: T,
  getId: (value: T) => string = (value) => value.id,
) {
  const index = store.findIndex((entry) => getId(entry) === getId(item));
  if (index >= 0) {
    store[index] = item;
    return;
  }
  store.push(item);
}

function upsertByKey<T>(
  store: T[],
  item: T,
  getKey: (value: T) => string,
) {
  const index = store.findIndex((entry) => getKey(entry) === getKey(item));
  if (index >= 0) {
    store[index] = item;
    return;
  }
  store.push(item);
}
