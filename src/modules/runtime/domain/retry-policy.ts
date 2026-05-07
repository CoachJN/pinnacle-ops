import type { IsoDateTimeString } from "@/types/entity";

export interface WorkerRetryPolicy {
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}

export interface WorkerRetrySchedule {
  nextRunAfter: IsoDateTimeString;
  delayMs: number;
}

export const DEFAULT_WORKER_RETRY_POLICY: WorkerRetryPolicy = {
  baseDelayMs: 30_000,
  maxDelayMs: 15 * 60_000,
  jitterRatio: 0.2,
};

export function calculateWorkerRetrySchedule(input: {
  attemptCount: number;
  now: IsoDateTimeString;
  stableKey: string;
  policy?: WorkerRetryPolicy;
}): WorkerRetrySchedule {
  const policy = input.policy ?? DEFAULT_WORKER_RETRY_POLICY;
  const exponent = Math.max(input.attemptCount - 1, 0);
  const uncappedDelay = policy.baseDelayMs * 2 ** exponent;
  const cappedDelay = Math.min(uncappedDelay, policy.maxDelayMs);
  const jitterWindow = Math.floor(cappedDelay * policy.jitterRatio);
  const jitter = deterministicJitter(input.stableKey, input.attemptCount, jitterWindow);
  const delayMs = cappedDelay + jitter;

  return {
    delayMs,
    nextRunAfter: new Date(Date.parse(input.now) + delayMs).toISOString(),
  };
}

function deterministicJitter(stableKey: string, attemptCount: number, jitterWindow: number): number {
  if (jitterWindow <= 0) {
    return 0;
  }

  const seed = `${stableKey}:${attemptCount}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  }

  return Math.abs(hash) % (jitterWindow + 1);
}
