import Link from "next/link";
import { ContractorWorkOrderList } from "@/components/contractor-portal/contractor-work-order-list";
import {
  getContractorPortalLandingSummary,
  listContractorPortalWorkOrders,
} from "@/modules/contractors/server/contractor-portal";

export default async function ContractorDashboardPage() {
  const [summary, workOrders] = await Promise.all([
    getContractorPortalLandingSummary(),
    listContractorPortalWorkOrders(),
  ]);
  const needsQuote = workOrders.filter((item) => item.quoteActionNeeded).slice(0, 5);
  const readyToPerform = workOrders.filter(
    (item) => item.assignment.status === "accepted" && item.status !== "completed" && item.status !== "closed",
  ).slice(0, 5);
  const recentlyUpdated = workOrders.slice(0, 5);
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-5 rounded-[2rem] border border-cyan-100 bg-white p-6 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Contractor dashboard
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Active assigned work
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Respond to new assignments, submit quotes when requested, and keep active jobs moving.
          </p>
        </div>
        <Link href="/contractor/work-orders" className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
          View assigned work orders
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Assigned work orders" value={summary.assignedWorkOrderCount} href="/contractor/work-orders" />
        <SummaryCard label="Quote requested" value={summary.quoteRequestedCount} href="/contractor/work-orders?filter=quote_requested" />
        <SummaryCard label="Ready to perform" value={summary.readyToPerformCount} href="/contractor/work-orders?filter=approved_to_proceed" />
        <SummaryCard label="Recently updated" value={summary.recentlyUpdatedAssignments} href="/contractor/work-orders" />
      </section>

      <QueueSection title="Needs quote from you" items={needsQuote} />
      <QueueSection title="Ready to perform" items={readyToPerform} />
      <QueueSection title="Recently updated assignments" items={recentlyUpdated} />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link href={href} className="rounded-lg border border-neutral-200 bg-white p-5 hover:border-neutral-400">
      <p className="text-sm font-medium text-neutral-600">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950">
        {value}
      </p>
    </Link>
  );
}

function QueueSection({
  title,
  items,
}: {
  title: string;
  items: Parameters<typeof ContractorWorkOrderList>[0]["items"];
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-neutral-950">{title}</h2>
      <div className="mt-4">
        <ContractorWorkOrderList items={items} />
      </div>
    </section>
  );
}
