import Link from "next/link";
import { getClientPortalLocation } from "@/modules/clients/server/client-portal";

interface ClientPortalLocationDetailPageProps {
  params: Promise<{ locationId: string }>;
}

export default async function ClientPortalLocationDetailPage({
  params,
}: ClientPortalLocationDetailPageProps) {
  const { locationId } = await params;
  const location = await getClientPortalLocation(locationId);

  return (
    <section className="space-y-6">
      <Link
        className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline"
        href="/portal/locations"
      >
        Back to locations
      </Link>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Location
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {location.name}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {location.code ? `Location code: ${location.code}` : "No location code"}
            </p>
          </div>
          <Link
            className="rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
            href={`/portal/locations/${location.id}/edit`}
          >
            Edit location
          </Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <section className="space-y-6">
          <DetailCard
            items={[
              { label: "Address line 1", value: location.addressLine1 },
              { label: "Address line 2", value: location.addressLine2 },
              { label: "City", value: location.city },
              { label: "Province / State", value: location.region },
              { label: "Postal code", value: location.postalCode },
              { label: "Country", value: location.countryCode },
            ]}
            title="Address"
          />
          <DetailCard
            items={[
              { label: "Contact name", value: location.locationContactName },
              { label: "Contact email", value: location.locationContactEmail },
              { label: "Contact phone", value: location.locationContactPhone },
            ]}
            title="Service contact"
          />
        </section>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Portal summary</h2>
            <dl className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-4">
                <dt>Status</dt>
                <dd className="font-medium text-slate-950">{location.status}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt>Updated</dt>
                <dd className="font-medium text-slate-950">{formatDate(location.updatedAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt>Created</dt>
                <dd className="font-medium text-slate-950">{formatDate(location.createdAt)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Access instructions</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {location.accessNotes ?? "No access instructions provided."}
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
}

function DetailCard({
  items,
  title,
}: {
  items: { label: string; value?: string }[];
  title: string;
}) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <dl className="mt-5 grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {item.label}
            </dt>
            <dd className="mt-2 text-sm text-slate-700">
              {item.value?.trim() || "Not provided"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
