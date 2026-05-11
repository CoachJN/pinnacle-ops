export interface RuntimeWorkerScalingPolicy {
  minWorkers: number;
  maxWorkers: number;
  maxClaimsPerWorker: number;
}

export interface RuntimeWorkerScalingSnapshot {
  observedAt: string;
  desiredWorkers: number;
  boundedWorkers: number;
  activeWorkers: number;
  totalGrantedClaims: number;
  replayPressureTenants: number;
  providerIsolatedTenants: number;
  reasoning: readonly string[];
}
