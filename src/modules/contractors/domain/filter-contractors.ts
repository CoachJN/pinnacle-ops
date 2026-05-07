import type { ContractorStatus } from "./constants.ts";

export interface ContractorFilterable {
  legalName: string;
  displayName?: string | null;
  businessEmail?: string | null;
  mainPhone?: string | null;
  status: ContractorStatus;
  trades: string[];
  serviceArea?: string | null;
}

export interface ContractorFilterInput {
  status?: ContractorStatus;
  search?: string;
}

export function filterContractors<T extends ContractorFilterable>(
  contractors: readonly T[],
  filters: ContractorFilterInput,
): T[] {
  const search = filters.search?.trim().toLowerCase();

  return contractors.filter((contractor) => {
    if (filters.status && contractor.status !== filters.status) {
      return false;
    }

    if (!search) {
      return true;
    }

    return [
      contractor.legalName,
      contractor.displayName,
      contractor.businessEmail,
      contractor.mainPhone,
      ...contractor.trades,
      contractor.serviceArea,
    ]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(search));
  });
}
