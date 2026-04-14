import "server-only";

import type { ClientQuote } from "@/server/repositories";
import type { ClientPortalQuoteDetail } from "@/types/quote";

export function toClientPortalQuoteDetail(
  quote: ClientQuote,
): ClientPortalQuoteDetail {
  return {
    id: quote.id,
    workOrderId: quote.workOrderId,
    clientOrganizationId: quote.clientOrganizationId,
    locationId: quote.locationId,
    status: quote.status,
    notes: quote.notes,
    lineItems: quote.lineItems,
    subtotal: quote.subtotal,
    taxAmount: quote.taxAmount,
    totalAmount: quote.totalAmount,
    sentAt: quote.sentAt,
    respondedAt: quote.respondedAt,
    approvedAt: quote.approvedAt,
    rejectedAt: quote.rejectedAt,
    rejectionReason: quote.rejectionReason,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
    workOrderNumber: quote.workOrderSnapshot.name,
  };
}
