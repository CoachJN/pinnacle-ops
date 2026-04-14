import Link from "next/link";
import { LocationEditForm } from "@/components/client-portal/location-edit-form";
import { getClientPortalLocation } from "@/modules/clients/server/client-portal";

interface ClientPortalEditLocationPageProps {
  params: Promise<{ locationId: string }>;
}

export default async function ClientPortalEditLocationPage({
  params,
}: ClientPortalEditLocationPageProps) {
  const { locationId } = await params;
  const location = await getClientPortalLocation(locationId);

  return (
    <section className="space-y-6">
      <Link
        className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline"
        href={`/portal/locations/${location.id}`}
      >
        Back to location
      </Link>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Locations
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Edit location
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Update service contact details and access instructions for your team.
          Organization ownership and internal-only fields remain server-controlled.
        </p>
      </section>

      <LocationEditForm location={location} />
    </section>
  );
}
