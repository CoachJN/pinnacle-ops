import type { Contractor } from "@/types/contractor";

export interface ContractorListResponse {
  contractors: Contractor[];
}

export interface ContractorDetailResponse {
  contractor: Contractor;
}

export interface ContractorApiErrorResponse {
  error?: {
    message?: string;
  };
}
