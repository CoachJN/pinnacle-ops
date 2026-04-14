export const CONTRACTOR_STATUSES = {
  Active: "active",
  Inactive: "inactive",
  Onboarding: "onboarding",
  Suspended: "suspended",
} as const;

export type ContractorStatus =
  (typeof CONTRACTOR_STATUSES)[keyof typeof CONTRACTOR_STATUSES];

export const CONTRACTOR_STATUS_VALUES = Object.values(
  CONTRACTOR_STATUSES,
) as readonly ContractorStatus[];

export const CONTRACTOR_STATUS_LABELS: Record<ContractorStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  onboarding: "Onboarding",
  suspended: "Suspended",
};
