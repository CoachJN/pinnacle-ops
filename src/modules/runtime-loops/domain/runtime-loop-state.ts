import type { RuntimeLoopType } from "./runtime-loop";

export interface RuntimeLoopState {
  organizationId: string;
  paused: boolean;
  draining: boolean;
  pausedLoopTypes: readonly RuntimeLoopType[];
  drainingLoopTypes: readonly RuntimeLoopType[];
  pauseReason: string | null;
  drainReason: string | null;
  pauseRequestedAt: string | null;
  pauseReleasedAt: string | null;
  drainRequestedAt: string | null;
  drainReleasedAt: string | null;
  drainDeadlineAt: string | null;
  updatedAt: string;
}

export function createDefaultRuntimeLoopState(input: {
  organizationId: string;
  now: string;
}): RuntimeLoopState {
  return {
    organizationId: input.organizationId,
    paused: false,
    draining: false,
    pausedLoopTypes: [],
    drainingLoopTypes: [],
    pauseReason: null,
    drainReason: null,
    pauseRequestedAt: null,
    pauseReleasedAt: null,
    drainRequestedAt: null,
    drainReleasedAt: null,
    drainDeadlineAt: null,
    updatedAt: input.now,
  };
}
