import "server-only";

import type { ContractorQuote } from "@/server/repositories";
import type { EntityId } from "@/types/entity";
import type { ContractorQuoteStatus, QuoteLineItem } from "@/types/quote";

export interface ContractorPortalQuoteSummary {
  id: EntityId;
  workOrderId: EntityId;
  status: ContractorQuoteStatus;
  lineItems: QuoteLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toContractorPortalQuoteSummary(
  quote: ContractorQuote,
): ContractorPortalQuoteSummary {
  return {
    id: quote.id,
    workOrderId: quote.workOrderId,
    status: quote.status,
    lineItems: quote.lineItems,
    subtotal: quote.subtotal ?? quote.totalAmount - quote.taxAmount,
    taxAmount: quote.taxAmount,
    totalAmount: quote.totalAmount,
    notes: quote.notes,
    submittedAt: quote.submittedAt,
    reviewedAt: quote.reviewedAt,
    rejectionReason: quote.rejectionReason,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
  };
}
