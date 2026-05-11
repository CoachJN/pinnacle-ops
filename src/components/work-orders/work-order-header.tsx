"use client";

import Link from "next/link";
import { WorkOrderStatusPill } from "./work-order-status-pill";

interface WorkOrderHeaderProps {
  agingLabel: string;
  assignedContractorLabel: string;
  coordinatorLabel: string;
  createInvoiceHref: string | null;
  financialSignalLabel?: string | null;
  managerLabel: string;
  nextActionLabel: string;
  onOpenAddNote: () => void;
  onOpenAssignment: () => void;
  onOpenQuoteWorkflow: () => void;
  onOpenStatusActions: () => void;
  priorityLabel: string;
  priorityToneClassName: string;
  riskLabel: string | null;
  statusLabel: string;
  statusToneClassName: string;
  title: string;
  workOrderNumber: string;
}

export function WorkOrderHeader({
  agingLabel,
  assignedContractorLabel,
  coordinatorLabel,
  createInvoiceHref,
  financialSignalLabel,
  managerLabel,
  nextActionLabel,
  onOpenAddNote,
  onOpenAssignment,
  onOpenQuoteWorkflow,
  onOpenStatusActions,
  priorityLabel,
  priorityToneClassName,
  riskLabel,
  statusLabel,
  statusToneClassName,
  title,
  workOrderNumber,
}: WorkOrderHeaderProps) {
  return (
    <section className="sticky top-0 z-30 -mx-4 border-b border-neutral-200 bg-[linear-gradient(180deg,rgba(250,250,249,0.98),rgba(255,255,255,0.94))] px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="border border-neutral-200/80 bg-white/95 shadow-[0_16px_48px_-36px_rgba(10,10,10,0.4)] backdrop-blur">
        <div className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)_auto] xl:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-500">
              {workOrderNumber}
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-[2rem]">
              {title}
            </h1>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusToneClassName}`}
              >
                {statusLabel}
              </span>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${priorityToneClassName}`}
              >
                {priorityLabel} priority
              </span>
              <WorkOrderStatusPill tone="muted">{`Next: ${nextActionLabel}`}</WorkOrderStatusPill>
              {financialSignalLabel ? (
                <WorkOrderStatusPill tone="warning">
                  {financialSignalLabel}
                </WorkOrderStatusPill>
              ) : null}
              {riskLabel ? (
                <WorkOrderStatusPill tone="critical">
                  {riskLabel}
                </WorkOrderStatusPill>
              ) : null}
            </div>
          </div>

          <dl className="grid gap-x-4 gap-y-2 border-y border-neutral-200 py-3 sm:grid-cols-2 xl:grid-cols-4 xl:border-y-0 xl:py-0">
            <Metric label="Coordinator" value={coordinatorLabel} />
            <Metric label="Manager" value={managerLabel} />
            <Metric label="Contractor" value={assignedContractorLabel} />
            <Metric label="Aging" value={agingLabel} />
          </dl>

          <div className="flex flex-wrap items-start justify-start gap-2 xl:max-w-sm xl:justify-end">
            <ActionButton label="Change Status" onClick={onOpenStatusActions} />
            <ActionButton label="Assign" onClick={onOpenAssignment} />
            <ActionButton label="Add Note" onClick={onOpenAddNote} />
            <ActionButton label="Create Quote" onClick={onOpenQuoteWorkflow} />
            {createInvoiceHref ? (
              <Link
                className="inline-flex items-center justify-center rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
                href={createInvoiceHref}
              >
                Create Invoice
              </Link>
            ) : (
              <span className="inline-flex cursor-not-allowed items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100 px-4 py-2.5 text-sm font-semibold text-neutral-400">
                Create Invoice
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ActionButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:border-neutral-500 hover:text-neutral-950"
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-neutral-950">{value}</dd>
    </div>
  );
}
