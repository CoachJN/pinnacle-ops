import "server-only";

import type { CollectionReference, DocumentData, Firestore, Query } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/server/firebase";
import type { EntityId } from "@/types/entity";
import type { RepairConfirmation } from "../domain/operator-guardrail";
import type { ScheduledTask } from "../domain/scheduled-task";
import type { SchedulerRunRecord } from "../domain/scheduler-result";

const SCHEDULER_COLLECTIONS = {
  tasks: "runtimeScheduledTasks",
  runs: "runtimeSchedulerRuns",
  confirmations: "runtimeRepairConfirmations",
} as const;

export interface ScheduledTaskRepository {
  newId(): EntityId;
  getById(id: EntityId): Promise<ScheduledTask | null>;
  create(task: ScheduledTask): Promise<ScheduledTask>;
  save(task: ScheduledTask): Promise<ScheduledTask>;
  findByTaskType(input: {
    organizationId: EntityId;
    taskType: ScheduledTask["taskType"];
  }): Promise<ScheduledTask | null>;
  listByOrganizationId(input: {
    organizationId: EntityId;
    limit?: number;
  }): Promise<readonly ScheduledTask[]>;
  claimDueTasks(input: {
    organizationId: EntityId;
    now: string;
    workerId: string;
    leaseDurationMs: number;
    limit: number;
  }): Promise<readonly ScheduledTask[]>;
}

export interface SchedulerRunRepository {
  newId(): EntityId;
  create(run: SchedulerRunRecord): Promise<SchedulerRunRecord>;
  listByOrganizationId(input: {
    organizationId: EntityId;
    limit?: number;
  }): Promise<readonly SchedulerRunRecord[]>;
}

export interface RepairConfirmationRepository {
  newId(): EntityId;
  getById(id: EntityId): Promise<RepairConfirmation | null>;
  create(confirmation: RepairConfirmation): Promise<RepairConfirmation>;
  save(confirmation: RepairConfirmation): Promise<RepairConfirmation>;
  findPendingByRepairActionId(input: {
    organizationId: EntityId;
    repairActionId: EntityId;
  }): Promise<RepairConfirmation | null>;
  listPendingByOrganizationId(input: {
    organizationId: EntityId;
    limit?: number;
  }): Promise<readonly RepairConfirmation[]>;
}

export interface SchedulerRepositories {
  tasks: ScheduledTaskRepository;
  runs: SchedulerRunRepository;
  confirmations: RepairConfirmationRepository;
}

export function createFirestoreSchedulerRepositories(
  firestore: Firestore = getFirebaseAdminFirestore(),
): SchedulerRepositories {
  return {
    tasks: createFirestoreScheduledTaskRepository(
      firestore,
      firestore.collection(SCHEDULER_COLLECTIONS.tasks),
    ),
    runs: createFirestoreSchedulerRunRepository(
      firestore.collection(SCHEDULER_COLLECTIONS.runs),
    ),
    confirmations: createFirestoreRepairConfirmationRepository(
      firestore.collection(SCHEDULER_COLLECTIONS.confirmations),
    ),
  };
}

export function createInMemorySchedulerRepositories(seed?: {
  tasks?: ScheduledTask[];
  runs?: SchedulerRunRecord[];
  confirmations?: RepairConfirmation[];
}): SchedulerRepositories {
  const tasks = [...(seed?.tasks ?? [])];
  const runs = [...(seed?.runs ?? [])];
  const confirmations = [...(seed?.confirmations ?? [])];

  return {
    tasks: {
      newId() {
        return `scheduled-task-${tasks.length + 1}`;
      },
      async getById(id) {
        return tasks.find((item) => item.id === id) ?? null;
      },
      async create(task) {
        tasks.push(task);
        return task;
      },
      async save(task) {
        upsertById(tasks, task);
        return task;
      },
      async findByTaskType(input) {
        return (
          tasks.find(
            (item) =>
              item.organizationId === input.organizationId && item.taskType === input.taskType,
          ) ?? null
        );
      },
      async listByOrganizationId(input) {
        return tasks
          .filter((item) => item.organizationId === input.organizationId)
          .sort((left, right) => left.taskType.localeCompare(right.taskType))
          .slice(0, input.limit ?? tasks.length);
      },
      async claimDueTasks(input) {
        const claimed: ScheduledTask[] = [];
        for (const task of tasks
          .filter((item) => item.organizationId === input.organizationId)
          .filter((item) => item.status === "enabled")
          .filter((item) => item.nextRunAt <= input.now)
          .sort((left, right) => left.nextRunAt.localeCompare(right.nextRunAt))) {
          if (claimed.length >= input.limit) {
            break;
          }
          if (task.leaseExpiresAt && task.leaseExpiresAt > input.now) {
            continue;
          }
          const updated: ScheduledTask = {
            ...task,
            leaseOwner: input.workerId,
            leaseExpiresAt: new Date(Date.parse(input.now) + input.leaseDurationMs).toISOString(),
            updatedAt: input.now,
          };
          upsertById(tasks, updated);
          claimed.push(updated);
        }
        return claimed;
      },
    },
    runs: {
      newId() {
        return `scheduler-run-${runs.length + 1}`;
      },
      async create(run) {
        runs.push(run);
        return run;
      },
      async listByOrganizationId(input) {
        return runs
          .filter((item) => item.organizationId === input.organizationId)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          .slice(0, input.limit ?? runs.length);
      },
    },
    confirmations: {
      newId() {
        return `repair-confirmation-${confirmations.length + 1}`;
      },
      async getById(id) {
        return confirmations.find((item) => item.id === id) ?? null;
      },
      async create(confirmation) {
        confirmations.push(confirmation);
        return confirmation;
      },
      async save(confirmation) {
        upsertById(confirmations, confirmation);
        return confirmation;
      },
      async findPendingByRepairActionId(input) {
        return (
          confirmations.find(
            (item) =>
              item.organizationId === input.organizationId &&
              item.repairActionId === input.repairActionId &&
              item.status === "pending",
          ) ?? null
        );
      },
      async listPendingByOrganizationId(input) {
        return confirmations
          .filter((item) => item.organizationId === input.organizationId)
          .filter((item) => item.status === "pending" || item.status === "approved")
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          .slice(0, input.limit ?? confirmations.length);
      },
    },
  };
}

function createFirestoreScheduledTaskRepository(
  firestore: Firestore,
  collection: CollectionReference<DocumentData>,
): ScheduledTaskRepository {
  return {
    newId() {
      return collection.doc().id;
    },
    async getById(id) {
      const snapshot = await collection.doc(id).get();
      return snapshot.exists ? toRecord<ScheduledTask>(snapshot.id, snapshot.data()) : null;
    },
    async create(task) {
      await collection.doc(task.id).create(task);
      return task;
    },
    async save(task) {
      await collection.doc(task.id).set(task, { merge: true });
      return task;
    },
    async findByTaskType(input) {
      const snapshot = await collection
        .where("organizationId", "==", input.organizationId)
        .where("taskType", "==", input.taskType)
        .limit(1)
        .get();
      const doc = snapshot.docs[0];
      return doc ? toRecord<ScheduledTask>(doc.id, doc.data()) : null;
    },
    async listByOrganizationId(input) {
      const snapshot = await collection
        .where("organizationId", "==", input.organizationId)
        .orderBy("taskType", "asc")
        .limit(input.limit ?? 100)
        .get();
      return snapshot.docs.map((doc) => toRecord<ScheduledTask>(doc.id, doc.data()));
    },
    async claimDueTasks(input) {
      const query = collection
        .where("organizationId", "==", input.organizationId)
        .where("status", "==", "enabled")
        .where("nextRunAt", "<=", input.now)
        .orderBy("nextRunAt", "asc")
        .limit(Math.max(input.limit * 4, input.limit));

      return firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(query);
        const claimed: ScheduledTask[] = [];
        for (const doc of snapshot.docs) {
          if (claimed.length >= input.limit) {
            break;
          }
          const current = toRecord<ScheduledTask>(doc.id, doc.data());
          if (current.leaseExpiresAt && current.leaseExpiresAt > input.now) {
            continue;
          }
          const updated: ScheduledTask = {
            ...current,
            leaseOwner: input.workerId,
            leaseExpiresAt: new Date(Date.parse(input.now) + input.leaseDurationMs).toISOString(),
            updatedAt: input.now,
          };
          transaction.set(doc.ref, updated, { merge: true });
          claimed.push(updated);
        }
        return claimed;
      });
    },
  };
}

function createFirestoreSchedulerRunRepository(
  collection: CollectionReference<DocumentData>,
): SchedulerRunRepository {
  return {
    newId() {
      return collection.doc().id;
    },
    async create(run) {
      await collection.doc(run.id).create(run);
      return run;
    },
    async listByOrganizationId(input) {
      let query: Query<DocumentData> = collection.where("organizationId", "==", input.organizationId);
      query = query.orderBy("createdAt", "desc").limit(input.limit ?? 100);
      const snapshot = await query.get();
      return snapshot.docs.map((doc) => toRecord<SchedulerRunRecord>(doc.id, doc.data()));
    },
  };
}

function createFirestoreRepairConfirmationRepository(
  collection: CollectionReference<DocumentData>,
): RepairConfirmationRepository {
  return {
    newId() {
      return collection.doc().id;
    },
    async getById(id) {
      const snapshot = await collection.doc(id).get();
      return snapshot.exists ? toRecord<RepairConfirmation>(snapshot.id, snapshot.data()) : null;
    },
    async create(confirmation) {
      await collection.doc(confirmation.id).create(confirmation);
      return confirmation;
    },
    async save(confirmation) {
      await collection.doc(confirmation.id).set(confirmation, { merge: true });
      return confirmation;
    },
    async findPendingByRepairActionId(input) {
      const snapshot = await collection
        .where("organizationId", "==", input.organizationId)
        .where("repairActionId", "==", input.repairActionId)
        .where("status", "==", "pending")
        .limit(1)
        .get();
      const doc = snapshot.docs[0];
      return doc ? toRecord<RepairConfirmation>(doc.id, doc.data()) : null;
    },
    async listPendingByOrganizationId(input) {
      const snapshot = await collection
        .where("organizationId", "==", input.organizationId)
        .where("status", "in", ["pending", "approved"])
        .orderBy("createdAt", "desc")
        .limit(input.limit ?? 100)
        .get();
      return snapshot.docs.map((doc) => toRecord<RepairConfirmation>(doc.id, doc.data()));
    },
  };
}

function toRecord<T>(id: string, data: DocumentData | undefined): T {
  return { id, ...(data ?? {}) } as T;
}

function upsertById<T extends { id: string }>(items: T[], next: T): void {
  const index = items.findIndex((item) => item.id === next.id);
  if (index >= 0) {
    items[index] = next;
    return;
  }
  items.push(next);
}
