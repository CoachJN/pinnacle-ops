import Link from "next/link";
import { notFound } from "next/navigation";
import { InternalShell } from "@/components/internal/internal-shell";
import { DetailField, DetailSection } from "@/components/work-orders/detail-section";
import { EmptyState } from "@/components/work-orders/empty-state";
import { formatDateTime } from "@/components/work-orders/formatting";
import { InternalWorkOrderTable } from "@/components/work-orders/internal-work-order-table";
import {
  getContractorById,
  listWorkOrdersForContractor,
} from "@/lib/contractors/repository";
import {
  canEditContractor,
  canViewContractorModule,
} from "@/lib/permissions/contractor-permissions";
import { getMockCurrentUser } from "@/lib/permissions/mock-current-user";
import type { ContractorStatus } from "@/types/contractor";

type Params = Promise<{ contractorId?: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ContractorDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ contractorId }, query] = await Promise.all([params, searchParams]);
  if (!contractorId || !contractorId.trim()) {
    notFound();
  }

  const currentUser = getMockCurrentUser(readParam(query.role));
  const [contractor, workOrders] = await Promise.all([
    getContractorById(contractorId),
    listWorkOrdersForContractor(contractorId),
  ]);

  if (!contractor) {
    notFound();
  }

  return (
    <InternalShell currentUser={currentUser}>
      <div className="mx-auto max-w-5xl">
        <Link href={`/contractors?role=${currentUser.role}`} className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline">
          Back to contractors
        </Link>

        {!canViewContractorModule(currentUser.role) ? (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
            Your current mock role cannot view this contractor.
          </div>
        ) : (
          <>
            <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
                    Contractor
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
                    {contractor.companyName}
                  </h1>
                  <p className="mt-2 text-sm text-neutral-600">
                    Updated {formatDateTime(contractor.updatedAt)}
                  </p>
                </div>
                <StatusPill status={contractor.status} />
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {canEditContractor(currentUser.role, contractor) ? (
                  <Link href={`/contractors/${contractor.id}/edit?role=${currentUser.role}`} className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
                    Edit contractor
                  </Link>
                ) : (
                  <span className="rounded-md border border-neutral-300 bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-600">
                    Read-only
                  </span>
                )}
              </div>
            </section>

            <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
              <DetailSection title="Company summary">
                <DetailField label="Contact name" value={contractor.contactName} />
                <DetailField label="Email" value={contractor.email} />
                <DetailField label="Phone" value={contractor.phone} />
                <DetailField label="Service categories" value={contractor.serviceCategories.join(", ") || "Not set"} fullWidth />
                <DetailField label="Internal notes" value={contractor.notes} fullWidth />
              </DetailSection>
            </div>

            <section className="mt-6">
              <h2 className="text-base font-semibold text-neutral-950">Recent assigned work orders</h2>
              <div className="mt-4">
                {workOrders.length > 0 ? (
                  <InternalWorkOrderTable workOrders={workOrders} role={currentUser.role} />
                ) : (
                  <EmptyState title="No assigned work" message="Assigned work orders will appear here." />
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </InternalShell>
  );
}

function StatusPill({ status }: { status: ContractorStatus }) {
  return (
    <span className="inline-flex rounded-md border border-neutral-300 bg-neutral-100 px-2 py-1 text-xs font-semibold uppercase tracking-normal text-neutral-700">
      {status}
    </span>
  );
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
