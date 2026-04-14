import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractorShell } from "@/components/contractor-portal/contractor-shell";
import { ContractorWorkOrderList } from "@/components/contractor-portal/contractor-work-order-list";
import { getContractorDashboardData } from "@/lib/contractors/projections";
import { getMockContractorCurrentUser } from "@/lib/permissions/contractor-session";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ContractorDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const currentUser = await getMockContractorCurrentUser(
    readParam(params.contractorId),
  );
  if (!currentUser) {
    notFound();
  }

  const dashboard = await getContractorDashboardData(currentUser.contractorId);
  const query = `contractorId=${currentUser.contractorId}`;

  return (
    <ContractorShell currentUser={currentUser}>
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
              Contractor dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
              Assigned work
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-600">
              Quote requests and active jobs assigned to your company.
            </p>
          </div>
          <Link href={`/contractor/work-orders?${query}`} className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
            View assigned work orders
          </Link>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <SummaryCard label="Assigned work orders" value={dashboard.summaries.assigned} href={`/contractor/work-orders?${query}`} />
          <SummaryCard label="Quote requested" value={dashboard.summaries.quoteRequested} href={`/contractor/work-orders?filter=quote_requested&${query}`} />
          <SummaryCard label="Approved to proceed" value={dashboard.summaries.approvedToProceed} href={`/contractor/work-orders?filter=approved_to_proceed&${query}`} />
          <SummaryCard label="In progress" value={dashboard.summaries.inProgress} href={`/contractor/work-orders?filter=in_progress&${query}`} />
        </section>

        <QueueSection title="Needs quote from you" items={dashboard.needsQuote} contractorId={currentUser.contractorId} />
        <QueueSection title="Ready to perform" items={dashboard.readyToPerform} contractorId={currentUser.contractorId} />
        <QueueSection title="Active work" items={dashboard.activeWork} contractorId={currentUser.contractorId} />
      </div>
    </ContractorShell>
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
  contractorId,
}: {
  title: string;
  items: Parameters<typeof ContractorWorkOrderList>[0]["items"];
  contractorId: string;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-neutral-950">{title}</h2>
      <div className="mt-4">
        <ContractorWorkOrderList items={items} contractorId={contractorId} />
      </div>
    </section>
  );
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
