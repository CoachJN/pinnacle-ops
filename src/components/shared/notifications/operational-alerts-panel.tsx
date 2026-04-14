import Link from "next/link";
import type { OperationalAlertItem } from "@/modules/notifications";

const STATE_STYLES: Record<OperationalAlertItem["state"], string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  at_risk: "border-amber-200 bg-amber-50 text-amber-700",
  overdue: "border-orange-200 bg-orange-50 text-orange-700",
  sla_breached: "border-rose-200 bg-rose-50 text-rose-700",
};

export function OperationalAlertsPanel({
  alerts,
}: {
  alerts: readonly OperationalAlertItem[];
}) {
  return (
    <aside className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-950">
            Operational alerts
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Routed internal follow-up for the signed-in operator.
          </p>
        </div>
        <span className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
          {alerts.length} active
        </span>
      </div>

      {alerts.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-5 text-sm text-neutral-600">
          No active operational alerts are routed to you right now.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {alerts.map((alert) => (
            <Link
              className="block rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 transition hover:border-neutral-300 hover:bg-white"
              href={alert.targetPath}
              key={alert.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-950">
                    {alert.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-neutral-600">
                    {alert.message}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${STATE_STYLES[alert.state]}`}
                >
                  {alert.state.replaceAll("_", " ")}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-500">
                <span>{alert.actorDisplayName}</span>
                <span>{formatTimestamp(alert.createdAt)}</span>
                {alert.dueAt ? <span>Due {formatTimestamp(alert.dueAt)}</span> : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </aside>
  );
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
