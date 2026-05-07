import type {
  CreateEntityInput,
  EntityId,
  IsoDateTimeString,
  UpdateEntityInput,
} from "@/types/entity";

export const INVOICE_STATUSES = [
  "draft",
  "issued",
  "sent",
  "viewed",
  "overdue",
  "disputed",
  "resolved",
  "paid",
  "void",
  "cancelled",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const QBO_SYNC_STATUSES = [
  "pending",
  "synced",
  "failed",
] as const;

export type QboSyncStatus = (typeof QBO_SYNC_STATUSES)[number];

export type InvoiceCurrency = "CAD" | "USD";

export interface InvoiceLineItem {
  id: EntityId;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface InvoiceSnapshot {
  id: EntityId;
  name: string;
}

export type ContractorInvoiceStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "paid"
  | "cancelled";

export interface InvoiceOwnershipReference {
  workOrderId: EntityId;
  clientOrganizationId: EntityId;
  locationId: EntityId;
}

export interface ClientInvoice
  extends InvoiceOwnershipReference {
  id: EntityId;
  invoiceNumber: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: InvoiceCurrency;
  status: InvoiceStatus;
  issuedDate: IsoDateTimeString | null;
  dueDate: IsoDateTimeString;
  sentAt: IsoDateTimeString | null;
  viewedAt: IsoDateTimeString | null;
  overdueAt?: IsoDateTimeString | null;
  disputedAt?: IsoDateTimeString | null;
  resolvedAt?: IsoDateTimeString | null;
  paidAt: IsoDateTimeString | null;
  voidedAt: IsoDateTimeString | null;
  paymentReference: string | null;
  notes: string | null;
  qboInvoiceId: string | null;
  qboSyncStatus: QboSyncStatus | null;
  workOrderSnapshot?: InvoiceSnapshot;
  clientSnapshot?: InvoiceSnapshot;
  locationSnapshot?: InvoiceSnapshot;
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

export interface ContractorInvoice {
  id: EntityId;
  workOrderId: EntityId;
  contractorOrganizationId: EntityId;
  sourceClientInvoiceId?: EntityId | null;
  sourceClientQuoteId?: EntityId | null;
  invoiceNumber?: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: InvoiceCurrency;
  status: ContractorInvoiceStatus;
  submittedAt?: IsoDateTimeString | null;
  approvedAt?: IsoDateTimeString | null;
  rejectedAt?: IsoDateTimeString | null;
  paidAt?: IsoDateTimeString | null;
  rejectionReason?: string | null;
  notes?: string | null;
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

export interface CreateClientInvoiceInput
  extends CreateEntityInput,
    InvoiceOwnershipReference {
  invoiceNumber?: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: InvoiceCurrency;
  dueDate: IsoDateTimeString;
  status?: InvoiceStatus;
  notes?: string | null;
  paymentReference?: string | null;
}

export interface UpdateClientInvoiceInput extends UpdateEntityInput {
  workOrderId?: EntityId;
  clientOrganizationId?: EntityId;
  locationId?: EntityId;
  invoiceNumber?: string;
  lineItems?: InvoiceLineItem[];
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  currency?: InvoiceCurrency;
  status?: InvoiceStatus;
  issuedDate?: IsoDateTimeString | null;
  dueDate?: IsoDateTimeString;
  sentAt?: IsoDateTimeString | null;
  viewedAt?: IsoDateTimeString | null;
  overdueAt?: IsoDateTimeString | null;
  disputedAt?: IsoDateTimeString | null;
  resolvedAt?: IsoDateTimeString | null;
  paidAt?: IsoDateTimeString | null;
  voidedAt?: IsoDateTimeString | null;
  paymentReference?: string | null;
  notes?: string | null;
  qboInvoiceId?: string | null;
  qboSyncStatus?: QboSyncStatus | null;
}

export interface CreateContractorInvoiceInput extends CreateEntityInput {
  workOrderId: EntityId;
  contractorOrganizationId: EntityId;
  sourceClientInvoiceId?: EntityId | null;
  sourceClientQuoteId?: EntityId | null;
  invoiceNumber?: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: InvoiceCurrency;
  status?: ContractorInvoiceStatus;
  notes?: string | null;
}

export interface UpdateContractorInvoiceInput extends UpdateEntityInput {
  workOrderId?: EntityId;
  contractorOrganizationId?: EntityId;
  sourceClientInvoiceId?: EntityId | null;
  sourceClientQuoteId?: EntityId | null;
  invoiceNumber?: string;
  lineItems?: InvoiceLineItem[];
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  currency?: InvoiceCurrency;
  status?: ContractorInvoiceStatus;
  submittedAt?: IsoDateTimeString | null;
  approvedAt?: IsoDateTimeString | null;
  rejectedAt?: IsoDateTimeString | null;
  paidAt?: IsoDateTimeString | null;
  rejectionReason?: string | null;
  notes?: string | null;
}

export type ClientInvoiceFormInput = Pick<
  ClientInvoice,
  "dueDate" | "currency" | "lineItems" | "taxAmount" | "notes"
> & {
  paymentReference?: string | null;
  subtotal?: number;
  totalAmount?: number;
};
