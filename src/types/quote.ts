import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { UserRole } from "@/types/permissions";

export type QuoteStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "ready_for_client"
  | "client_approved"
  | "client_rejected"
  | "superseded";

export interface QuoteTotals {
  laborAmount: number;
  materialAmount: number;
  otherAmount: number;
  totalAmount: number;
}

export interface Quote extends QuoteTotals {
  id: EntityId;
  workOrderId: EntityId;
  versionNumber: number;
  status: QuoteStatus;
  assignedContractorId: EntityId | null;
  contractorName: string;
  submittedByName: string;
  submittedByRole: UserRole;
  scopeSummary: string;
  contractorNotes: string | null;
  internalReviewNotes: string | null;
  clientResponseNotes: string | null;
  submittedAt: IsoDateTimeString | null;
  reviewedAt: IsoDateTimeString | null;
  clientDecisionAt: IsoDateTimeString | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  createdBy: string;
  lastUpdatedBy: string;
}

export type QuoteFormInput = Pick<
  Quote,
  | "contractorName"
  | "assignedContractorId"
  | "laborAmount"
  | "materialAmount"
  | "otherAmount"
  | "scopeSummary"
  | "contractorNotes"
>;

export type ContractorQuoteStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "rejected"
  | "accepted";

export type ClientQuoteStatus =
  | "draft"
  | "sent"
  | "approved"
  | "rejected"
  | "expired";

export type QuoteDecisionAction =
  | "accept_contractor_quote"
  | "reject_contractor_quote"
  | "send_client_quote"
  | "approve_client_quote"
  | "reject_client_quote";

export interface QuoteLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface QuoteLineItemTotals {
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

export interface ContractorQuote extends QuoteLineItemTotals {
  id: EntityId;
  workOrderId: EntityId;
  contractorUserId: EntityId | null;
  contractorOrganizationId: EntityId | null;
  lineItems: QuoteLineItem[];
  notes: string | null;
  status: ContractorQuoteStatus;
  submittedAt: IsoDateTimeString | null;
  reviewedAt: IsoDateTimeString | null;
  reviewedByUserId: EntityId | null;
  rejectionReason: string | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface ClientQuote extends QuoteLineItemTotals {
  id: EntityId;
  workOrderId: EntityId;
  sourceContractorQuoteId: EntityId | null;
  lineItems: QuoteLineItem[];
  notes: string | null;
  status: ClientQuoteStatus;
  sentAt: IsoDateTimeString | null;
  respondedAt: IsoDateTimeString | null;
  approvedAt: IsoDateTimeString | null;
  rejectedAt: IsoDateTimeString | null;
  rejectionReason: string | null;
  createdByUserId: EntityId;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface ClientPortalQuoteDetail extends QuoteLineItemTotals {
  id: EntityId;
  workOrderId: EntityId;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  status: ClientQuoteStatus;
  notes: string | null;
  lineItems: QuoteLineItem[];
  sentAt: IsoDateTimeString | null;
  respondedAt: IsoDateTimeString | null;
  approvedAt: IsoDateTimeString | null;
  rejectedAt: IsoDateTimeString | null;
  rejectionReason: string | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  workOrderNumber: string;
}
