import "server-only";

import type { Quote } from "@/server/repositories";
import type { EntityId } from "@/types/entity";
import type { QuoteStatus } from "@/types/quote";

export interface ContractorPortalQuoteSummary {
  id: EntityId;
  workOrderId: EntityId;
  versionNumber: number;
  status: QuoteStatus;
  laborAmount: number;
  materialAmount: number;
  otherAmount: number;
  totalAmount: number;
  currency: Quote["currency"];
  scopeSummary: string;
  contractorNotes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toContractorPortalQuoteSummary(
  quote: Quote,
): ContractorPortalQuoteSummary {
  return {
    id: quote.id,
    workOrderId: quote.workOrderId,
    versionNumber: quote.versionNumber,
    status: quote.status,
    laborAmount: quote.laborAmount,
    materialAmount: quote.materialAmount,
    otherAmount: quote.otherAmount,
    totalAmount: quote.totalAmount,
    currency: quote.currency,
    scopeSummary: quote.scopeSummary,
    contractorNotes: quote.contractorNotes,
    submittedAt: quote.submittedAt,
    reviewedAt: quote.reviewedAt,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
  };
}
