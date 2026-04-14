export const financeModule = {
  name: "finance",
  routeBasePath: "/finance",
} as const;

export {
  FINANCE_QUEUE_FILTERS,
  FINANCE_QUEUE_STATES,
  FINANCE_QUEUE_INVOICE_STATUSES,
  INVOICE_CREATION_ELIGIBLE_WORK_ORDER_STATUSES,
  INVOICE_DUPLICATION_POLICY,
  INVOICE_TERMINAL_STATUSES,
  buildInvoiceCreationEligibility,
  financeQueuePriority,
  getFinanceQueueStateForInvoiceStatus,
  isInvoiceEditable,
  isTerminalInvoiceStatus,
  isWorkOrderEligibleForInvoiceCreation,
  type FinanceQueueFilter,
  type FinanceQueueState,
  type InvoiceCreationEligibility,
  type InvoiceDuplicationPolicy,
} from "./domain/invoice-rules.ts";
export {
  buildFinanceQueue,
  filterFinanceQueueItems,
  type FinanceQueueInvoiceRecord,
  type FinanceQueueItem,
  type FinanceQueueWorkOrderRecord,
} from "./domain/finance-queue.ts";
export {
  parseFinanceQueueFilter,
  type FinanceQueueFilterParseResult,
} from "./validation/finance-queue.ts";
