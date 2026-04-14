import type {
  AuditableEntity,
  CreateEntityInput,
  EntityId,
  IsoDateTimeString,
  UpdateEntityInput,
} from "@/types/entity";

export type CurrencyCode = "USD" | "CAD";
export type MoneyAmountCents = number;

export type ContractorQuoteStatus =
  | "draft"
  | "submitted"
  | "accepted"
  | "rejected"
  | "expired"
  | "cancelled";

export interface ContractorQuoteOwnershipReference {
  workOrderId: EntityId;
  contractorOrganizationId: EntityId;
}

export interface ContractorQuote
  extends AuditableEntity,
    ContractorQuoteOwnershipReference {
  quoteNumber?: string;
  status: ContractorQuoteStatus;
  currencyCode: CurrencyCode;
  scopeOfWork: string;
  subtotalAmountCents: MoneyAmountCents;
  taxAmountCents?: MoneyAmountCents;
  totalAmountCents: MoneyAmountCents;
  submittedAt?: IsoDateTimeString;
  expiresAt?: IsoDateTimeString;
}

export interface CreateContractorQuoteInput
  extends CreateEntityInput,
    ContractorQuoteOwnershipReference {
  quoteNumber?: string;
  status?: ContractorQuoteStatus;
  currencyCode: CurrencyCode;
  scopeOfWork: string;
  subtotalAmountCents: MoneyAmountCents;
  taxAmountCents?: MoneyAmountCents;
  totalAmountCents: MoneyAmountCents;
  submittedAt?: IsoDateTimeString;
  expiresAt?: IsoDateTimeString;
}

export interface UpdateContractorQuoteInput extends UpdateEntityInput {
  workOrderId?: EntityId;
  contractorOrganizationId?: EntityId;
  quoteNumber?: string;
  status?: ContractorQuoteStatus;
  currencyCode?: CurrencyCode;
  scopeOfWork?: string;
  subtotalAmountCents?: MoneyAmountCents;
  taxAmountCents?: MoneyAmountCents;
  totalAmountCents?: MoneyAmountCents;
  submittedAt?: IsoDateTimeString;
  expiresAt?: IsoDateTimeString;
}

export type ClientQuoteStatus =
  | "draft"
  | "sent"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";

export interface ClientQuoteOwnershipReference {
  workOrderId: EntityId;
  clientOrganizationId: EntityId;
  locationId: EntityId;
}

export interface ClientQuote extends AuditableEntity, ClientQuoteOwnershipReference {
  contractorQuoteId?: EntityId;
  quoteNumber?: string;
  status: ClientQuoteStatus;
  currencyCode: CurrencyCode;
  scopeOfWork: string;
  subtotalAmountCents: MoneyAmountCents;
  taxAmountCents?: MoneyAmountCents;
  totalAmountCents: MoneyAmountCents;
  sentAt?: IsoDateTimeString;
  respondedAt?: IsoDateTimeString;
  expiresAt?: IsoDateTimeString;
}

export interface CreateClientQuoteInput
  extends CreateEntityInput,
    ClientQuoteOwnershipReference {
  contractorQuoteId?: EntityId;
  quoteNumber?: string;
  status?: ClientQuoteStatus;
  currencyCode: CurrencyCode;
  scopeOfWork: string;
  subtotalAmountCents: MoneyAmountCents;
  taxAmountCents?: MoneyAmountCents;
  totalAmountCents: MoneyAmountCents;
  sentAt?: IsoDateTimeString;
  respondedAt?: IsoDateTimeString;
  expiresAt?: IsoDateTimeString;
}

export interface UpdateClientQuoteInput extends UpdateEntityInput {
  workOrderId?: EntityId;
  clientOrganizationId?: EntityId;
  locationId?: EntityId;
  contractorQuoteId?: EntityId;
  quoteNumber?: string;
  status?: ClientQuoteStatus;
  currencyCode?: CurrencyCode;
  scopeOfWork?: string;
  subtotalAmountCents?: MoneyAmountCents;
  taxAmountCents?: MoneyAmountCents;
  totalAmountCents?: MoneyAmountCents;
  sentAt?: IsoDateTimeString;
  respondedAt?: IsoDateTimeString;
  expiresAt?: IsoDateTimeString;
}

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "sent"
  | "overdue"
  | "disputed"
  | "resolved"
  | "paid"
  | "void"
  | "cancelled";

export interface InvoiceOwnershipReference {
  workOrderId: EntityId;
  clientOrganizationId: EntityId;
  locationId: EntityId;
}

export interface Invoice extends AuditableEntity, InvoiceOwnershipReference {
  contractorOrganizationId?: EntityId;
  clientQuoteId?: EntityId;
  invoiceNumber?: string;
  status: InvoiceStatus;
  currencyCode: CurrencyCode;
  subtotalAmountCents: MoneyAmountCents;
  taxAmountCents?: MoneyAmountCents;
  totalAmountCents: MoneyAmountCents;
  issuedAt?: IsoDateTimeString;
  dueAt?: IsoDateTimeString;
  overdueAt?: IsoDateTimeString;
  disputedAt?: IsoDateTimeString;
  resolvedAt?: IsoDateTimeString;
  paidAt?: IsoDateTimeString;
}

export interface CreateInvoiceInput
  extends CreateEntityInput,
    InvoiceOwnershipReference {
  contractorOrganizationId?: EntityId;
  clientQuoteId?: EntityId;
  invoiceNumber?: string;
  status?: InvoiceStatus;
  currencyCode: CurrencyCode;
  subtotalAmountCents: MoneyAmountCents;
  taxAmountCents?: MoneyAmountCents;
  totalAmountCents: MoneyAmountCents;
  issuedAt?: IsoDateTimeString;
  dueAt?: IsoDateTimeString;
  overdueAt?: IsoDateTimeString;
  disputedAt?: IsoDateTimeString;
  resolvedAt?: IsoDateTimeString;
  paidAt?: IsoDateTimeString;
}

export interface UpdateInvoiceInput extends UpdateEntityInput {
  workOrderId?: EntityId;
  clientOrganizationId?: EntityId;
  locationId?: EntityId;
  contractorOrganizationId?: EntityId;
  clientQuoteId?: EntityId;
  invoiceNumber?: string;
  status?: InvoiceStatus;
  currencyCode?: CurrencyCode;
  subtotalAmountCents?: MoneyAmountCents;
  taxAmountCents?: MoneyAmountCents;
  totalAmountCents?: MoneyAmountCents;
  issuedAt?: IsoDateTimeString;
  dueAt?: IsoDateTimeString;
  overdueAt?: IsoDateTimeString;
  disputedAt?: IsoDateTimeString;
  resolvedAt?: IsoDateTimeString;
  paidAt?: IsoDateTimeString;
}
