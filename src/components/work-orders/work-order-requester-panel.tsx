import type { ContactSummary } from "@/types/contact";

interface WorkOrderRequesterPanelProps {
  requesterContact?: ContactSummary | null;
  siteContact?: ContactSummary | null;
  requesterName: string;
  requesterEmail: string | null;
  requesterPhone: string | null;
}

export function WorkOrderRequesterPanel({
  requesterContact,
  siteContact,
  requesterName,
  requesterEmail,
  requesterPhone,
}: WorkOrderRequesterPanelProps) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-950">Requester</h2>
      <dl className="mt-5 space-y-4">
        <DetailRow
          label="Linked requester contact"
          value={formatLinkedContact(requesterContact)}
        />
        <DetailRow
          label="Linked site contact"
          value={formatLinkedContact(siteContact)}
        />
        <DetailRow label="Name" value={requesterName} />
        <DetailRow label="Email" value={requesterEmail ?? "Not provided"} />
        <DetailRow label="Phone" value={requesterPhone ?? "Not provided"} />
      </dl>
    </section>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm text-neutral-900">{value}</dd>
    </div>
  );
}

function formatLinkedContact(contact: ContactSummary | null | undefined): string {
  if (!contact) {
    return "Not linked";
  }

  return [
    contact.displayName,
    contact.email,
    contact.primaryPhone,
    contact.preferredLanguage ? `Preferred language: ${contact.preferredLanguage}` : null,
  ]
    .filter(Boolean)
    .join(" • ");
}
