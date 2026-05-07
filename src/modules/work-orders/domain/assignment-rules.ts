import { isContractorAssignable } from "../../contractors/domain/is-contractor-assignable.ts";
import type { ContractorAssignmentReadiness } from "../../contractors/domain/types.ts";
import type { UserRole } from "../../../types/permissions.ts";
import type { AssignmentStatus, WorkOrderStatus } from "../../../types/work-order.ts";

const INTERNAL_ASSIGNMENT_ROLES = new Set<UserRole>([
  "coordinator",
  "manager",
  "owner",
]);

const INTERNAL_ASSIGNMENT_OVERRIDE_ROLES = new Set<UserRole>([
  "coordinator",
  "manager",
  "owner",
]);

const TERMINAL_WORK_ORDER_STATUSES = new Set<WorkOrderStatus>([
  "closed",
  "cancelled",
  "work_completed",
]);

const ACTIVE_ASSIGNMENT_STATUSES = new Set<AssignmentStatus>([
  "assigned",
  "accepted",
]);

const ASSIGNMENT_TRANSITIONS = {
  assigned: ["accepted", "declined", "cancelled"],
  accepted: ["completed", "cancelled"],
  declined: [],
  cancelled: [],
  completed: [],
} as const satisfies Record<AssignmentStatus, readonly AssignmentStatus[]>;

export interface ContractorAssignmentEligibilityInput
  extends ContractorAssignmentReadiness {
  workOrderCategory: string | null;
}

export interface ContractorAssignmentEligibility {
  isAssignable: boolean;
  reason: string | null;
}

export function canManageAssignments(role: UserRole | "system"): boolean {
  return role !== "system" && INTERNAL_ASSIGNMENT_ROLES.has(role);
}

export function canOverrideAssignmentCompletion(role: UserRole | "system"): boolean {
  return role !== "system" && INTERNAL_ASSIGNMENT_OVERRIDE_ROLES.has(role);
}

export function isTerminalAssignmentWorkOrderStatus(status: WorkOrderStatus): boolean {
  return TERMINAL_WORK_ORDER_STATUSES.has(status);
}

export function isActiveAssignmentStatus(status: AssignmentStatus): boolean {
  return ACTIVE_ASSIGNMENT_STATUSES.has(status);
}

export function canAssignmentTransition(
  from: AssignmentStatus,
  to: AssignmentStatus,
): boolean {
  return (ASSIGNMENT_TRANSITIONS[from] as readonly AssignmentStatus[]).includes(to);
}

export function getContractorAssignmentEligibility(
  input: ContractorAssignmentEligibilityInput,
): ContractorAssignmentEligibility {
  if (!isContractorAssignable(input)) {
    if (input.isAssignable === false) {
      return {
        isAssignable: false,
        reason: "Contractor is marked as not assignable.",
      };
    }

    if (input.status !== "active") {
      return {
        isAssignable: false,
        reason: "Contractor must be active before it can be assigned.",
      };
    }

    return {
      isAssignable: false,
      reason: "Contractor must have at least one trade before it can be assigned.",
    };
  }

  const normalizedCategory = normalizeCategory(input.workOrderCategory);
  if (!normalizedCategory) {
    return {
      isAssignable: false,
      reason: "Work order category is required before assigning a contractor.",
    };
  }

  const configuredCategories = input.trades ?? [];
  const contractorCategories = new Set(
    configuredCategories
      .map((category) => normalizeCategory(category))
      .filter(Boolean),
  );
  if (!contractorCategories.has(normalizedCategory)) {
    return {
      isAssignable: false,
      reason: "Contractor is not configured for this work order category.",
    };
  }

  return {
    isAssignable: true,
    reason: null,
  };
}

function normalizeCategory(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}
