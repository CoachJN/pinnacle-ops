import type { EntityId, IsoDateTimeString } from "@/types/entity";

export type InvoiceStatus = "draft" | "issued" | "paid" | "overdue" | "void";

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
  invoiceNumber: string;
  status: InvoiceStatus;
  issueDate: IsoDateTimeString | null;
  dueDate: IsoDateTimeString;
  paidDate: IsoDateTimeString | null;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: InvoiceCurrency;
  lineItems: InvoiceLineItem[];
  internalFinanceNotes: string | null;
  paymentReference: string | null;
  clientBillToName?: string;
  locationDisplayName?: string;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  createdBy: string;
  lastUpdatedBy: string;
}

export type InvoiceFormInput = Pick<
  Invoice,
  "dueDate" | "currency" | "lineItems" | "taxAmount" | "internalFinanceNotes"
> & {
  paymentReference?: string | null;
};
