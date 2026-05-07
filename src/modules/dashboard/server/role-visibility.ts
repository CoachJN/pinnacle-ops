import "server-only";

import { APP_ROLES } from "../../../lib/rbac/roles.ts";
import type { InternalUserRole } from "../../../types/permissions.ts";
import type { DashboardVisibility } from "../domain/types.ts";

export function getDashboardVisibilityForRole(
  role: InternalUserRole,
): DashboardVisibility {
  switch (role) {
    case APP_ROLES.Coordinator:
      return {
        showDispatchAttention: true,
        showQuoteBottlenecks: true,
        showFinanceAttention: false,
        showAtRiskItems: true,
        summaryCardOrder: [
          "openWorkOrders",
          "awaitingAssignment",
          "awaitingContractorResponse",
          "awaitingQuoteReview",
          "awaitingClientAction",
          "activeAlerts",
        ],
        financeFirst: false,
      };
    case APP_ROLES.Manager:
      return {
        showDispatchAttention: true,
        showQuoteBottlenecks: true,
        showFinanceAttention: false,
        showAtRiskItems: true,
        summaryCardOrder: [
          "openWorkOrders",
          "awaitingAssignment",
          "awaitingContractorResponse",
          "awaitingQuoteReview",
          "awaitingClientAction",
          "activeAlerts",
        ],
        financeFirst: false,
      };
    case APP_ROLES.FinanceAdmin:
      return {
        showDispatchAttention: false,
        showQuoteBottlenecks: false,
        showFinanceAttention: true,
        showAtRiskItems: true,
        summaryCardOrder: [
          "readyForInvoicing",
          "overdueInvoices",
          "activeAlerts",
          "openWorkOrders",
          "awaitingClientAction",
        ],
        financeFirst: true,
      };
    case APP_ROLES.Owner:
      return {
        showDispatchAttention: true,
        showQuoteBottlenecks: true,
        showFinanceAttention: true,
        showAtRiskItems: true,
        summaryCardOrder: [
          "openWorkOrders",
          "awaitingAssignment",
          "awaitingContractorResponse",
          "awaitingQuoteReview",
          "awaitingClientAction",
          "readyForInvoicing",
          "overdueInvoices",
          "activeAlerts",
        ],
        financeFirst: false,
      };
  }
}
