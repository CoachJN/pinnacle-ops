import "server-only";

import {
  COMMUNICATION_CHANNELS,
  COMMUNICATION_DIRECTIONS,
  canActorReadCommunicationVisibility,
  type CommunicationActorReference,
  type CommunicationAttachment,
  type CommunicationChannel,
  type CommunicationDirection,
  type CommunicationLink,
  type CommunicationLinkEntityType,
  type CommunicationMatchSuggestion,
  type CommunicationMessage,
  type CommunicationParticipant,
  type CommunicationThread,
  type CommunicationTimelineEntry,
  type CommunicationTimelineAttachment,
  type CommunicationVisibility,
} from "@/modules/communications";
import type { AccessActor } from "@/types/auth";
import type { EntityId } from "@/types/entity";
import { USER_ROLES } from "@/types/permissions";
import type { DomainEventService } from "@/server/services/domain-event-service";
import type { FirestoreRepositories } from "@/server/repositories";
import { notFoundError, validationError } from "./errors";
import {
  nowIso,
  serviceFail,
  serviceOk,
  type ServiceAuditContext,
  type ServiceResult,
} from "./types";

export interface EnsureCommunicationThreadInput extends ServiceAuditContext {
  workOrderId: EntityId;
  channel: CommunicationChannel;
  visibility: CommunicationVisibility[];
  subject?: string | null;
  relatedEventIds?: EntityId[];
  linkedEntityIds?: EntityId[];
}

export interface CreateCommunicationMessageInput extends ServiceAuditContext {
  workOrderId: EntityId;
  threadId?: EntityId | null;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  visibility: CommunicationVisibility[];
  subject?: string | null;
  body: string;
  plainTextBody?: string | null;
  normalizedContent?: string | null;
  clientContactId?: EntityId | null;
  contractorOrganizationId?: EntityId | null;
  participantSeeds?: Array<{
    userId?: EntityId | null;
    userRole?: CommunicationParticipant["userRole"];
    contactId?: EntityId | null;
    clientOrganizationId?: EntityId | null;
    contractorOrganizationId?: EntityId | null;
    displayName?: string | null;
    email?: string | null;
    phone?: string | null;
    visibility?: CommunicationVisibility[];
    metadata?: Record<string, unknown>;
  }>;
  relatedEventIds?: EntityId[];
  linkedEntities?: Array<{
    entityType: CommunicationLinkEntityType;
    entityId: EntityId;
    relationshipType: CommunicationLink["relationshipType"];
  }>;
  metadata?: Record<string, unknown>;
  sentAt?: string | null;
  externalProvider?: string | null;
  externalThreadId?: string | null;
  externalMessageId?: string | null;
}

export interface CreateInternalNoteInput extends ServiceAuditContext {
  workOrderId: EntityId;
  body: string;
}

export interface RecordCommunicationAttachmentInput extends ServiceAuditContext {
  workOrderId: EntityId;
  fileName: string;
  contentType: string | null;
  sizeBytes: number;
  storagePath: string;
  visibility: CommunicationVisibility[];
}

export interface CommunicationThreadService {
  ensureWorkOrderThread(
    input: EnsureCommunicationThreadInput,
  ): Promise<ServiceResult<CommunicationThread>>;
}

export interface CommunicationMessageService {
  create(input: CreateCommunicationMessageInput): Promise<ServiceResult<CommunicationMessage>>;
  createInternalNote(
    input: CreateInternalNoteInput,
  ): Promise<ServiceResult<CommunicationMessage>>;
  recordAttachment(
    input: RecordCommunicationAttachmentInput,
  ): Promise<ServiceResult<{ message: CommunicationMessage; attachment: CommunicationAttachment }>>;
}

export interface CommunicationQueryService {
  listTimelineForWorkOrder(
    workOrderId: EntityId,
    actor: AccessActor,
  ): Promise<ServiceResult<CommunicationTimelineEntry[]>>;
  listInternalNotesForWorkOrder(
    workOrderId: EntityId,
  ): Promise<ServiceResult<CommunicationMessage[]>>;
  listPendingMatchSuggestions(
    organizationId: EntityId,
  ): Promise<ServiceResult<CommunicationMatchSuggestion[]>>;
}

export interface CommunicationVisibilityService {
  canActorRead(
    actor: AccessActor,
    visibility: readonly CommunicationVisibility[],
  ): boolean;
}

export interface CommunicationDomainServices {
  threads: CommunicationThreadService;
  messages: CommunicationMessageService;
  query: CommunicationQueryService;
  visibility: CommunicationVisibilityService;
}

export function createCommunicationServices(
  repositories: Pick<
    FirestoreRepositories,
    | "communicationAttachments"
    | "communicationLinks"
    | "communicationMatchSuggestions"
    | "communicationMessages"
    | "communicationParticipants"
    | "communicationThreads"
    | "workOrders"
  >,
  dependencies: {
    domainEvents: DomainEventService;
  },
): CommunicationDomainServices {
  const visibility = new DefaultCommunicationVisibilityService();
  const threads = new DefaultCommunicationThreadService(repositories);
  const messages = new DefaultCommunicationMessageService(repositories, dependencies, threads);
  const query = new DefaultCommunicationQueryService(repositories, visibility);

  return {
    threads,
    messages,
    query,
    visibility,
  };
}

class DefaultCommunicationVisibilityService implements CommunicationVisibilityService {
  canActorRead(
    actor: AccessActor,
    visibility: readonly CommunicationVisibility[],
  ): boolean {
    return canActorReadCommunicationVisibility(actor, visibility);
  }
}

class DefaultCommunicationThreadService implements CommunicationThreadService {
  constructor(
    private readonly repositories: Pick<
      FirestoreRepositories,
      "communicationThreads" | "workOrders"
    >,
  ) {}

  async ensureWorkOrderThread(
    input: EnsureCommunicationThreadInput,
  ): Promise<ServiceResult<CommunicationThread>> {
    const workOrder = await this.repositories.workOrders.getById(input.workOrderId);
    if (!workOrder || workOrder.isDeleted) {
      return serviceFail(notFoundError("Work order could not be found."));
    }
    if (workOrder.organizationId !== input.organizationId) {
      return serviceFail(validationError("Work order does not belong to this organization."));
    }

    const existing =
      await this.repositories.communicationThreads.findByWorkOrderChannelVisibility({
        workOrderId: input.workOrderId,
        channel: input.channel,
        visibility: input.visibility,
      });
    if (existing) {
      return serviceOk(existing);
    }

    const createdAt = input.now ?? nowIso();
    const actor = toCommunicationActor(input);
    const thread: CommunicationThread = {
      id: this.repositories.communicationThreads.newId(),
      organizationId: input.organizationId,
      tenantId: input.organizationId,
      workOrderId: input.workOrderId,
      channel: input.channel,
      subject: input.subject ?? null,
      visibility: [...new Set(input.visibility)],
      participantIds: [],
      relatedEventIds: [...new Set(input.relatedEventIds ?? [])],
      linkedEntityIds: [...new Set(input.linkedEntityIds ?? [input.workOrderId])],
      lastMessageId: null,
      lastMessageAt: null,
      externalProvider: null,
      externalThreadId: null,
      metadata: {},
      createdAt,
      createdByActor: actor,
      updatedAt: createdAt,
    };

    await this.repositories.communicationThreads.create(thread);
    return serviceOk(thread);
  }
}

class DefaultCommunicationMessageService implements CommunicationMessageService {
  constructor(
    private readonly repositories: Pick<
      FirestoreRepositories,
      | "communicationAttachments"
      | "communicationLinks"
      | "communicationMessages"
      | "communicationParticipants"
      | "communicationThreads"
      | "workOrders"
    >,
    private readonly dependencies: {
      domainEvents: DomainEventService;
    },
    private readonly threads: CommunicationThreadService,
  ) {}

  async create(
    input: CreateCommunicationMessageInput,
  ): Promise<ServiceResult<CommunicationMessage>> {
    const body = input.body.trim();
    if (!body) {
      return serviceFail(validationError("Communication body is required."));
    }

    const workOrder = await this.repositories.workOrders.getById(input.workOrderId);
    if (!workOrder || workOrder.isDeleted) {
      return serviceFail(notFoundError("Work order could not be found."));
    }
    if (workOrder.organizationId !== input.organizationId) {
      return serviceFail(validationError("Work order does not belong to this organization."));
    }

    const createdAt = input.now ?? nowIso();
    const threadResult = input.threadId
      ? await this.resolveThread(input.threadId)
      : await this.threads.ensureWorkOrderThread({
          ...input,
          subject: input.subject ?? null,
          relatedEventIds: input.relatedEventIds,
          linkedEntityIds: [input.workOrderId],
        });
    if (!threadResult.ok) {
      return threadResult;
    }

    const thread = threadResult.value;
    const actor = toCommunicationActor(input);
    const participantIds = await this.ensureParticipants(thread, input, actor, createdAt);
    const linkedEntities = dedupeLinkedEntities(
      input.workOrderId,
      input.linkedEntities ?? [],
    );
    const message: CommunicationMessage = {
      id: this.repositories.communicationMessages.newId(),
      organizationId: input.organizationId,
      tenantId: input.organizationId,
      threadId: thread.id,
      workOrderId: input.workOrderId,
      referenceMessageId: null,
      channel: input.channel,
      direction: input.direction,
      visibility: [...new Set(input.visibility)],
      subject: input.subject ?? thread.subject ?? null,
      body,
      plainTextBody: input.plainTextBody?.trim() || body,
      normalizedContent: (input.normalizedContent?.trim() || body).toLowerCase(),
      metadata: input.metadata ?? {},
      senderActorId: actor.actorId,
      senderActorType: actor.actorType,
      senderActorRole: actor.actorRole,
      participantIds,
      clientContactId: input.clientContactId ?? null,
      contractorOrganizationId: input.contractorOrganizationId ?? null,
      linkedEntityIds: linkedEntities.map((item) => item.entityId),
      relatedEventIds: [...new Set(input.relatedEventIds ?? [])],
      sentAt: input.sentAt ?? createdAt,
      deliveredAt: null,
      readAt: null,
      externalProvider: input.externalProvider ?? null,
      externalThreadId: input.externalThreadId ?? thread.externalThreadId ?? null,
      externalMessageId: input.externalMessageId ?? null,
      createdAt,
      createdByActor: actor,
    };

    await this.repositories.communicationMessages.create(message);
    await Promise.all(
      linkedEntities.map(async (linkInput) => {
        const link: CommunicationLink = {
          id: this.repositories.communicationLinks.newId(),
          organizationId: input.organizationId,
          tenantId: input.organizationId,
          threadId: thread.id,
          messageId: message.id,
          workOrderId: input.workOrderId,
          entityType: linkInput.entityType,
          entityId: linkInput.entityId,
          relationshipType: linkInput.relationshipType,
          createdAt,
          createdByActor: actor,
          metadata: {},
        };
        await this.repositories.communicationLinks.create(link);
      }),
    );

    const updatedThread: CommunicationThread = {
      ...thread,
      participantIds: [...new Set([...thread.participantIds, ...participantIds])],
      relatedEventIds: [...new Set([...thread.relatedEventIds, ...message.relatedEventIds])],
      linkedEntityIds: [
        ...new Set([
          ...thread.linkedEntityIds,
          ...linkedEntities.map((item) => item.entityId),
        ]),
      ],
      lastMessageId: message.id,
      lastMessageAt: createdAt,
      updatedAt: createdAt,
    };
    await this.repositories.communicationThreads.save(updatedThread);

    if (thread.lastMessageId === null) {
      await this.dependencies.domainEvents.record({
        ...input,
        now: createdAt,
        workOrderId: input.workOrderId,
        type: "communication_thread_created",
        visibility: toEventVisibility(message.visibility),
        lifecycleStatus: workOrder.lifecycleStatus,
        entity: {
          entityType: "communication_thread",
          entityId: thread.id,
          label: thread.subject,
        },
        summary: `Opened ${thread.channel.replaceAll("_", " ")} thread.`,
        payload: {
          threadId: thread.id,
          channel: thread.channel,
          visibility: thread.visibility,
        },
      });
    }

    await this.dependencies.domainEvents.record({
      ...input,
      now: createdAt,
      workOrderId: input.workOrderId,
      type: "communication_message_created",
      visibility: toEventVisibility(message.visibility),
      lifecycleStatus: workOrder.lifecycleStatus,
      entity: {
        entityType: "communication_message",
        entityId: message.id,
        label: message.subject ?? null,
      },
      summary: summarizeMessage(message),
      payload: {
        threadId: thread.id,
        messageId: message.id,
        channel: message.channel,
        direction: message.direction,
      },
    });

    await Promise.all(
      linkedEntities
        .filter((item) => item.entityType !== "work_order")
        .map((item) =>
          this.dependencies.domainEvents.record({
            ...input,
            now: createdAt,
            workOrderId: input.workOrderId,
            type: "communication_message_linked",
            visibility: toEventVisibility(message.visibility),
            lifecycleStatus: workOrder.lifecycleStatus,
            entity: {
              entityType: "communication_link",
              entityId: message.id,
              label: null,
            },
            summary: `Linked communication to ${item.entityType.replaceAll("_", " ")}.`,
            payload: {
              messageId: message.id,
              entityType: item.entityType,
              entityId: item.entityId,
              relationshipType: item.relationshipType,
            },
          }),
        ),
    );

    return serviceOk(message);
  }

  async createInternalNote(
    input: CreateInternalNoteInput,
  ): Promise<ServiceResult<CommunicationMessage>> {
    return this.create({
      ...input,
      channel: COMMUNICATION_CHANNELS.InternalNote,
      direction: COMMUNICATION_DIRECTIONS.Internal,
      visibility: ["internal"],
      body: input.body,
      subject: "Internal note",
    });
  }

  async recordAttachment(
    input: RecordCommunicationAttachmentInput,
  ): Promise<ServiceResult<{ message: CommunicationMessage; attachment: CommunicationAttachment }>> {
    const messageResult = await this.create({
      ...input,
      channel: COMMUNICATION_CHANNELS.InternalNote,
      direction: COMMUNICATION_DIRECTIONS.Internal,
      visibility: input.visibility,
      body: `Attachment added: ${input.fileName}`,
      plainTextBody: input.fileName,
      normalizedContent: input.fileName,
      metadata: {
        communicationKind: "attachment",
        fileName: input.fileName,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
      },
    });
    if (!messageResult.ok) {
      return messageResult;
    }

    const message = messageResult.value;
    const attachment: CommunicationAttachment = {
      id: this.repositories.communicationAttachments.newId(),
      organizationId: input.organizationId,
      tenantId: input.organizationId,
      threadId: message.threadId,
      messageId: message.id,
      workOrderId: input.workOrderId,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      storagePath: input.storagePath,
      hydrationStatus: "hydrated",
      hydratedAt: input.now ?? nowIso(),
      hydrationError: null,
      contentHash: null,
      visibility: input.visibility,
      uploadedByActor: toCommunicationActor(input),
      externalProvider: null,
      externalAttachmentId: null,
      metadata: {},
      createdAt: input.now ?? nowIso(),
    };
    await this.repositories.communicationAttachments.create(attachment);

    return serviceOk({ message, attachment });
  }

  private async resolveThread(
    threadId: EntityId,
  ): Promise<ServiceResult<CommunicationThread>> {
    const thread = await this.repositories.communicationThreads.getById(threadId);
    if (!thread) {
      return serviceFail(notFoundError("Communication thread could not be found."));
    }

    return serviceOk(thread);
  }

  private async ensureParticipants(
    thread: CommunicationThread,
    input: CreateCommunicationMessageInput,
    actor: CommunicationActorReference,
    createdAt: string,
  ): Promise<EntityId[]> {
    const existing = await this.repositories.communicationParticipants.listByThreadId(thread.id, {
      limit: 100,
    });
    const existingIds = new Set(existing.items.map((item) => item.id));
    const seeds = [
      {
        userId: actor.actorId,
        userRole: actor.actorRole,
        displayName: actor.displayName,
        visibility: input.visibility,
      },
      ...(input.participantSeeds ?? []),
    ];
    const createdIds: EntityId[] = [];

    for (const seed of seeds) {
      const duplicate = existing.items.find((item) =>
        item.userId === (seed.userId ?? null) &&
        item.contactId === (seed.contactId ?? null) &&
        item.clientOrganizationId === (seed.clientOrganizationId ?? null) &&
        item.contractorOrganizationId === (seed.contractorOrganizationId ?? null),
      );
      if (duplicate) {
        createdIds.push(duplicate.id);
        continue;
      }

      const participant: CommunicationParticipant = {
        id: this.repositories.communicationParticipants.newId(),
        organizationId: input.organizationId,
        tenantId: input.organizationId,
        threadId: thread.id,
        workOrderId: input.workOrderId,
        actorType: seed.userId ? "user" : actor.actorType,
        userId: seed.userId ?? null,
        userRole: seed.userRole ?? null,
        contactId: seed.contactId ?? null,
        clientOrganizationId: seed.clientOrganizationId ?? null,
        contractorOrganizationId: seed.contractorOrganizationId ?? null,
        displayName: seed.displayName ?? null,
        email: seed.email ?? null,
        phone: seed.phone ?? null,
        visibility: seed.visibility ?? input.visibility,
        joinedAt: createdAt,
        metadata: seed.metadata ?? {},
      };
      if (!existingIds.has(participant.id)) {
        await this.repositories.communicationParticipants.create(participant);
        createdIds.push(participant.id);
        existingIds.add(participant.id);
      }
    }

    return [...new Set([...thread.participantIds, ...createdIds])];
  }
}

class DefaultCommunicationQueryService implements CommunicationQueryService {
  constructor(
    private readonly repositories: Pick<
      FirestoreRepositories,
      | "communicationAttachments"
      | "communicationMatchSuggestions"
      | "communicationMessages"
    >,
    private readonly visibility: CommunicationVisibilityService,
  ) {}

  async listTimelineForWorkOrder(
    workOrderId: EntityId,
    actor: AccessActor,
  ): Promise<ServiceResult<CommunicationTimelineEntry[]>> {
    const [messagesResult, attachmentsResult] = await Promise.all([
      this.repositories.communicationMessages.listByWorkOrderId(workOrderId, { limit: 200 }),
      this.repositories.communicationAttachments.listByWorkOrderId(workOrderId, { limit: 200 }),
    ]);
    const attachmentsByMessageId = new Map<EntityId, CommunicationAttachment[]>();
    for (const attachment of attachmentsResult.items) {
      const items = attachmentsByMessageId.get(attachment.messageId) ?? [];
      items.push(attachment);
      attachmentsByMessageId.set(attachment.messageId, items);
    }

    const items = messagesResult.items
      .filter((message) => this.visibility.canActorRead(actor, message.visibility))
      .sort((left, right) => compareImmutableRecords(left.createdAt, right.createdAt, left.id, right.id))
      .map((message) => ({
        id: message.id,
        threadId: message.threadId,
        messageId: message.id,
        workOrderId: message.workOrderId,
        channel: message.channel,
        direction: message.direction,
        visibility: message.visibility,
        subject: message.subject,
        body: message.body,
        plainTextBody: message.plainTextBody,
        createdAt: message.createdAt,
        sentAt: message.sentAt,
        actor: message.createdByActor,
        attachments: toVisibleTimelineAttachments(
          actor,
          attachmentsByMessageId.get(message.id) ?? [],
          this.visibility,
        ),
        relatedEventIds: message.relatedEventIds,
        linkedEntityIds: message.linkedEntityIds,
      }));

    return serviceOk(items);
  }

  async listInternalNotesForWorkOrder(
    workOrderId: EntityId,
  ): Promise<ServiceResult<CommunicationMessage[]>> {
    const result = await this.repositories.communicationMessages.listByWorkOrderId(workOrderId, {
      limit: 200,
    });
    return serviceOk(
      result.items.filter(
        (message) =>
          message.channel === COMMUNICATION_CHANNELS.InternalNote &&
          message.direction === COMMUNICATION_DIRECTIONS.Internal &&
          message.visibility.includes("internal"),
      ),
    );
  }

  async listPendingMatchSuggestions(
    organizationId: EntityId,
  ): Promise<ServiceResult<CommunicationMatchSuggestion[]>> {
    const result = await this.repositories.communicationMatchSuggestions.listPendingReview(
      organizationId,
      { limit: 100 },
    );
    return serviceOk(result.items);
  }
}

function toVisibleTimelineAttachments(
  actor: AccessActor,
  attachments: readonly CommunicationAttachment[],
  visibility: CommunicationVisibilityService,
): CommunicationTimelineAttachment[] {
  return attachments
    .filter((attachment) => visibility.canActorRead(actor, attachment.visibility))
    .map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      visibility: attachment.visibility,
      hydrationStatus: attachment.hydrationStatus,
      hydratedAt: attachment.hydratedAt,
      createdAt: attachment.createdAt,
    }));
}

function toCommunicationActor(context: ServiceAuditContext): CommunicationActorReference {
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

function roleDisplayName(role: CommunicationActorReference["actorRole"]): string {
  switch (role) {
    case USER_ROLES.Coordinator:
      return "Coordinator";
    case USER_ROLES.Manager:
      return "Manager";
    case USER_ROLES.Owner:
      return "Owner";
    case USER_ROLES.FinanceAdmin:
      return "Finance";
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

function summarizeMessage(message: CommunicationMessage): string {
  if (message.channel === COMMUNICATION_CHANNELS.InternalNote) {
    return `Internal note: ${truncate(message.plainTextBody, 80)}`;
  }

  return `${message.channel.replaceAll("_", " ")} message: ${truncate(message.plainTextBody, 80)}`;
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}

function dedupeLinkedEntities(
  workOrderId: EntityId,
  input: readonly {
    entityType: CommunicationLinkEntityType;
    entityId: EntityId;
    relationshipType: CommunicationLink["relationshipType"];
  }[],
) {
  const items = [
    {
      entityType: "work_order" as const,
      entityId: workOrderId,
      relationshipType: "primary" as const,
    },
    ...input,
  ];
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.entityType}:${item.entityId}:${item.relationshipType}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function compareImmutableRecords(
  leftCreatedAt: string,
  rightCreatedAt: string,
  leftId: EntityId,
  rightId: EntityId,
): number {
  const timeOrder = Date.parse(rightCreatedAt) - Date.parse(leftCreatedAt);
  if (timeOrder !== 0) {
    return timeOrder;
  }

  return rightId.localeCompare(leftId);
}

function toEventVisibility(
  visibility: readonly CommunicationVisibility[],
): "internal" | "client" | "contractor" | "finance" | "system" {
  if (visibility.includes("finance")) {
    return "finance";
  }
  if (visibility.includes("client")) {
    return "client";
  }
  if (visibility.includes("contractor")) {
    return "contractor";
  }
  if (visibility.includes("system")) {
    return "system";
  }
  return "internal";
}
