"use client";

import { useActionState } from "react";
import type { InternalUserRole } from "@/types/permissions";
import type { PhaseOneWorkOrder } from "@/types/work-order";
import { transitionWorkOrderAction, type WorkOrderFormState } from "@/lib/work-orders/actions";
import { canCloseWorkOrder } from "@/lib/permissions/work-order-permissions";
import {
  isTerminalWorkOrderStatus,
  WORK_ORDER_STATUS_LABELS,
} from "@/lib/work-orders/status";
import { FormSubmitButton } from "./form-submit-button";
import { ActionFeedback } from "@/components/shared/action-feedback";

const emptyState: WorkOrderFormState = {
  ok: false,
};

export function StatusTransitionPanel({
  workOrder,
  role,
  allowedTransitions,
}: {
  workOrder: PhaseOneWorkOrder;
  role: InternalUserRole;
  allowedTransitions: readonly PhaseOneWorkOrder["status"][];
}) {
  const [state, formAction] = useActionState(transitionWorkOrderAction, emptyState);
  const closeoutEligible = canCloseWorkOrder(role, workOrder);
  const terminal = isTerminalWorkOrderStatus(workOrder.status);

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-950">Status actions</h2>
          <p className="mt-1 text-sm text-neutral-600">
            {closeoutEligible
              ? "This completed work order is ready for closeout."
              : terminal
                ? "Terminal records are read-only in this phase."
                : "Available actions are limited by lifecycle state and role."}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <ActionFeedback message={state.message} />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {allowedTransitions.length > 0 ? (
          allowedTransitions.map((nextStatus) => (
            <form
              key={nextStatus}
              action={formAction}
              onSubmit={(event) => {
                if (nextStatus !== "cancelled") {
                  return;
                }

                const confirmed = window.confirm(
                  "Cancel this work order? This is a terminal action for Phase 1.",
                );

                if (!confirmed) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="id" value={workOrder.id} />
              <input type="hidden" name="actorRole" value={role} />
              <input type="hidden" name="nextStatus" value={nextStatus} />
              <FormSubmitButton
                variant={nextStatus === "cancelled" ? "danger" : "primary"}
                pendingLabel="Updating..."
              >
                {nextStatus === "closed"
                  ? "Close work order"
                  : nextStatus === "cancelled"
                    ? "Cancel work order"
                    : `Move to ${WORK_ORDER_STATUS_LABELS[nextStatus]}`}
              </FormSubmitButton>
            </form>
          ))
        ) : (
          <p className="text-sm text-neutral-600">
            No status actions are available for this role and state.
          </p>
        )}
      </div>
    </section>
  );
}
