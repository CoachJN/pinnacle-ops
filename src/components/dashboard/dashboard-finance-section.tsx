import Link from "next/link";
import type { DashboardFinanceAttentionItem, DashboardQueueSection } from "@/modules/dashboard";
import { DashboardEmptyState } from "./dashboard-empty-state";

export function DashboardFinanceSection({
  section,
}: {
  section: DashboardQueueSection<DashboardFinanceAttentionItem>;
}) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-neutral-950">{section.title}</h2>
        <p className="mt-1 text-sm text-neutral-600">{section.description}</p>
      </div>

      {section.items.length === 0 ? (
        <div className="mt-6">
          <DashboardEmptyState message={section.emptyMessage} />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {section.items.map((item) => (
            <Link
              className="block rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 transition hover:border-neutral-300 hover:bg-white"
              href={item.href}
              key={item.id}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-neutral-950">
                    {item.workOrderNumber} · {item.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-neutral-600">
                    {item.invoiceNumber
                      ? `${item.invoiceNumber} is ${item.state.replaceAll("_", " ")}.`
                      : "Completed work is ready for invoice creation."}
                  </p>
                </div>
                <span className="rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-600">
                  {item.state.replaceAll("_", " ")}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-500">
                <span>{item.clientName}</span>
                <span>{item.locationName}</span>
                {item.totalAmount != null && item.currency ? (
                  <span>
                    {formatMoney(item.totalAmount, item.currency)}
                  </span>
                ) : null}
                {item.dueDate ? <span>Due {formatDate(item.dueDate)}</span> : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
