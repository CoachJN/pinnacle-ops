import Link from "next/link";
import { InternalShell } from "@/components/internal/internal-shell";
import { EmptyState } from "@/components/work-orders/empty-state";
import { formatDateTime } from "@/components/work-orders/formatting";
import {
  canCreateContractor,
  canViewContractorModule,
} from "@/lib/permissions/contractor-permissions";
import { getMockCurrentUser } from "@/lib/permissions/mock-current-user";
import {
  listContractors,
  type ContractorListFilters,
} from "@/lib/contractors/repository";
import type { Contractor, ContractorStatus } from "@/types/contractor";
import type { InternalUserRole } from "@/types/permissions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ContractorListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const currentUser = getMockCurrentUser(readParam(params.role));
  const filters: ContractorListFilters = {
    status: parseStatus(readParam(params.status)),
    query: readParam(params.query),
    sort: parseSort(readParam(params.sort)),
  };
  const contractors = await listContractors(filters);

  return (
    <InternalShell currentUser={currentUser}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
              Contractors
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
              Contractor records
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-600">
              Maintain assignable contractor contacts and service coverage.
            </p>
          </div>
          {canCreateContractor(currentUser.role) ? (
            <Link href={`/contractors/new?role=${currentUser.role}`} className="inline-flex rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
              Create contractor
            </Link>
          ) : null}
        </div>

        <ContractorFilters role={currentUser.role} filters={filters} />

        {!canViewContractorModule(currentUser.role) ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
            Your current mock role cannot view contractors.
          </div>
        ) : contractors.length > 0 ? (
          <ContractorTable contractors={contractors} role={currentUser.role} />
        ) : (
          <EmptyState title="No contractors found" message="Adjust filters or create a contractor record." />
        )}
      </div>
    </InternalShell>
  );
}

function ContractorFilters({
  role,
  filters,
}: {
  role: InternalUserRole;
  filters: ContractorListFilters;
}) {
  return (
    <form className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:grid-cols-4" action="/contractors">
      <input type="hidden" name="role" value={role} />
      <label className="text-sm font-medium text-neutral-700 md:col-span-2">
        Search
        <input name="query" defaultValue={filters.query ?? ""} placeholder="Company, contact, or category" className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
      </label>
      <label className="text-sm font-medium text-neutral-700">
        Status
        <select name="status" defaultValue={filters.status ?? ""} className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <label className="text-sm font-medium text-neutral-700">
        Sort
        <select name="sort" defaultValue={filters.sort ?? "companyName"} className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
          <option value="companyName">Company name</option>
          <option value="updatedAt">Updated at</option>
        </select>
      </label>
      <div className="flex gap-2 md:col-span-4">
        <button type="submit" className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
          Apply filters
        </button>
        <Link href={`/contractors?role=${role}`} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500">
          Reset
        </Link>
      </div>
    </form>
  );
}

function ContractorTable({
  contractors,
  role,
}: {
  contractors: Contractor[];
  role: InternalUserRole;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-100 text-left text-xs font-semibold uppercase tracking-normal text-neutral-600">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Categories</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {contractors.map((contractor) => (
              <tr key={contractor.id} className="hover:bg-stone-50">
                <td className="px-4 py-3 font-semibold">
                  <Link className="underline-offset-4 hover:underline" href={`/contractors/${contractor.id}?role=${role}`}>
                    {contractor.companyName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-700">{contractor.contactName}</td>
                <td className="px-4 py-3 text-neutral-700">{contractor.email}</td>
                <td className="px-4 py-3 text-neutral-700">{contractor.phone}</td>
                <td className="px-4 py-3"><StatusPill status={contractor.status} /></td>
                <td className="px-4 py-3 text-neutral-700">{contractor.serviceCategories.join(", ") || "Not set"}</td>
                <td className="px-4 py-3 text-neutral-700">{formatDateTime(contractor.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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

function parseStatus(value: string | undefined): ContractorStatus | null {
  return value === "active" || value === "inactive" ? value : null;
}

function parseSort(value: string | undefined): ContractorListFilters["sort"] {
  return value === "updatedAt" ? "updatedAt" : "companyName";
}
