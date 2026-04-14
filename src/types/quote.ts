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
