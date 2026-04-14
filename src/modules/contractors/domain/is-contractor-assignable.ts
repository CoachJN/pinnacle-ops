import { CONTRACTOR_STATUSES } from "./constants.ts";
import type { ContractorAssignmentReadiness } from "./types.ts";

export function isContractorAssignable(
  contractor: ContractorAssignmentReadiness,
): boolean {
  return (
    contractor.status === CONTRACTOR_STATUSES.Active &&
    contractor.serviceCategories.some((category) => category.trim().length > 0)
  );
}
