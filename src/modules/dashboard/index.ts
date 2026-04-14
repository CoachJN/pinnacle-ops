export const dashboardModule = {
  name: "dashboard",
  routeBasePath: "/dashboard",
} as const;

export {
  buildDashboardSummaryCards,
} from "./domain/summary.ts";
export type {
  DashboardAtRiskItem,
  DashboardFinanceAttentionItem,
  DashboardQueueSection,
  DashboardSummaryCard,
  DashboardSummaryCountKey,
  DashboardSummaryCounts,
  DashboardVisibility,
  DashboardWorkQueueItem,
  InternalDashboardData,
} from "./domain/types.ts";
export {
  DASHBOARD_SUMMARY_COUNT_KEYS,
} from "./domain/types.ts";
export {
  buildDashboardData,
  buildInternalDashboard,
  type BuildDashboardDataInput,
  type BuildInternalDashboardParams,
} from "./server/build-dashboard.ts";
export {
  getDashboardVisibilityForRole,
} from "./server/role-visibility.ts";
