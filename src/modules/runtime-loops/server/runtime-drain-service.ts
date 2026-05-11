import "server-only";

import {
  createDefaultRuntimeLoopState,
  type RuntimeLoopState,
} from "../domain/runtime-loop-state";
import {
  RUNTIME_LOOP_EVENT_KINDS,
  type RuntimeLoopEvent,
} from "../domain/runtime-loop-heartbeat";
import type { RuntimeLoopType } from "../domain/runtime-loop";
import type {
  RuntimeLoopEventRepository,
  RuntimeLoopRepository,
  RuntimeLoopStateRepository,
} from "./runtime-loop-repository";

export interface RuntimeDrainService {
  getState(input: { organizationId: string; now: string }): Promise<RuntimeLoopState>;
  pause(input: {
    organizationId: string;
    loopTypes?: readonly RuntimeLoopType[];
    reason?: string | null;
    now: string;
  }): Promise<RuntimeLoopState>;
  resume(input: {
    organizationId: string;
    loopTypes?: readonly RuntimeLoopType[];
    now: string;
  }): Promise<RuntimeLoopState>;
  requestDrain(input: {
    organizationId: string;
    loopTypes?: readonly RuntimeLoopType[];
    reason?: string | null;
    now: string;
    drainWindowMs: number;
  }): Promise<RuntimeLoopState>;
  releaseDrain(input: {
    organizationId: string;
    loopTypes?: readonly RuntimeLoopType[];
    now: string;
  }): Promise<RuntimeLoopState>;
  isLoopPaused(input: {
    organizationId: string;
    loopType: RuntimeLoopType;
    now: string;
  }): Promise<boolean>;
  isLoopDraining(input: {
    organizationId: string;
    loopType: RuntimeLoopType;
    now: string;
  }): Promise<boolean>;
}

export function createRuntimeDrainService(
  stateRepository: RuntimeLoopStateRepository,
  eventRepository: RuntimeLoopEventRepository,
  idSource: Pick<RuntimeLoopRepository, "newEventId">,
): RuntimeDrainService {
  return {
    getState(input) {
      return stateRepository.getState(input);
    },
    async pause(input) {
      const current =
        (await stateRepository.getState(input)) ??
        createDefaultRuntimeLoopState(input);
      const pausedLoopTypes = mergeLoopTypes(
        current.pausedLoopTypes,
        input.loopTypes,
      );
      const next: RuntimeLoopState = {
        ...current,
        paused: input.loopTypes?.length ? current.paused || pausedLoopTypes.length > 0 : true,
        pausedLoopTypes,
        pauseReason: input.reason ?? current.pauseReason,
        pauseRequestedAt: input.now,
        pauseReleasedAt: null,
        updatedAt: input.now,
      };
      await stateRepository.saveState(next);
      await eventRepository.saveEvent(buildControlEvent(idSource, {
        organizationId: input.organizationId,
        loopType: "runtime.control",
        eventKind: RUNTIME_LOOP_EVENT_KINDS.PauseRequested,
        leaseOwner: null,
        previousLeaseOwner: null,
        detectedAt: input.now,
        correlationId: `runtime-control:${input.organizationId}`,
        details: {
          loopTypes: input.loopTypes ?? [],
          reason: input.reason ?? null,
        },
      }));
      return next;
    },
    async resume(input) {
      const current = await stateRepository.getState(input);
      const pausedLoopTypes = subtractLoopTypes(
        current.pausedLoopTypes,
        input.loopTypes,
      );
      const next: RuntimeLoopState = {
        ...current,
        paused:
          input.loopTypes?.length
            ? pausedLoopTypes.length > 0
            : false,
        pausedLoopTypes,
        pauseReason: input.loopTypes?.length ? current.pauseReason : null,
        pauseReleasedAt: input.now,
        updatedAt: input.now,
      };
      await stateRepository.saveState(next);
      await eventRepository.saveEvent(buildControlEvent(idSource, {
        organizationId: input.organizationId,
        loopType: "runtime.control",
        eventKind: RUNTIME_LOOP_EVENT_KINDS.PauseReleased,
        leaseOwner: null,
        previousLeaseOwner: null,
        detectedAt: input.now,
        correlationId: `runtime-control:${input.organizationId}`,
        details: {
          loopTypes: input.loopTypes ?? [],
        },
      }));
      return next;
    },
    async requestDrain(input) {
      const current = await stateRepository.getState(input);
      const drainingLoopTypes = mergeLoopTypes(
        current.drainingLoopTypes,
        input.loopTypes,
      );
      const next: RuntimeLoopState = {
        ...current,
        draining:
          input.loopTypes?.length ? current.draining || drainingLoopTypes.length > 0 : true,
        drainingLoopTypes,
        drainReason: input.reason ?? current.drainReason,
        drainRequestedAt: input.now,
        drainReleasedAt: null,
        drainDeadlineAt: new Date(
          Date.parse(input.now) + input.drainWindowMs,
        ).toISOString(),
        updatedAt: input.now,
      };
      await stateRepository.saveState(next);
      await eventRepository.saveEvent(buildControlEvent(idSource, {
        organizationId: input.organizationId,
        loopType: "runtime.control",
        eventKind: RUNTIME_LOOP_EVENT_KINDS.DrainRequested,
        leaseOwner: null,
        previousLeaseOwner: null,
        detectedAt: input.now,
        correlationId: `runtime-control:${input.organizationId}`,
        details: {
          loopTypes: input.loopTypes ?? [],
          reason: input.reason ?? null,
          drainDeadlineAt: next.drainDeadlineAt,
        },
      }));
      return next;
    },
    async releaseDrain(input) {
      const current = await stateRepository.getState(input);
      const drainingLoopTypes = subtractLoopTypes(
        current.drainingLoopTypes,
        input.loopTypes,
      );
      const next: RuntimeLoopState = {
        ...current,
        draining:
          input.loopTypes?.length ? drainingLoopTypes.length > 0 : false,
        drainingLoopTypes,
        drainReason: input.loopTypes?.length ? current.drainReason : null,
        drainReleasedAt: input.now,
        drainDeadlineAt: input.loopTypes?.length ? current.drainDeadlineAt : null,
        updatedAt: input.now,
      };
      await stateRepository.saveState(next);
      await eventRepository.saveEvent(buildControlEvent(idSource, {
        organizationId: input.organizationId,
        loopType: "runtime.control",
        eventKind: RUNTIME_LOOP_EVENT_KINDS.DrainReleased,
        leaseOwner: null,
        previousLeaseOwner: null,
        detectedAt: input.now,
        correlationId: `runtime-control:${input.organizationId}`,
        details: {
          loopTypes: input.loopTypes ?? [],
        },
      }));
      return next;
    },
    async isLoopPaused(input) {
      const state = await stateRepository.getState(input);
      return state.paused || state.pausedLoopTypes.includes(input.loopType);
    },
    async isLoopDraining(input) {
      const state = await stateRepository.getState(input);
      return state.draining || state.drainingLoopTypes.includes(input.loopType);
    },
  };
}

function mergeLoopTypes(
  existing: readonly RuntimeLoopType[],
  next?: readonly RuntimeLoopType[],
): readonly RuntimeLoopType[] {
  if (!next?.length) {
    return existing;
  }
  return [...new Set([...existing, ...next])].sort();
}

function subtractLoopTypes(
  existing: readonly RuntimeLoopType[],
  remove?: readonly RuntimeLoopType[],
): readonly RuntimeLoopType[] {
  if (!remove?.length) {
    return [];
  }
  const blocked = new Set(remove);
  return existing.filter((item) => !blocked.has(item));
}

function buildControlEvent(
  repository: Pick<RuntimeLoopRepository, "newEventId">,
  input: Omit<RuntimeLoopEvent, "id">,
): RuntimeLoopEvent {
  return {
    id: repository.newEventId(),
    ...input,
  };
}
