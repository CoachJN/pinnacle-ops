import { CONTRACTOR_STATUSES } from "./constants.ts";
import type { ContractorAssignmentReadiness } from "./types.ts";

export function isContractorAssignable(
  contractor: ContractorAssignmentReadiness,
): boolean {
  const configuredTrades = contractor.trades ?? [];

  return (
    contractor.isAssignable !== false &&
    contractor.status === CONTRACTOR_STATUSES.Active &&
    configuredTrades.some((category) => category.trim().length > 0)
  );
}
