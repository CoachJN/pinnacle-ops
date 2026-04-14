import type { ContractorStatus } from "./constants.ts";

export interface ContractorFilterable {
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  status: ContractorStatus;
  serviceCategories: string[];
  serviceAreas: string[];
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
      contractor.name,
      contractor.company,
      contractor.email,
      contractor.phone,
      ...contractor.serviceCategories,
      ...contractor.serviceAreas,
    ]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(search));
  });
}
