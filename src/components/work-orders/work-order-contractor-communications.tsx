import { formatDateTime } from "./formatting";
import type { DerivedWorkOrderCommunicationItem } from "./work-order-communication-model";

interface WorkOrderContractorCommunicationsProps {
  items: DerivedWorkOrderCommunicationItem[];
  supported: boolean;
}

export function WorkOrderContractorCommunications({
  items,
  supported,
}: WorkOrderContractorCommunicationsProps) {
  return (
    <section
      aria-labelledby="work-order-contractor-communications-heading"
      className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <h2
        className="text-lg font-semibold text-neutral-950"
        id="work-order-contractor-communications-heading"
      >
        Contractor Communications
      </h2>
      <p className="mt-1 text-sm text-neutral-600">
        Messages recorded as contractor-visible through the current communication endpoint.
      </p>

      {!supported ? (
        <EmptyMessage message="Contractor-visible communication history is not available from the current work-order detail payload." />
      ) : items.length === 0 ? (
        <EmptyMessage message="No contractor-visible communications recorded yet." />
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li
              className="rounded-2xl border border-orange-200 bg-orange-50/60 px-4 py-4"
              key={item.id}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-950">{item.title}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs font-medium text-neutral-500">
                    <span>{item.sourceLabel}</span>
                    <span>{item.detail}</span>
                  </div>
                  {item.body ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
                      {item.body}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-neutral-500">{item.actorLabel}</p>
                </div>
                <p className="shrink-0 text-xs text-neutral-500">
                  {formatDateTime(item.occurredAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyMessage({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
      {message}
    </div>
  );
}
