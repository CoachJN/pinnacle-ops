import type { EntityId } from "./entity.ts";

export type ContractorStatus = "active" | "inactive";

export interface Contractor {
  id: EntityId;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  status: ContractorStatus;
  serviceCategories: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastUpdatedBy: string;
}

export interface CreateContractorInput {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  status: ContractorStatus;
  serviceCategories: string[];
  notes: string | null;
  createdBy?: string;
  lastUpdatedBy?: string;
}

export interface UpdateContractorInput {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  status?: ContractorStatus;
  serviceCategories?: string[];
  notes?: string | null;
}

export interface ContractorSessionContext {
  userId: EntityId;
  name: string;
  contractorId: EntityId;
}
