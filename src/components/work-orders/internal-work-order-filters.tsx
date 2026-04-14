import type { InternalUserRole } from "@/types/permissions";
import { WORK_ORDER_PRIORITIES } from "@/lib/work-orders/constants";
import { WORK_ORDER_STATUSES, WORK_ORDER_STATUS_LABELS } from "@/lib/work-orders/status";
import { WORK_ORDER_PRIORITY_LABELS } from "@/lib/work-orders/constants";

export function InternalWorkOrderFilters({
  role,
  view,
  status,
  priority,
  client,
  sort,
}: {
  role: InternalUserRole;
  view?: string;
  status?: string;
  priority?: string;
  client?: string;
  sort?: string;
}) {
  return (
    <form className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:grid-cols-5" action="/work-orders">
      <input type="hidden" name="role" value={role} />
      <label className="text-sm font-medium text-neutral-700">
        Queue
        <select name="view" defaultValue={view ?? ""} className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
          <option value="">All work orders</option>
          <option value="active">All active</option>
          <option value="needs_review">Needs review</option>
          <option value="quote_requested">Quote requested</option>
          <option value="quote_received">Quote received</option>
          <option value="pending_client_approval">Pending client approval</option>
          <option value="approved_to_proceed">Approved to proceed</option>
          <option value="in_progress">In progress</option>
          <option value="ready_to_invoice">Ready to invoice</option>
          <option value="completed">Completed</option>
          <option value="invoiced">Invoiced</option>
          <option value="awaiting_payment">Awaiting payment</option>
          <option value="paid">Paid</option>
          <option value="overdue_invoice">Overdue invoice</option>
          <option value="terminal">Terminal</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Cancelled</option>
          <option value="mine">Mine</option>
        </select>
      </label>
      <label className="text-sm font-medium text-neutral-700">
        Status
        <select name="status" defaultValue={status ?? ""} className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {WORK_ORDER_STATUSES.map((option) => (
            <option key={option} value={option}>{WORK_ORDER_STATUS_LABELS[option]}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-neutral-700">
        Priority
        <select name="priority" defaultValue={priority ?? ""} className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
          <option value="">All priorities</option>
          {WORK_ORDER_PRIORITIES.map((option) => (
            <option key={option} value={option}>{WORK_ORDER_PRIORITY_LABELS[option]}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-neutral-700">
        Client
        <input name="client" defaultValue={client ?? ""} placeholder="Search client name" className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
      </label>
      <label className="text-sm font-medium text-neutral-700">
        Sort
        <select name="sort" defaultValue={sort ?? "updatedAt"} className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
          <option value="updatedAt">Updated at</option>
          <option value="requestedServiceDate">Requested date</option>
          <option value="priority">Priority</option>
        </select>
      </label>
      <div className="flex gap-2 md:col-span-5">
        <button type="submit" className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
          Apply filters
        </button>
        <a href={`/work-orders?role=${role}`} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500">
          Reset
        </a>
      </div>
    </form>
  );
}
