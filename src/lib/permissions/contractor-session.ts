import type { ContractorSessionContext } from "../../types/contractor.ts";
import { USER_ROLES } from "../../types/permissions.ts";
import type { ContractorUserRole } from "../../types/permissions.ts";
import { getContractorById } from "../contractors/repository.ts";

export interface MockContractorCurrentUser extends ContractorSessionContext {
  role: ContractorUserRole;
  roleLabel: string;
}

const defaultContractorId = "contractor-summit-mechanical";

export async function getMockContractorCurrentUser(
  contractorIdInput?: string | null,
): Promise<MockContractorCurrentUser | null> {
  const contractorId = contractorIdInput?.trim() || defaultContractorId;
  const contractor = await getContractorById(contractorId);
  if (!contractor || contractor.status !== "active") {
    return null;
  }

  return {
    userId: `usr-${contractor.id}`,
    name: contractor.contactName,
    role: USER_ROLES.ContractorUser,
    roleLabel: "Contractor",
    contractorId: contractor.id,
  };
}
