import type { EntityId, IsoDateTimeString } from "@/types/entity";

export const INVOICE_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "overdue",
  "paid",
  "void",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number] | "issued";

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

export interface Invoice {
  id: EntityId;
  workOrderId: EntityId;
  clientOrganizationId: EntityId;
  locationId: EntityId;
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
  paidAt: IsoDateTimeString | null;
  voidedAt: IsoDateTimeString | null;
  paymentReference: string | null;
  notes: string | null;
  createdByUserId: EntityId;
  updatedByUserId: EntityId;
  qboInvoiceId: string | null;
  qboSyncStatus: QboSyncStatus | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  clientBillToName?: string;
  locationDisplayName?: string;
  issueDate?: IsoDateTimeString | null;
  paidDate?: IsoDateTimeString | null;
  subtotalAmount?: number;
  internalFinanceNotes?: string | null;
  createdBy?: string;
  lastUpdatedBy?: string;
}

export type InvoiceFormInput = Pick<
  Invoice,
  "dueDate" | "currency" | "lineItems" | "taxAmount" | "notes"
> & {
  paymentReference?: string | null;
  subtotal?: number;
  totalAmount?: number;
};
