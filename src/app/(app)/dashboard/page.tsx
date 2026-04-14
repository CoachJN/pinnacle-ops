import { DashboardBottlenecksSection } from "@/components/dashboard/dashboard-bottlenecks-section";
import { DashboardFinanceSection } from "@/components/dashboard/dashboard-finance-section";
import { DashboardQueueSection } from "@/components/dashboard/dashboard-queue-section";
import { DashboardSummaryCards } from "@/components/dashboard/dashboard-summary-cards";
import { OperationalAlertsPanel } from "@/components/shared/notifications/operational-alerts-panel";
import { requireUserWithRole } from "@/lib/auth/guards";
import { APP_ROLE_LABELS, INTERNAL_APP_ROLES } from "@/lib/rbac/roles";
import { buildInternalDashboard } from "@/modules/dashboard";
import { getWorkOrderApiContext } from "@/server/api/work-orders";

export default async function DashboardPage() {
  const currentUser = await requireUserWithRole(INTERNAL_APP_ROLES);
  const context = await getWorkOrderApiContext();
  if (context.actor.actorType !== "internal") {
    throw new Error("Dashboard route requires an internal actor.");
  }

  const dashboard = await buildInternalDashboard({
    context: {
      actor: context.actor,
      services: context.services,
      repositories: context.repositories,
    },
  });

  return (
    <section className="space-y-8">
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Dashboard
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
          Internal operations overview
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-neutral-600">
          Queue health, finance follow-up, and operational risk are shaped from
          the canonical internal systems so the next action is easy to spot.
        </p>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Role
            </dt>
            <dd className="mt-2 text-base font-semibold text-neutral-950">
              {APP_ROLE_LABELS[currentUser.role]}
            </dd>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Active alerts
            </dt>
            <dd className="mt-2 text-base font-semibold text-neutral-950">
              {dashboard.summaryCounts.activeAlerts}
            </dd>
          </div>
        </dl>
      </div>

      <DashboardSummaryCards cards={dashboard.summaryCards} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(22rem,1fr)]">
        <div className="space-y-4">
          {dashboard.visibility.financeFirst &&
          dashboard.visibility.showFinanceAttention ? (
            <DashboardFinanceSection section={dashboard.queueSections.financeAttention} />
          ) : null}

          {dashboard.visibility.showDispatchAttention ? (
            <DashboardQueueSection section={dashboard.queueSections.dispatchAttention} />
          ) : null}

          {dashboard.visibility.showQuoteBottlenecks ? (
            <DashboardQueueSection section={dashboard.queueSections.quoteBottlenecks} />
          ) : null}

          {!dashboard.visibility.financeFirst &&
          dashboard.visibility.showFinanceAttention ? (
            <DashboardFinanceSection section={dashboard.queueSections.financeAttention} />
          ) : null}
        </div>

        <div className="space-y-4">
          <OperationalAlertsPanel alerts={dashboard.alerts} />
          {dashboard.visibility.showAtRiskItems ? (
            <DashboardBottlenecksSection section={dashboard.queueSections.atRiskItems} />
          ) : null}
        </div>
      </div>
    </section>
  );
}
