import { cn } from "@/lib/utils";
import type { WorkOrderFinancialSummary } from "./work-order-financial-model";

export function WorkOrderFinancialReadinessPanel({
  summary,
}: {
  summary: WorkOrderFinancialSummary;
}) {
  return (
    <section className="rounded-[1.75rem] border border-neutral-200 bg-[linear-gradient(135deg,#fffdf8,#ffffff_45%,#f7f6f3)] p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Financial readiness
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
            {summary.nextAction.label}
          </h2>
          <p className="mt-2 text-sm text-neutral-600">{summary.nextAction.detail}</p>
        </div>
        <StatusPill
          detail={summary.nextAction.detail}
          label={summary.nextAction.label}
          tone={summary.nextAction.tone}
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatusCard
          description={summary.quoteRequirement.detail}
          label="Quote requirement"
          value={summary.quoteRequirement.label}
          tone={summary.quoteRequirement.tone}
        />
        <StatusCard
          description={summary.contractorQuote.detail}
          label="Contractor quote"
          value={summary.contractorQuote.label}
          tone={summary.contractorQuote.tone}
        />
        <StatusCard
          description={summary.clientQuote.detail}
          label="Client quote"
          value={summary.clientQuote.label}
          tone={summary.clientQuote.tone}
        />
        <StatusCard
          description={summary.invoiceReadiness.detail}
          label="Invoice readiness"
          value={summary.invoiceReadiness.label}
          tone={summary.invoiceReadiness.tone}
        />
        <StatusCard
          description={summary.invoiceStatus.qboDetail ?? summary.invoiceStatus.detail}
          label="Invoice status"
          value={summary.invoiceStatus.label}
          tone={summary.invoiceStatus.tone}
        />
      </div>
    </section>
  );
}

function StatusCard({
  description,
  label,
  tone,
  value,
}: {
  description: string;
  label: string;
  tone: "danger" | "neutral" | "success" | "warning";
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white/90 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </p>
      <div className="mt-3">
        <StatusPill detail={description} label={value} tone={tone} />
      </div>
      <p className="mt-3 text-sm leading-6 text-neutral-600">{description}</p>
    </div>
  );
}

function StatusPill({
  detail,
  label,
  tone,
}: {
  detail?: string;
  label: string;
  tone: "danger" | "neutral" | "success" | "warning";
}) {
  return (
    <span
      aria-label={detail}
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
        toneClasses[tone],
      )}
    >
      {label}
    </span>
  );
}

const toneClasses = {
  danger: "border-rose-200 bg-rose-50 text-rose-800",
  neutral: "border-neutral-200 bg-neutral-100 text-neutral-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
} as const;
