import type {
  CreateEntityInput,
  EntityId,
  IsoDateTimeString,
  UpdateEntityInput,
} from "@/types/entity";
import type { UserRole } from "@/types/permissions";

export type QuoteStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "ready_for_client"
  | "client_approved"
  | "client_rejected"
  | "superseded";

export const CONTRACTOR_QUOTE_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "accepted",
  "rejected",
  "expired",
  "cancelled",
] as const;

export interface QuoteTotals {
  laborAmount: number;
  materialAmount: number;
  otherAmount: number;
  totalAmount: number;
}

export type ContractorQuoteStatus =
  | (typeof CONTRACTOR_QUOTE_STATUSES)[number];

export const CLIENT_QUOTE_STATUSES = [
  "draft",
  "sent",
  "approved",
  "rejected",
  "expired",
  "cancelled",
] as const;

export type ClientQuoteStatus =
  | (typeof CLIENT_QUOTE_STATUSES)[number];

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

export interface QuoteSnapshot {
  id: EntityId;
  name: string;
}

export interface ContractorQuoteOwnershipReference {
  workOrderId: EntityId;
  contractorOrganizationId: EntityId | null;
}

export interface ClientQuoteOwnershipReference {
  workOrderId: EntityId;
  clientOrganizationId: EntityId;
  locationId: EntityId;
}

export interface ContractorQuote
  extends QuoteLineItemTotals,
    ContractorQuoteOwnershipReference {
  id: EntityId;
  contractorUserId: EntityId | null;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  lineItems: QuoteLineItem[];
  notes: string | null;
  status: ContractorQuoteStatus;
  submittedAt: IsoDateTimeString | null;
  reviewedAt: IsoDateTimeString | null;
  reviewedByUserId: EntityId | null;
  rejectionReason: string | null;
  workOrderSnapshot?: QuoteSnapshot;
  contractorSnapshot?: QuoteSnapshot | null;
  organizationId: EntityId;
  recordStatus: "active" | "archived";
  isDeleted: boolean;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  createdByUserId: EntityId;
  updatedByUserId: EntityId;
  deletedAt?: IsoDateTimeString | null;
  deletedByUserId?: EntityId | null;
}

export interface ClientQuote
  extends QuoteLineItemTotals,
    ClientQuoteOwnershipReference {
  id: EntityId;
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
  workOrderSnapshot?: QuoteSnapshot;
  organizationId: EntityId;
  recordStatus: "active" | "archived";
  isDeleted: boolean;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  updatedByUserId: EntityId;
  deletedAt?: IsoDateTimeString | null;
  deletedByUserId?: EntityId | null;
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

export interface CreateContractorQuoteInput
  extends CreateEntityInput,
    ContractorQuoteOwnershipReference {
  contractorUserId?: EntityId | null;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  lineItems: QuoteLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string | null;
  status?: ContractorQuoteStatus;
}

export interface UpdateContractorQuoteInput extends UpdateEntityInput {
  workOrderId?: EntityId;
  contractorUserId?: EntityId | null;
  contractorOrganizationId?: EntityId | null;
  clientOrganizationId?: EntityId;
  locationId?: EntityId;
  lineItems?: QuoteLineItem[];
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  notes?: string | null;
  status?: ContractorQuoteStatus;
  submittedAt?: IsoDateTimeString | null;
  reviewedAt?: IsoDateTimeString | null;
  reviewedByUserId?: EntityId | null;
  rejectionReason?: string | null;
}

export interface CreateClientQuoteInput
  extends CreateEntityInput,
    ClientQuoteOwnershipReference {
  sourceContractorQuoteId?: EntityId | null;
  lineItems: QuoteLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string | null;
  status?: ClientQuoteStatus;
}

export interface UpdateClientQuoteInput extends UpdateEntityInput {
  workOrderId?: EntityId;
  clientOrganizationId?: EntityId;
  locationId?: EntityId;
  sourceContractorQuoteId?: EntityId | null;
  lineItems?: QuoteLineItem[];
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  notes?: string | null;
  status?: ClientQuoteStatus;
  sentAt?: IsoDateTimeString | null;
  respondedAt?: IsoDateTimeString | null;
  approvedAt?: IsoDateTimeString | null;
  rejectedAt?: IsoDateTimeString | null;
  rejectionReason?: string | null;
}
