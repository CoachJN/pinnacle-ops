import "server-only";

import type {
  DomainEvent,
  DomainEventPayload,
  DomainEventType,
  EventActor,
  EventEntityReference,
  EventMetadata,
  EventVisibility,
  TimelineEntry,
  TransitionAudit,
  TransitionEvent,
} from "@/server/events/types";
import type {
  DomainEventRepository,
  FirestoreRepositories,
  TransitionAuditRepository,
  TransitionEventRepository,
} from "@/server/repositories";
import type { AccessActor } from "@/types/auth";
import type { EntityId } from "@/types/entity";
import { USER_ROLES } from "@/types/permissions";
import {
  nowIso,
  serviceOk,
  type ServiceAuditContext,
  type ServiceResult,
} from "./types";

export interface RecordDomainEventInput<TType extends DomainEventType> extends ServiceAuditContext {
  workOrderId: EntityId | null;
  type: TType;
  visibility: EventVisibility;
  lifecycleStatus: string | null;
  entity: EventEntityReference;
  summary: string;
  payload: DomainEventPayload<TType>;
  reason?: string | null;
  correlationId?: string | null;
}

export interface RecordTransitionAuditInput extends ServiceAuditContext {
  workOrderId: EntityId;
  fromLifecycleStatus: string;
  toLifecycleStatus: string;
  visibility: EventVisibility;
  reason?: string | null;
  correlationId?: string | null;
  escalationContext?: Record<string, unknown> | null;
  holdContext?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

export interface DomainEventService {
  record<TType extends DomainEventType>(
    input: RecordDomainEventInput<TType>,
  ): Promise<ServiceResult<DomainEvent<TType>>>;
  recordTransition(input: RecordTransitionAuditInput): Promise<
    ServiceResult<{
      domainEvent: DomainEvent<"lifecycle_transitioned">;
      transitionEvent: TransitionEvent;
      transitionAudit: TransitionAudit;
    }>
  >;
  listTimelineForWorkOrder(
    workOrderId: EntityId,
    actor: AccessActor,
  ): Promise<ServiceResult<TimelineEntry[]>>;
  listTimelineForEntity(
    entity: EventEntityReference,
    actor: AccessActor,
  ): Promise<ServiceResult<TimelineEntry[]>>;
}

export function createDomainEventService(
  repositories: Pick<
    FirestoreRepositories,
    "domainEvents" | "transitionEvents" | "transitionAudits"
  >,
): DomainEventService {
  return new FirestoreDomainEventService(repositories);
}

class FirestoreDomainEventService implements DomainEventService {
  private readonly domainEvents: DomainEventRepository;
  private readonly transitionEvents: TransitionEventRepository;
  private readonly transitionAudits: TransitionAuditRepository;

  constructor(
    repositories: Pick<
      FirestoreRepositories,
      "domainEvents" | "transitionEvents" | "transitionAudits"
    >,
  ) {
    this.domainEvents = repositories.domainEvents;
    this.transitionEvents = repositories.transitionEvents;
    this.transitionAudits = repositories.transitionAudits;
  }

  async record<TType extends DomainEventType>(
    input: RecordDomainEventInput<TType>,
  ): Promise<ServiceResult<DomainEvent<TType>>> {
    const occurredAt = input.now ?? nowIso();
    const event: DomainEvent<TType> = {
      id: this.domainEvents.newId(),
      organizationId: input.organizationId,
      tenantId: input.organizationId,
      workOrderId: input.workOrderId,
      type: input.type,
      actor: toEventActor(input),
      visibility: input.visibility,
      occurredAt,
      lifecycleStatus: input.lifecycleStatus,
      entity: input.entity,
      summary: input.summary,
      metadata: buildMetadata(input.requestId ?? null, input.reason ?? null, input.correlationId ?? null),
      payload: input.payload,
    };

    await this.domainEvents.create(event);
    return serviceOk(event);
  }

  async recordTransition(
    input: RecordTransitionAuditInput,
  ): Promise<
    ServiceResult<{
      domainEvent: DomainEvent<"lifecycle_transitioned">;
      transitionEvent: TransitionEvent;
      transitionAudit: TransitionAudit;
    }>
  > {
    const occurredAt = input.now ?? nowIso();
    const actor = toEventActor(input);
    const metadata = buildMetadata(
      input.requestId ?? null,
      input.reason ?? null,
      input.correlationId ?? null,
      input.metadata ?? {},
    );
    const transitionEvent: TransitionEvent = {
      id: this.transitionEvents.newId(),
      organizationId: input.organizationId,
      tenantId: input.organizationId,
      workOrderId: input.workOrderId,
      actor,
      visibility: input.visibility,
      occurredAt,
      fromLifecycleStatus: input.fromLifecycleStatus,
      toLifecycleStatus: input.toLifecycleStatus,
      reason: input.reason ?? null,
      metadata,
    };
    const transitionAudit: TransitionAudit = {
      id: this.transitionAudits.newId(),
      organizationId: input.organizationId,
      tenantId: input.organizationId,
      workOrderId: input.workOrderId,
      actor,
      occurredAt,
      fromLifecycleStatus: input.fromLifecycleStatus,
      toLifecycleStatus: input.toLifecycleStatus,
      reason: input.reason ?? null,
      metadata,
      escalationContext: input.escalationContext ?? null,
      holdContext: input.holdContext ?? null,
    };
    const domainEvent: DomainEvent<"lifecycle_transitioned"> = {
      id: this.domainEvents.newId(),
      organizationId: input.organizationId,
      tenantId: input.organizationId,
      workOrderId: input.workOrderId,
      type: "lifecycle_transitioned",
      actor,
      visibility: input.visibility,
      occurredAt,
      lifecycleStatus: input.toLifecycleStatus,
      entity: {
        entityType: "work_order",
        entityId: input.workOrderId,
        label: null,
      },
      summary: `Lifecycle transitioned from ${input.fromLifecycleStatus} to ${input.toLifecycleStatus}.`,
      metadata,
      payload: {
        fromLifecycleStatus: input.fromLifecycleStatus,
        toLifecycleStatus: input.toLifecycleStatus,
        reason: input.reason ?? null,
      },
    };

    await this.transitionAudits.create(transitionAudit);
    await this.transitionEvents.create(transitionEvent);
    await this.domainEvents.create(domainEvent);

    return serviceOk({
      domainEvent,
      transitionEvent,
      transitionAudit,
    });
  }

  async listTimelineForWorkOrder(
    workOrderId: EntityId,
    actor: AccessActor,
  ): Promise<ServiceResult<TimelineEntry[]>> {
    const result = await this.domainEvents.listByWorkOrderId(workOrderId, { limit: 200 });
    return serviceOk(toTimelineEntries(result.items, actor));
  }

  async listTimelineForEntity(
    entity: EventEntityReference,
    actor: AccessActor,
  ): Promise<ServiceResult<TimelineEntry[]>> {
    const result = await this.domainEvents.listByEntity(entity, { limit: 200 });
    return serviceOk(toTimelineEntries(result.items, actor));
  }
}

function toTimelineEntries(
  events: readonly DomainEvent[],
  actor: AccessActor,
): TimelineEntry[] {
  return events
    .filter((event) => canActorReadVisibility(actor, event.visibility))
    .sort(compareTimelineEntries)
    .map((event) => ({
      id: event.id,
      workOrderId: event.workOrderId,
      occurredAt: event.occurredAt,
      type: event.type,
      visibility: event.visibility,
      actor: event.actor,
      summary: event.summary,
      lifecycleStatus: event.lifecycleStatus,
      entity: event.entity,
      payload: event.payload as Record<string, unknown>,
    }));
}

function buildMetadata(
  requestId: string | null,
  reason: string | null,
  correlationId: string | null,
  details: Record<string, unknown> = {},
): EventMetadata {
  return {
    requestId,
    reason,
    correlationId,
    details,
  };
}

function toEventActor(context: ServiceAuditContext): EventActor {
  if (context.actor.role === "system") {
    return {
      actorId: null,
      actorType: "system",
      actorRole: "system",
      displayName: "System",
    };
  }

  return {
    actorId: context.actor.userId,
    actorType: "user",
    actorRole: context.actor.role,
    displayName: roleDisplayName(context.actor.role),
  };
}

function roleDisplayName(role: EventActor["actorRole"]): string {
  switch (role) {
    case USER_ROLES.Coordinator:
      return "Coordinator";
    case USER_ROLES.Manager:
      return "Manager";
    case USER_ROLES.FinanceAdmin:
      return "Finance";
    case USER_ROLES.Owner:
      return "Owner";
    case USER_ROLES.ClientUser:
      return "Client";
    case USER_ROLES.ContractorUser:
      return "Contractor";
    case "ai":
      return "AI";
    case "system":
      return "System";
    default:
      return "Team";
  }
}

function canActorReadVisibility(
  actor: AccessActor,
  visibility: EventVisibility,
): boolean {
  if (actor.actorType === "internal") {
    if (visibility !== "finance") {
      return true;
    }

    return actor.role === USER_ROLES.FinanceAdmin || actor.role === USER_ROLES.Owner;
  }

  if (actor.actorType === "client") {
    return visibility === "client";
  }

  return visibility === "contractor";
}

function compareTimelineEntries(left: TimelineEntry, right: TimelineEntry): number {
  const timeOrder = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
  if (timeOrder !== 0) {
    return timeOrder;
  }

  return right.id.localeCompare(left.id);
}
