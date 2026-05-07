import type { ContractorOrganization } from "@/server/repositories";
import type { Contractor, ContractorTrade } from "@/types/contractor";
import { isContractorAssignable } from "@/modules/contractors/domain/is-contractor-assignable";

export function mapContractorOrganizationToContractor(
  contractor: ContractorOrganization,
): Contractor {
  const trades = normalizeTrades(contractor.trades ?? []);

  return {
    id: contractor.id,
    parentContractorId: contractor.parentContractorId ?? null,
    legalName: contractor.name,
    displayName: contractor.displayName ?? null,
    status: contractor.status,
    businessEmail: contractor.businessEmail ?? null,
    mainPhone: contractor.mainPhone ?? null,
    altPhone: contractor.altPhone ?? null,
    fax: contractor.fax ?? null,
    trades,
    serviceArea: contractor.serviceArea ?? null,
    ratingSummary: contractor.ratingSummary ?? null,
    isAssignable:
      contractor.isAssignable ?? isContractorAssignable(contractor),
    primaryContactId: contractor.primaryContactId ?? null,
    billingContactId: contractor.billingContactId ?? null,
    dispatchContactId: contractor.dispatchContactId ?? null,
    addressLine1: contractor.addressLine1 ?? null,
    addressLine2: contractor.addressLine2 ?? null,
    city: contractor.city ?? null,
    region: contractor.region ?? null,
    postalCode: contractor.postalCode ?? null,
    countryCode: contractor.countryCode ?? null,
    notes: contractor.notes,
    createdAt: contractor.createdAt,
    updatedAt: contractor.updatedAt,
    createdByUserId: contractor.createdByUserId,
    updatedByUserId: contractor.updatedByUserId,
    recordStatus: contractor.recordStatus,
  };
}

function normalizeTrades(values: readonly string[]): ContractorTrade[] {
  return values.map((value) => {
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");

    switch (normalized) {
      case "general":
      case "general_maintenance":
      case "general_contracting":
        return "general_contracting";
      case "hvac":
      case "plumbing":
      case "electrical":
      case "mechanical":
      case "refrigeration":
      case "controls":
      case "low_voltage":
      case "access_control":
      case "doors":
      case "elevator":
      case "fire_life_safety":
      case "roofing":
      case "restoration":
      case "janitorial":
      case "landscaping":
      case "snow_removal":
      case "security":
      case "locksmith":
      case "painting":
      case "paving":
      case "waste":
      case "other":
        return normalized;
      case "av":
        return "low_voltage";
      case "fire":
        return "fire_life_safety";
      case "snow":
        return "snow_removal";
      default:
        return "other";
    }
  });
}
