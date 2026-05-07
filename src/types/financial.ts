export type CurrencyCode = "USD" | "CAD";
export type MoneyAmountCents = number;

export interface MonetaryAmount {
  currencyCode: CurrencyCode;
  amountCents: MoneyAmountCents;
}

export interface MonetaryTotals {
  subtotalAmountCents: MoneyAmountCents;
  taxAmountCents?: MoneyAmountCents;
  totalAmountCents: MoneyAmountCents;
  currencyCode: CurrencyCode;
}

export interface FinanceReportWindow {
  from: string;
  to: string;
}

export interface FinanceQueueSummary {
  readyForInvoicingCount: number;
  draftInvoiceCount: number;
  overdueInvoiceCount: number;
  paidInvoiceCount: number;
}
