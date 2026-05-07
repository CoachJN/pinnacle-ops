import { APP_PATHS } from "../../../lib/utils/constants.ts";
import type {
  DashboardSummaryCard,
  DashboardSummaryCountKey,
  DashboardSummaryCounts,
} from "./types.ts";

const SUMMARY_CARD_CONFIG: Record<
  DashboardSummaryCountKey,
  Pick<DashboardSummaryCard, "label" | "href" | "tone">
> = {
  openWorkOrders: {
    label: "Open work orders",
    href: APP_PATHS.workOrders,
    tone: "neutral",
  },
  awaitingAssignment: {
    label: "Awaiting assignment",
    href: `${APP_PATHS.workOrders}?status=client_approved`,
    tone: "attention",
  },
  awaitingContractorResponse: {
    label: "Awaiting contractor response",
    href: APP_PATHS.workOrders,
    tone: "attention",
  },
  awaitingQuoteReview: {
    label: "Awaiting quote review",
    href: `${APP_PATHS.workOrders}?status=contractor_quote_received`,
    tone: "attention",
  },
  awaitingClientAction: {
    label: "Awaiting client action",
    href: `${APP_PATHS.workOrders}?status=client_approval_requested`,
    tone: "attention",
  },
  readyForInvoicing: {
    label: "Ready for invoicing",
    href: `${APP_PATHS.finance}?view=ready_for_invoicing`,
    tone: "attention",
  },
  overdueInvoices: {
    label: "Overdue invoices",
    href: `${APP_PATHS.finance}?view=overdue`,
    tone: "risk",
  },
  activeAlerts: {
    label: "Active alerts",
    href: APP_PATHS.dashboard,
    tone: "risk",
  },
};

export function buildDashboardSummaryCards(input: {
  counts: DashboardSummaryCounts;
  order: readonly DashboardSummaryCountKey[];
}): DashboardSummaryCard[] {
  return input.order.map((key) => ({
    key,
    label: SUMMARY_CARD_CONFIG[key].label,
    value: input.counts[key],
    href: SUMMARY_CARD_CONFIG[key].href,
    tone: SUMMARY_CARD_CONFIG[key].tone,
  }));
}
