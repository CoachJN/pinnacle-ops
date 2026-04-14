import { APP_ROLES } from "@/lib/rbac/roles";
import type { WorkOrder } from "@/server/repositories";
import type { InternalUserRole, UserRole } from "@/types/permissions";
import {
  INTERNAL_NOTIFICATION_EVENT_TYPES,
  type InternalNotificationEventType,
  type NotificationRecipient,
  type NotificationRecipientContextUser,
} from "./types.ts";

interface RecipientResolutionInput {
  readonly eventType: InternalNotificationEventType;
  readonly workOrder: Pick<
    WorkOrder,
    "assignedCoordinatorUserId" | "assignedManagerUserId"
  > | null;
  readonly organizationUsers: readonly NotificationRecipientContextUser[];
}

export function resolveInternalNotificationRecipients(
  input: RecipientResolutionInput,
): readonly NotificationRecipient[] {
  const recipients = new Map<string, NotificationRecipient>();

  const includeAssignedCoordinator = () => {
    if (!input.workOrder?.assignedCoordinatorUserId) {
      return;
    }

    const coordinator = input.organizationUsers.find(
      (user) =>
        user.id === input.workOrder?.assignedCoordinatorUserId &&
        user.role === APP_ROLES.Coordinator,
    );
    if (coordinator) {
      recipients.set(coordinator.id, {
        userId: coordinator.id,
        role: APP_ROLES.Coordinator,
        displayName: coordinator.displayName ?? coordinator.id,
      });
    }
  };

  const includeAssignedManager = () => {
    if (!input.workOrder?.assignedManagerUserId) {
      return;
    }

    const manager = input.organizationUsers.find(
      (user) =>
        user.id === input.workOrder?.assignedManagerUserId &&
        (user.role === APP_ROLES.Manager || user.role === APP_ROLES.Owner),
    );
    if (manager && isInternalRecipientRole(manager.role)) {
      recipients.set(manager.id, {
        userId: manager.id,
        role: manager.role,
        displayName: manager.displayName ?? manager.id,
      });
    }
  };

  const includeRole = (role: InternalUserRole) => {
    input.organizationUsers
      .filter((user) => user.role === role)
      .forEach((user) => {
        recipients.set(user.id, {
          userId: user.id,
          role,
          displayName: user.displayName ?? user.id,
        });
      });
  };

  const includeRoles = (roles: readonly InternalUserRole[]) => {
    roles.forEach(includeRole);
  };

  switch (input.eventType) {
    case INTERNAL_NOTIFICATION_EVENT_TYPES.ContractorAssigned:
    case INTERNAL_NOTIFICATION_EVENT_TYPES.ContractorAccepted:
    case INTERNAL_NOTIFICATION_EVENT_TYPES.ContractorCompletedAssignment:
      includeAssignedCoordinator();
      includeAssignedManager();
      includeRole(APP_ROLES.Owner);
      break;
    case INTERNAL_NOTIFICATION_EVENT_TYPES.ContractorDeclined:
      includeAssignedCoordinator();
      includeAssignedManager();
      includeRole(APP_ROLES.Owner);
      break;
    case INTERNAL_NOTIFICATION_EVENT_TYPES.QuoteSubmitted:
      includeAssignedCoordinator();
      includeAssignedManager();
      break;
    case INTERNAL_NOTIFICATION_EVENT_TYPES.QuoteAwaitingManagerReview:
      includeAssignedManager();
      includeRole(APP_ROLES.Owner);
      break;
    case INTERNAL_NOTIFICATION_EVENT_TYPES.QuoteAwaitingClientAction:
      includeAssignedCoordinator();
      includeAssignedManager();
      break;
    case INTERNAL_NOTIFICATION_EVENT_TYPES.WorkOrderReadyForInvoicing:
    case INTERNAL_NOTIFICATION_EVENT_TYPES.InvoiceCreated:
    case INTERNAL_NOTIFICATION_EVENT_TYPES.InvoiceSent:
      includeRoles([APP_ROLES.FinanceAdmin, APP_ROLES.Owner]);
      break;
    case INTERNAL_NOTIFICATION_EVENT_TYPES.InvoiceOverdue:
    case INTERNAL_NOTIFICATION_EVENT_TYPES.SlaBreachTriggered:
      includeRoles([APP_ROLES.FinanceAdmin, APP_ROLES.Manager, APP_ROLES.Owner]);
      includeAssignedCoordinator();
      includeAssignedManager();
      break;
    case INTERNAL_NOTIFICATION_EVENT_TYPES.WorkOrderStalled:
      includeAssignedCoordinator();
      includeAssignedManager();
      includeRole(APP_ROLES.Owner);
      break;
  }

  return [...recipients.values()];
}

function isInternalRecipientRole(role: UserRole): role is InternalUserRole {
  return (
    role === APP_ROLES.Coordinator ||
    role === APP_ROLES.Manager ||
    role === APP_ROLES.FinanceAdmin ||
    role === APP_ROLES.Owner
  );
}
