import "server-only";

import type { AccessActor } from "@/types/auth";
import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { ServiceAuditContext } from "@/server/services/types";
import type { AtomicPersistenceContext } from "./atomic-persistence-service";

export type WorkOrderMutationSource =
  | "work_order_api"
  | "assignment_workflow"
  | "quote_workflow"
  | "invoice_workflow"
  | "intake_review"
  | "system_runtime";

export interface SystemWorkOrderMutationActor {
  actorType: "system";
  userId: EntityId;
  role: "system";
  scope: {
    kind: "system";
    organizationId: EntityId;
    trusted: true;
  };
}

export type WorkOrderMutationActor =
  | AccessActor
  | SystemWorkOrderMutationActor;

export interface WorkOrderMutationContext
  extends Omit<ServiceAuditContext, "actor"> {
  actor: WorkOrderMutationActor;
  source: WorkOrderMutationSource;
  correlationId?: string | null;
  causationId?: string | null;
  sourceEventId?: string | null;
  now?: IsoDateTimeString;
  atomic?: AtomicPersistenceContext;
}

export function createWorkOrderMutationContext(input: {
  actor: AccessActor;
  source: WorkOrderMutationSource;
  now?: IsoDateTimeString;
  requestId?: string;
  correlationId?: string | null;
  causationId?: string | null;
  sourceEventId?: string | null;
}): WorkOrderMutationContext {
  return {
    organizationId: input.actor.scope.organizationId,
    actor: input.actor,
    source: input.source,
    now: input.now,
    requestId: input.requestId,
    correlationId: input.correlationId ?? null,
    causationId: input.causationId ?? null,
    sourceEventId: input.sourceEventId ?? null,
  };
}

export function createSystemWorkOrderMutationContext(input: {
  organizationId: EntityId;
  source: Extract<WorkOrderMutationSource, "system_runtime">;
  actorId?: EntityId;
  now?: IsoDateTimeString;
  requestId?: string;
  correlationId?: string | null;
  causationId?: string | null;
  sourceEventId?: string | null;
}): WorkOrderMutationContext {
  return {
    organizationId: input.organizationId,
    actor: {
      actorType: "system",
      userId: input.actorId ?? "system",
      role: "system",
      scope: {
        kind: "system",
        organizationId: input.organizationId,
        trusted: true,
      },
    },
    source: input.source,
    now: input.now,
    requestId: input.requestId,
    correlationId: input.correlationId ?? null,
    causationId: input.causationId ?? null,
    sourceEventId: input.sourceEventId ?? null,
  };
}

export function isSystemWorkOrderMutationActor(
  actor: WorkOrderMutationActor,
): actor is SystemWorkOrderMutationActor {
  return actor.actorType === "system";
}
