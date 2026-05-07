import "server-only";

import {
  buildInternalNotificationRecords,
  buildOperationalAlertFeed,
  resolveInternalNotificationRecipients,
  type InternalNotificationEventType,
  type InternalNotificationRecord,
  type NotificationActorSummary,
  type NotificationMessageContext,
  type OperationalAlertItem,
} from "@/modules/notifications";
import { APP_ROLES } from "@/lib/rbac/roles";
import type {
  Assignment,
  ClientInvoice,
  ClientQuote,
  FirestoreRepositories,
  InternalNotification,
  WorkOrder,
} from "@/server/repositories";
import type { EntityId } from "@/types/entity";
import type { InternalUserRole } from "@/types/permissions";
import {
  createAuditFields,
  serviceOk,
  type ServiceAuditContext,
  type ServiceResult,
} from "./types";

export interface NotificationService {
  captureOperationalEvent(
    input: CaptureOperationalEventInput,
  ): Promise<ServiceResult<readonly InternalNotificationRecord[]>>;
  listAlertsForUser(input: ListAlertsForUserInput): Promise<
    ServiceResult<readonly OperationalAlertItem[]>
  >;
}

export interface CaptureOperationalEventInput extends ServiceAuditContext {
  readonly eventType: InternalNotificationEventType;
  readonly entityType: "work-order" | "invoice" | "quote" | "assignment";
  readonly entityId: EntityId;
  readonly workOrder?: Pick<
    WorkOrder,
    | "id"
    | "workOrderNumber"
    | "coordinatorUserId"
    | "managerUserId"
    | "clientSnapshot"
    | "locationSnapshot"
  > | null;
  readonly invoice?: Pick<ClientInvoice, "id" | "invoiceNumber"> | null;
  readonly quote?: Pick<ClientQuote, "id"> | null;
  readonly assignment?: Pick<Assignment, "id"> | null;
  readonly contractorName?: string | null;
  readonly fromStatus?: string | null;
  readonly toStatus?: string | null;
  readonly targetPath?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ListAlertsForUserInput {
  readonly recipientUserId: EntityId;
  readonly limit?: number;
  readonly now?: string;
}

export function createNotificationService(
  repositories: Pick<
    FirestoreRepositories,
    "internalNotifications" | "userProfiles"
  >,
): NotificationService {
  return new FirestoreNotificationService(repositories);
}

class FirestoreNotificationService implements NotificationService {
  constructor(
    private readonly repositories: Pick<
      FirestoreRepositories,
      "internalNotifications" | "userProfiles"
    >,
  ) {}

  async captureOperationalEvent(
    input: CaptureOperationalEventInput,
  ): Promise<ServiceResult<readonly InternalNotificationRecord[]>> {
    const createdAt = input.now ?? new Date().toISOString();
    const [organizationUsers, actorProfile] = await Promise.all([
      this.repositories.userProfiles.listByOrganizationId(input.organizationId, {
        limit: 250,
      }),
      this.repositories.userProfiles.getById(input.actor.userId),
    ]);

    const recipients = resolveInternalNotificationRecipients({
      eventType: input.eventType,
      workOrder: input.workOrder ?? null,
      organizationUsers: organizationUsers.items
        .filter((user) => isInternalRecipientRole(user.role))
        .map((user) => ({
          id: user.id,
          role: user.role,
          displayName: user.displayName,
        })),
    });

    if (recipients.length === 0) {
      return serviceOk([]);
    }

    const actor: NotificationActorSummary = {
      actorType: input.actor.role === "system" ? "system" : "user",
      userId: input.actor.role === "system" ? null : input.actor.userId,
      role: input.actor.role,
      displayName:
        actorProfile?.displayName?.trim() ||
        actorProfile?.email?.trim() ||
        input.actor.userId,
    };

    const notificationRecords = buildInternalNotificationRecords({
      organizationId: input.organizationId,
      eventType: input.eventType,
      recipients,
      actor,
      context: buildMessageContext(input),
      createdAt,
      metadata: input.metadata,
    }).map((notification) => ({
      ...notification,
      targetPath: input.targetPath ?? notification.targetPath,
      createdAt,
      updatedAt: createdAt,
    }));

    const persistedNotifications: readonly InternalNotification[] =
      notificationRecords.map((notification) => ({
        ...createAuditFields({ ...input, now: createdAt }),
        ...notification,
      }));

    await this.repositories.internalNotifications.createMany(persistedNotifications);

    return serviceOk(notificationRecords);
  }

  async listAlertsForUser(
    input: ListAlertsForUserInput,
  ): Promise<ServiceResult<readonly OperationalAlertItem[]>> {
    const notifications =
      await this.repositories.internalNotifications.listByRecipientUserId(
        input.recipientUserId,
        {
          status: "active",
          limit: input.limit ?? 12,
        },
      );

    return serviceOk(
      buildOperationalAlertFeed({
        notifications: notifications.items.map(toNotificationRecord),
        now: input.now,
      }),
    );
  }
}

function buildMessageContext(
  input: CaptureOperationalEventInput,
): NotificationMessageContext {
  return {
    entityType: input.entityType,
    entityId: input.entityId,
    workOrderId: input.workOrder?.id ?? null,
    invoiceId: input.invoice?.id ?? null,
    quoteId: input.quote?.id ?? null,
    assignmentId: input.assignment?.id ?? null,
    workOrderNumber: input.workOrder?.workOrderNumber ?? null,
    invoiceNumber: input.invoice?.invoiceNumber ?? null,
    quoteLabel: input.quote ? `Quote ${input.quote.id}` : null,
    assignmentLabel: input.assignment ? `Assignment ${input.assignment.id}` : null,
    contractorName: input.contractorName ?? null,
    clientName: input.workOrder?.clientSnapshot.name ?? null,
    locationName: input.workOrder?.locationSnapshot.name ?? null,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
  };
}

function isInternalRecipientRole(role: string): role is InternalUserRole {
  return (
    role === APP_ROLES.Coordinator ||
    role === APP_ROLES.Manager ||
    role === APP_ROLES.FinanceAdmin ||
    role === APP_ROLES.Owner
  );
}

function toNotificationRecord(
  notification: InternalNotification,
): InternalNotificationRecord {
  return {
    id: notification.id,
    organizationId: notification.organizationId,
    recipientUserId: notification.recipientUserId,
    recipientRole: notification.recipientRole as InternalUserRole,
    eventType: notification.eventType,
    title: notification.title,
    message: notification.message,
    severity: notification.severity,
    status: notification.status,
    actor: notification.actor,
    entityType: notification.entityType,
    entityId: notification.entityId,
    workOrderId: notification.workOrderId,
    invoiceId: notification.invoiceId,
    quoteId: notification.quoteId,
    assignmentId: notification.assignmentId,
    targetPath: notification.targetPath,
    readAt: notification.readAt,
    acknowledgedAt: notification.acknowledgedAt,
    resolvedAt: notification.resolvedAt,
    dueAt: notification.dueAt,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
    metadata: notification.metadata,
  };
}
