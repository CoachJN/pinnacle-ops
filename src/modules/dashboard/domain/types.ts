import type { FinanceQueueItem } from "../../finance/index.ts";
import type { OperationalAlertItem } from "../../notifications/index.ts";
import type { InternalUserRole } from "../../../types/permissions.ts";
import type {
  AssignmentStatus,
  WorkOrderPriority,
  WorkOrderStatus,
} from "../../../types/work-order.ts";

export const DASHBOARD_SUMMARY_COUNT_KEYS = [
  "openWorkOrders",
  "awaitingAssignment",
  "awaitingContractorResponse",
  "awaitingQuoteReview",
  "awaitingClientAction",
  "readyForInvoicing",
  "overdueInvoices",
  "activeAlerts",
] as const;

export type DashboardSummaryCountKey =
  (typeof DASHBOARD_SUMMARY_COUNT_KEYS)[number];

export interface DashboardSummaryCounts {
  openWorkOrders: number;
  awaitingAssignment: number;
  awaitingContractorResponse: number;
  awaitingQuoteReview: number;
  awaitingClientAction: number;
  readyForInvoicing: number;
  overdueInvoices: number;
  activeAlerts: number;
}

export interface DashboardSummaryCard {
  key: DashboardSummaryCountKey;
  label: string;
  value: number;
  href: string;
  tone: "neutral" | "attention" | "risk";
}

export interface DashboardWorkQueueItem {
  id: string;
  workOrderId: string;
  workOrderNumber: string;
  title: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  clientName: string;
  locationName: string;
  updatedAt: string;
  href: string;
  reason: string;
  assignmentStatus: AssignmentStatus | null;
}

export interface DashboardFinanceAttentionItem {
  id: string;
  href: string;
  state: FinanceQueueItem["state"];
  requiresAttention: boolean;
  workOrderId: string;
  workOrderNumber: string;
  title: string;
  clientName: string;
  locationName: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
  dueDate: string | null;
  totalAmount: number | null;
  currency: string | null;
}

export interface DashboardAtRiskItem {
  id: string;
  kind: "work_order" | "invoice" | "alert";
  title: string;
  description: string;
  href: string;
  severity: "attention" | "risk";
  updatedAt: string;
}

export interface DashboardQueueSection<TItem> {
  title: string;
  description: string;
  emptyMessage: string;
  items: TItem[];
}

export interface DashboardVisibility {
  showDispatchAttention: boolean;
  showQuoteBottlenecks: boolean;
  showFinanceAttention: boolean;
  showAtRiskItems: boolean;
  summaryCardOrder: readonly DashboardSummaryCountKey[];
  financeFirst: boolean;
}

export interface InternalDashboardData {
  generatedAt: string;
  role: InternalUserRole;
  summaryCounts: DashboardSummaryCounts;
  summaryCards: DashboardSummaryCard[];
  queueSections: {
    dispatchAttention: DashboardQueueSection<DashboardWorkQueueItem>;
    quoteBottlenecks: DashboardQueueSection<DashboardWorkQueueItem>;
    financeAttention: DashboardQueueSection<DashboardFinanceAttentionItem>;
    atRiskItems: DashboardQueueSection<DashboardAtRiskItem>;
  };
  alerts: readonly OperationalAlertItem[];
  visibility: DashboardVisibility;
}
