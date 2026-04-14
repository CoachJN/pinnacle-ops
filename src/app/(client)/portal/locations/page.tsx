import Link from "next/link";
import { listClientPortalLocations } from "@/modules/clients/server/client-portal";

interface ClientPortalLocationsPageProps {
  searchParams: Promise<{
    search?: string;
    status?: "active" | "inactive";
  }>;
}

export default async function ClientPortalLocationsPage({
  searchParams,
}: ClientPortalLocationsPageProps) {
  const filters = await searchParams;
  const locations = await listClientPortalLocations(filters);

  return (
    <section className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Locations
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Your service locations
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Review the locations in your client scope and update service contact or
          access details where allowed.
        </p>
      </section>

      <form className="grid gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[minmax(0,1fr)_14rem_auto]">
        <label className="text-sm font-medium text-slate-700">
          Search
          <input
            className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-emerald-500"
            defaultValue={filters.search ?? ""}
            name="search"
            placeholder="Search by name, code, or city"
            type="search"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Status
          <select
            className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-emerald-500"
            defaultValue={filters.status ?? ""}
            name="status"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <div className="flex items-end gap-3">
          <button
            className="rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
            type="submit"
          >
            Apply
          </button>
          <Link
            className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-500 hover:text-slate-950"
            href="/portal/locations"
          >
            Reset
          </Link>
        </div>
      </form>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        {locations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {locations.map((location) => (
                  <tr key={location.id}>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-950">{location.name}</p>
                      <p className="mt-1 text-slate-600">
                        {location.code ? `Code: ${location.code}` : "No location code"}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {[location.city, location.region, location.countryCode]
                        .filter(Boolean)
                        .join(", ") || "Address details not provided"}
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
                        {location.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {formatDate(location.updatedAt)}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-500 hover:text-slate-950"
                        href={`/portal/locations/${location.id}`}
                      >
                        View details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-sm text-slate-600">
            No locations match your current filters.
          </div>
        )}
      </section>
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
