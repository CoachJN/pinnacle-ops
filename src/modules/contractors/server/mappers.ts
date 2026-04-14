import type { ContractorOrganization } from "@/server/repositories";
import type { Contractor } from "@/types/contractor";
import { isContractorAssignable } from "@/modules/contractors/domain/is-contractor-assignable";

export function mapContractorOrganizationToContractor(
  contractor: ContractorOrganization,
): Contractor {
  const company = contractor.displayName;
  const companyName = company ?? contractor.name;

  return {
    id: contractor.id,
    name: contractor.name,
    company,
    email: contractor.primaryContactEmail ?? "",
    phone: contractor.primaryContactPhone ?? "",
    status: contractor.status,
    serviceCategories: contractor.serviceCategories,
    serviceAreas: contractor.serviceAreas,
    notes: contractor.notes,
    createdAt: contractor.createdAt,
    updatedAt: contractor.updatedAt,
    createdByUserId: contractor.createdByUserId,
    updatedByUserId: contractor.updatedByUserId,
    recordStatus: contractor.recordStatus,
    isAssignable: isContractorAssignable(contractor),
    companyName,
    contactName: contractor.name,
    createdBy: contractor.createdByUserId,
    lastUpdatedBy: contractor.updatedByUserId,
  };
}
