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
import { isAlreadyExistsError } from "@/lib/idempotency/already-exists";
import { buildStableEntityId } from "@/lib/idempotency/stable-entity-id";
import {
  buildDurableOutboxRecord,
  type AtomicPersistenceContext,
  type AtomicPersistenceService,
} from "./atomic-persistence-service";
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
  atomic?: AtomicPersistenceContext;
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
  atomic?: AtomicPersistenceContext;
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
  dependencies: {
    atomicPersistence?: AtomicPersistenceService;
  } = {},
): DomainEventService {
  return new FirestoreDomainEventService(repositories, dependencies);
}

class FirestoreDomainEventService implements DomainEventService {
  private readonly domainEvents: DomainEventRepository;
  private readonly transitionEvents: TransitionEventRepository;
  private readonly transitionAudits: TransitionAuditRepository;
  private readonly atomicPersistence?: AtomicPersistenceService;

  constructor(
    repositories: Pick<
      FirestoreRepositories,
      "domainEvents" | "transitionEvents" | "transitionAudits"
    >,
    dependencies: {
      atomicPersistence?: AtomicPersistenceService;
    },
  ) {
    this.domainEvents = repositories.domainEvents;
    this.transitionEvents = repositories.transitionEvents;
    this.transitionAudits = repositories.transitionAudits;
    this.atomicPersistence = dependencies.atomicPersistence;
  }

  async record<TType extends DomainEventType>(
    input: RecordDomainEventInput<TType>,
  ): Promise<ServiceResult<DomainEvent<TType>>> {
    const occurredAt = input.now ?? nowIso();
    const event = buildDomainEventRecord(this.domainEvents.newId.bind(this.domainEvents), {
      ...input,
      now: occurredAt,
    });
    const correlationId = event.metadata.correlationId?.trim() || `event:${event.id}`;

    if (input.atomic) {
      input.atomic.create("domainEvents", event);
      input.atomic.create(
        "durableOutbox",
        buildDurableOutboxRecord({
          organizationId: event.organizationId,
          workOrderId: event.workOrderId,
          sourceEventId: event.id,
          correlationId,
          causationId: event.id,
          actor: event.actor,
          entity: event.entity,
          eventType: event.type,
          now: event.occurredAt,
        }),
      );
      return serviceOk(event);
    }

    if (this.atomicPersistence) {
      try {
        await this.atomicPersistence.runInTransaction(async (atomic) => {
          atomic.create("domainEvents", event);
          atomic.create(
            "durableOutbox",
            buildDurableOutboxRecord({
              organizationId: event.organizationId,
              workOrderId: event.workOrderId,
              sourceEventId: event.id,
              correlationId,
              causationId: event.id,
              actor: event.actor,
              entity: event.entity,
              eventType: event.type,
              now: event.occurredAt,
            }),
          );
        });
      } catch (error) {
        if (!isAlreadyExistsError(error)) {
          throw error;
        }

        const existing = await this.domainEvents.getById(event.id);
        if (!existing) {
          throw error;
        }
        return serviceOk(existing as DomainEvent<TType>);
      }

      return serviceOk(event);
    }

    try {
      await this.domainEvents.create(event);
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }

      const existing = await this.domainEvents.getById(event.id);
      if (!existing) {
        throw error;
      }
      return serviceOk(existing as DomainEvent<TType>);
    }
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
    const records = buildTransitionEventBundle(input);
    const correlationId =
      records.domainEvent.metadata.correlationId?.trim() || `event:${records.domainEvent.id}`;

    if (input.atomic) {
      input.atomic.create("transitionAudits", records.transitionAudit);
      input.atomic.create("transitionEvents", records.transitionEvent);
      input.atomic.create("domainEvents", records.domainEvent);
      input.atomic.create(
        "durableOutbox",
        buildDurableOutboxRecord({
          organizationId: records.domainEvent.organizationId,
          workOrderId: records.domainEvent.workOrderId,
          sourceEventId: records.domainEvent.id,
          correlationId,
          causationId: records.domainEvent.id,
          actor: records.domainEvent.actor,
          entity: records.domainEvent.entity,
          eventType: records.domainEvent.type,
          now: records.domainEvent.occurredAt,
        }),
      );
      return serviceOk(records);
    }

    if (this.atomicPersistence) {
      try {
        await this.atomicPersistence.runInTransaction(async (atomic) => {
          atomic.create("transitionAudits", records.transitionAudit);
          atomic.create("transitionEvents", records.transitionEvent);
          atomic.create("domainEvents", records.domainEvent);
          atomic.create(
            "durableOutbox",
            buildDurableOutboxRecord({
              organizationId: records.domainEvent.organizationId,
              workOrderId: records.domainEvent.workOrderId,
              sourceEventId: records.domainEvent.id,
              correlationId,
              causationId: records.domainEvent.id,
              actor: records.domainEvent.actor,
              entity: records.domainEvent.entity,
              eventType: records.domainEvent.type,
              now: records.domainEvent.occurredAt,
            }),
          );
        });
      } catch (error) {
        if (!isAlreadyExistsError(error)) {
          throw error;
        }

        const [existingAudit, existingTransition, existingEvent] = await Promise.all([
          this.transitionAudits.getById(records.transitionAudit.id),
          this.transitionEvents.getById(records.transitionEvent.id),
          this.domainEvents.getById(records.domainEvent.id),
        ]);
        if (!existingAudit || !existingTransition || !existingEvent) {
          throw error;
        }
        return serviceOk({
          domainEvent: existingEvent as DomainEvent<"lifecycle_transitioned">,
          transitionEvent: existingTransition,
          transitionAudit: existingAudit,
        });
      }

      return serviceOk(records);
    }

    try {
      await this.transitionAudits.create(records.transitionAudit);
      await this.transitionEvents.create(records.transitionEvent);
      await this.domainEvents.create(records.domainEvent);
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }

      const [existingAudit, existingTransition, existingEvent] = await Promise.all([
        this.transitionAudits.getById(records.transitionAudit.id),
        this.transitionEvents.getById(records.transitionEvent.id),
        this.domainEvents.getById(records.domainEvent.id),
      ]);
      if (!existingAudit || !existingTransition || !existingEvent) {
        throw error;
      }
      return serviceOk({
        domainEvent: existingEvent as DomainEvent<"lifecycle_transitioned">,
        transitionEvent: existingTransition,
        transitionAudit: existingAudit,
      });
    }

    return serviceOk(records);
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

export function buildDomainEventRecord<TType extends DomainEventType>(
  nextId: () => EntityId,
  input: RecordDomainEventInput<TType>,
): DomainEvent<TType> {
  const occurredAt = input.now ?? nowIso();
  return {
    id: buildRecordId({
      fallbackId: nextId(),
      organizationId: input.organizationId,
      requestId: input.requestId ?? null,
      type: input.type,
      entityType: input.entity.entityType,
      entityId: input.entity.entityId,
      workOrderId: input.workOrderId,
    }),
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
    metadata: buildMetadata(
      input.requestId ?? null,
      input.reason ?? null,
      input.correlationId ?? null,
    ),
    payload: input.payload,
  };
}

export function buildTransitionEventBundle(
  input: RecordTransitionAuditInput,
): {
  domainEvent: DomainEvent<"lifecycle_transitioned">;
  transitionEvent: TransitionEvent;
  transitionAudit: TransitionAudit;
} {
  const occurredAt = input.now ?? nowIso();
  const actor = toEventActor(input);
  const metadata = buildMetadata(
    input.requestId ?? null,
    input.reason ?? null,
    input.correlationId ?? null,
    input.metadata ?? {},
  );
  const transitionEvent: TransitionEvent = {
    id: buildStableEntityId("transition-event", [
      input.organizationId,
      input.workOrderId,
      input.requestId ?? input.correlationId ?? occurredAt,
      input.fromLifecycleStatus,
      input.toLifecycleStatus,
    ]),
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
    id: buildStableEntityId("transition-audit", [
      input.organizationId,
      input.workOrderId,
      input.requestId ?? input.correlationId ?? occurredAt,
      input.fromLifecycleStatus,
      input.toLifecycleStatus,
    ]),
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
    id: buildStableEntityId("domain-event-transition", [
      input.organizationId,
      input.workOrderId,
      input.requestId ?? input.correlationId ?? occurredAt,
      input.fromLifecycleStatus,
      input.toLifecycleStatus,
    ]),
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

  return {
    domainEvent,
    transitionEvent,
    transitionAudit,
  };
}

function buildRecordId(input: {
  fallbackId: EntityId;
  organizationId: EntityId;
  requestId: string | null;
  type: DomainEventType;
  entityType: EventEntityReference["entityType"];
  entityId: EntityId | null;
  workOrderId: EntityId | null;
}): EntityId {
  if (!input.requestId) {
    return input.fallbackId;
  }

  return buildStableEntityId("domain-event", [
    input.organizationId,
    input.requestId,
    input.type,
    input.entityType,
    input.entityId,
    input.workOrderId,
  ]);
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
