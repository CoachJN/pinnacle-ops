import "server-only";

import { resolveContactsById } from "@/server/api/contact-projections";
import { createAccessDeniedError } from "@/server/authorization";
import { getWorkOrderApiContext } from "@/server/api/work-orders";
import type { ContractorAccessActor } from "@/types/auth";
import type { EntityId } from "@/types/entity";
import type {
  Assignment,
  ContractorQuote,
  WorkOrder,
} from "@/server/repositories";
import type { ContractorPortalWorkOrderDetail, ContractorPortalWorkOrderListItem, ContractorWorkOrderFilter } from "@/modules/work-orders/contractor-portal";
import {
  isRelevantContractorPortalAssignment,
  matchesContractorPortalFilter,
  toContractorPortalActivityEntry,
  toContractorPortalWorkOrderDetail,
  toContractorPortalWorkOrderListItem,
} from "@/modules/work-orders/contractor-portal";

export interface ContractorPortalLandingSummary {
  assignedWorkOrderCount: number;
  quoteRequestedCount: number;
  readyToPerformCount: number;
  completedCount: number;
  recentlyUpdatedAssignments: number;
}

interface ContractorPortalRecord {
  workOrder: WorkOrder;
  assignment: Assignment;
  quote: ContractorQuote | null;
}

export async function requireContractorPortalContext() {
  const context = await getWorkOrderApiContext();

  if (context.actor.actorType !== "contractor") {
    throw createAccessDeniedError("Contractor portal access is restricted to contractor users.");
  }

  return {
    ...context,
    actor: context.actor,
  } as typeof context & { actor: ContractorAccessActor };
}

export async function getContractorPortalLandingSummary(): Promise<ContractorPortalLandingSummary> {
  const records = await listContractorPortalRecords();

  return {
    assignedWorkOrderCount: records.length,
    quoteRequestedCount: records.filter((record) => record.quoteActionNeeded).length,
    readyToPerformCount: records.filter((record) =>
      record.assignment.status === "accepted" &&
      record.lifecycleStatus !== "work_completed" &&
      record.lifecycleStatus !== "closed" &&
      record.lifecycleStatus !== "cancelled"
    ).length,
    completedCount: records.filter((record) => record.assignment.status === "completed").length,
    recentlyUpdatedAssignments: records.filter((record) => {
      const updatedAtMs = Date.parse(record.updatedAt);
      const yesterdayMs = Date.now() - 24 * 60 * 60 * 1000;
      return Number.isFinite(updatedAtMs) && updatedAtMs >= yesterdayMs;
    }).length,
  };
}

export async function listContractorPortalWorkOrders(
  filter: ContractorWorkOrderFilter = "all",
): Promise<ContractorPortalWorkOrderListItem[]> {
  const records = await listContractorPortalRecords();

  return records.filter((record) => matchesContractorPortalFilter(record, filter));
}

export async function getContractorPortalWorkOrder(
  workOrderId: EntityId,
): Promise<ContractorPortalWorkOrderDetail | null> {
  const context = await requireContractorPortalContext();
  const record = await getContractorPortalRecord(context, workOrderId);

  if (!record) {
    return null;
  }

  const [location, timeline, communications] = await Promise.all([
    context.repositories.locations.getById(record.workOrder.locationId),
    context.services.timeline.listForWorkOrder(workOrderId, context.actor),
    context.services.communications.query.listTimelineForWorkOrder(workOrderId, context.actor),
  ]);
  const contactsById = await resolveContactsById(context.repositories, [
    location?.siteContactId,
  ]);

  const visibleActivity = (timeline.ok ? timeline.value : []).map(
    toContractorPortalActivityEntry,
  );

  return toContractorPortalWorkOrderDetail({
    ...record,
    location: location && !location.isDeleted ? location : null,
    siteContact:
      location?.siteContactId == null
        ? null
        : contactsById[location.siteContactId] ?? null,
    visibleActivity,
    communications: communications.ok ? communications.value : [],
  });
}

export async function getContractorPortalActionTarget(workOrderId: EntityId) {
  const context = await requireContractorPortalContext();
  const record = await getContractorPortalRecord(context, workOrderId);

  if (!record) {
    throw createAccessDeniedError("You do not have access to this contractor work order.");
  }

  return {
    context,
    ...record,
  };
}

async function listContractorPortalRecords(): Promise<ContractorPortalWorkOrderListItem[]> {
  const context = await requireContractorPortalContext();
  const rawRecords = await getAllContractorPortalRecords(context);

  return rawRecords.map((record) => toContractorPortalWorkOrderListItem(record));
}

async function getContractorPortalRecord(
  context: Awaited<ReturnType<typeof requireContractorPortalContext>>,
  workOrderId: EntityId,
): Promise<ContractorPortalRecord | null> {
  const workOrder = await context.repositories.workOrders.getById(workOrderId);

  if (
    !workOrder ||
    workOrder.isDeleted ||
    workOrder.assignedContractorOrgId !== context.actor.scope.contractorOrganizationId
  ) {
    return null;
  }

  const assignments = await context.repositories.assignments.listByWorkOrderId(workOrderId, {
    limit: 50,
  });
  const assignment = selectLatestRelevantAssignment(
    assignments.items,
    context.actor.scope.contractorOrganizationId,
  );

  if (!assignment) {
    return null;
  }

  return {
    workOrder,
    assignment,
    quote: await getScopedCurrentQuote(context, workOrder),
  };
}

async function getAllContractorPortalRecords(
  context: Awaited<ReturnType<typeof requireContractorPortalContext>>,
): Promise<ContractorPortalRecord[]> {
  const contractorOrganizationId = context.actor.scope.contractorOrganizationId;
  const [workOrders, assignments] = await Promise.all([
    context.repositories.workOrders.listByContractorOrganizationId(contractorOrganizationId, {
      limit: 100,
    }),
    context.repositories.assignments.listByContractorOrganizationId(contractorOrganizationId, {
      limit: 200,
    }),
  ]);

  const assignmentByWorkOrderId = new Map<EntityId, Assignment>();
  for (const assignment of assignments.items) {
    if (!isRelevantContractorPortalAssignment(assignment)) {
      continue;
    }

    const existing = assignmentByWorkOrderId.get(assignment.workOrderId);
    if (!existing || assignment.assignedAt > existing.assignedAt) {
      assignmentByWorkOrderId.set(assignment.workOrderId, assignment);
    }
  }

  const scopedWorkOrders = workOrders.items.filter((workOrder) => {
    if (workOrder.isDeleted) {
      return false;
    }

    return assignmentByWorkOrderId.has(workOrder.id);
  });

  const quotes = await Promise.all(
    scopedWorkOrders.map((workOrder) => getScopedCurrentQuote(context, workOrder)),
  );

  return scopedWorkOrders.map((workOrder, index) => ({
    workOrder,
    assignment: assignmentByWorkOrderId.get(workOrder.id)!,
    quote: quotes[index] ?? null,
  }));
}

async function getScopedCurrentQuote(
  context: Awaited<ReturnType<typeof requireContractorPortalContext>>,
  workOrder: WorkOrder,
): Promise<ContractorQuote | null> {
  const quotes = await context.repositories.contractorQuotes.listByWorkOrderId(workOrder.id, {
    limit: 25,
  });

  return (
    quotes.items
      .filter(
        (quote) =>
          !quote.isDeleted &&
          (quote.contractorOrganizationId === null ||
            quote.contractorOrganizationId ===
              context.actor.scope.contractorOrganizationId),
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
  );
}

function selectLatestRelevantAssignment(
  assignments: readonly Assignment[],
  contractorOrganizationId: EntityId,
): Assignment | null {
  return (
    assignments
      .filter((assignment) =>
        assignment.contractorOrganizationId === contractorOrganizationId &&
        isRelevantContractorPortalAssignment(assignment),
      )
      .sort((left, right) => right.assignedAt.localeCompare(left.assignedAt))[0] ?? null
  );
}
