import { invoiceOverdueScenario } from "./invoice-overdue.ts";
import { optimizationRankingScenario } from "./optimization-ranking.ts";
import { quoteRejectionScenario } from "./quote-rejection.ts";
import { slaBreachScenario } from "./sla-breach.ts";
import { systemTransitionsScenario } from "./system-transitions.ts";
import { unauthorizedAttemptsScenario } from "./unauthorized-attempts.ts";
import { workOrderNoQuoteScenario } from "./work-order-no-quote.ts";
import { workOrderStandardScenario } from "./work-order-standard.ts";

export const allWorkflowVerificationScenarios = [
  workOrderStandardScenario,
  workOrderNoQuoteScenario,
  quoteRejectionScenario,
  invoiceOverdueScenario,
  unauthorizedAttemptsScenario,
  systemTransitionsScenario,
  slaBreachScenario,
  optimizationRankingScenario,
] as const;

export {
  invoiceOverdueScenario,
  optimizationRankingScenario,
  quoteRejectionScenario,
  slaBreachScenario,
  systemTransitionsScenario,
  unauthorizedAttemptsScenario,
  workOrderNoQuoteScenario,
  workOrderStandardScenario,
};
