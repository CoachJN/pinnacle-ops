import type { EntityId, IsoDateTimeString, RecordStatus } from "./entity.ts";

export {
  CONTRACTOR_STATUSES,
  CONTRACTOR_STATUS_LABELS,
  CONTRACTOR_STATUS_VALUES,
  type ContractorStatus,
} from "../modules/contractors/domain/constants.ts";
import type { ContractorStatus } from "../modules/contractors/domain/constants.ts";

export interface Contractor {
  id: EntityId;
  name: string;
  company: string | null;
  email: string;
  phone: string;
  status: ContractorStatus;
  serviceCategories: string[];
  serviceAreas: string[];
  notes: string | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  createdByUserId: EntityId;
  updatedByUserId: EntityId;
  recordStatus: RecordStatus;
  isAssignable: boolean;
  companyName: string;
  contactName: string;
  createdBy: string;
  lastUpdatedBy: string;
}

export interface CreateContractorInput {
  name: string;
  company?: string | null;
  email: string;
  phone: string;
  status: ContractorStatus;
  serviceCategories: string[];
  serviceAreas: string[];
  notes?: string | null;
  companyName?: string;
  contactName?: string;
  createdBy?: string;
  lastUpdatedBy?: string;
}

export interface UpdateContractorInput {
  name?: string;
  company?: string | null;
  email?: string;
  phone?: string;
  status?: ContractorStatus;
  serviceCategories?: string[];
  serviceAreas?: string[];
  notes?: string | null;
  companyName?: string;
  contactName?: string;
}

export interface ContractorSessionContext {
  userId: EntityId;
  name: string;
  contractorId: EntityId;
}
