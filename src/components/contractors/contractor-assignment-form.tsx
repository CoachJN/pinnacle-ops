import type { Contractor } from "@/types/contractor";
import type { InternalUserRole } from "@/types/permissions";
import type { PhaseOneWorkOrder } from "@/types/work-order";
import { assignContractorAction } from "@/lib/contractors/actions";
import { canAssignContractor } from "@/lib/permissions/contractor-permissions";

export function ContractorAssignmentForm({
  role,
  workOrder,
  contractors,
}: {
  role: InternalUserRole;
  workOrder: PhaseOneWorkOrder;
  contractors: Contractor[];
}) {
  const editable = canAssignContractor(role, workOrder);

  if (!editable) {
    return (
      <span className="text-sm text-neutral-600">
        {workOrder.assignedContractorName ?? "No contractor assigned"}
      </span>
    );
  }

  return (
    <form action={assignContractorAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="actorRole" value={role} />
      <input type="hidden" name="workOrderId" value={workOrder.id} />
      <label className="text-sm font-medium text-neutral-700">
        Assigned contractor
        <select name="contractorId" defaultValue={workOrder.assignedContractorId ?? ""} className="mt-1 min-w-64 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950">
          <option value="">Unassigned</option>
          {contractors.map((contractor) => (
            <option key={contractor.id} value={contractor.id}>
              {contractor.companyName}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
        Save assignment
      </button>
    </form>
  );
}
