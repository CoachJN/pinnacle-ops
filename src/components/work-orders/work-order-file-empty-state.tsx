import { WorkOrderEmptyState } from "./work-order-empty-state";

export function WorkOrderFileEmptyState() {
  return (
    <WorkOrderEmptyState
      actions={[
        "Photos",
        "Contractor documents",
        "Client files",
        "Completion proof",
        "Invoices / quotes uploaded manually",
      ].map((item) => (
        <span
          className="inline-flex rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700"
          key={item}
        >
          {item}
        </span>
      ))}
      message="Add supporting files here so operators can find them in one place."
      title="No files have been attached to this work order yet."
    />
  );
}
