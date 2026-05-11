import { WorkOrderCompactRow } from "./work-order-compact-row";
import { formatDateTime } from "./formatting";
import type { WorkOrderFilesSummary } from "./work-order-files-model";

interface WorkOrderFilesSummaryPanelProps {
  summary: WorkOrderFilesSummary;
}

export function WorkOrderFilesSummaryPanel({
  summary,
}: WorkOrderFilesSummaryPanelProps) {
  return (
    <section className="border border-neutral-200 bg-[linear-gradient(135deg,#fffefb,#ffffff_45%,#f6f7f5)] px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Files summary
          </p>
          <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-neutral-950">
            {summary.totalAttachments} attached file
            {summary.totalAttachments === 1 ? "" : "s"}
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Photos, documents, and other uploaded records tied to this work
            order.
          </p>
        </div>
        <span className="inline-flex rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700">
          {summary.mostRecentUploadAt
            ? `Latest upload ${formatDateTime(summary.mostRecentUploadAt)}`
            : "No uploads yet"}
        </span>
      </div>

      <dl className="mt-4 grid gap-x-5 gap-y-1 border-t border-neutral-200 pt-3 sm:grid-cols-2">
        <SummaryMetric
          label="Total files"
          value={String(summary.totalAttachments)}
        />
        <SummaryMetric
          label="Photos / Images"
          value={String(summary.imageCount)}
        />
        <SummaryMetric
          label="Documents"
          value={String(summary.documentCount)}
        />
        <SummaryMetric label="Other files" value={String(summary.otherCount)} />
        <SummaryMetric
          label="Most recent upload"
          value={
            summary.mostRecentUploadAt
              ? formatDateTime(summary.mostRecentUploadAt)
              : "Not available"
          }
        />
      </dl>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return <WorkOrderCompactRow label={label} value={value} />;
}
