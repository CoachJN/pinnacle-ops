import type { EntityId } from "../../../types/entity.ts";
import type { ContractorStatus } from "./constants.ts";

export interface ContractorListQuery {
  search?: string;
  status?: ContractorStatus;
  limit?: number;
}

export interface ContractorAssignmentReadiness {
  status: ContractorStatus;
  serviceCategories: string[];
}

export interface ContractorAssignedWorkOrderSummary {
  id: EntityId;
  workOrderNumber: string;
  title: string;
  status: string;
}
