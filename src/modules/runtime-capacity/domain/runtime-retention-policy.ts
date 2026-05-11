export interface RuntimeRetentionPolicyWindow {
  hotDays: number;
  archiveAfterDays: number;
  purgeAfterDays: number | null;
}

export interface RuntimeRetentionPolicy {
  runtimeProjections: RuntimeRetentionPolicyWindow;
  diagnosticsSnapshots: RuntimeRetentionPolicyWindow;
  replayHistory: RuntimeRetentionPolicyWindow;
  deadLetterHistory: RuntimeRetentionPolicyWindow;
  providerReceiptHistory: RuntimeRetentionPolicyWindow;
  deliveryAttemptHistory: RuntimeRetentionPolicyWindow;
  preserveAuthoritativeOperationalHistory: true;
}

export const DEFAULT_RUNTIME_RETENTION_POLICY: RuntimeRetentionPolicy = {
  runtimeProjections: {
    hotDays: 7,
    archiveAfterDays: 30,
    purgeAfterDays: 180,
  },
  diagnosticsSnapshots: {
    hotDays: 7,
    archiveAfterDays: 30,
    purgeAfterDays: 90,
  },
  replayHistory: {
    hotDays: 14,
    archiveAfterDays: 60,
    purgeAfterDays: 365,
  },
  deadLetterHistory: {
    hotDays: 30,
    archiveAfterDays: 90,
    purgeAfterDays: 365,
  },
  providerReceiptHistory: {
    hotDays: 14,
    archiveAfterDays: 60,
    purgeAfterDays: 365,
  },
  deliveryAttemptHistory: {
    hotDays: 14,
    archiveAfterDays: 60,
    purgeAfterDays: 365,
  },
  preserveAuthoritativeOperationalHistory: true,
};
