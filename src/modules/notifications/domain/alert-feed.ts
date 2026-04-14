import {
  INTERNAL_NOTIFICATION_SEVERITIES,
  OPERATIONAL_ALERT_STATES,
  type InternalNotificationRecord,
  type OperationalAlertState,
} from "./types.ts";

export interface OperationalAlertItem {
  readonly id: string;
  readonly eventType: InternalNotificationRecord["eventType"];
  readonly title: string;
  readonly message: string;
  readonly severity: InternalNotificationRecord["severity"];
  readonly state: OperationalAlertState;
  readonly targetPath: string;
  readonly workOrderId: string | null;
  readonly entityType: InternalNotificationRecord["entityType"];
  readonly entityId: string;
  readonly actorDisplayName: string;
  readonly recipientRole: InternalNotificationRecord["recipientRole"];
  readonly createdAt: string;
  readonly dueAt: string | null;
}

export function buildOperationalAlertFeed(input: {
  readonly notifications: readonly InternalNotificationRecord[];
  readonly now?: string;
}): readonly OperationalAlertItem[] {
  const now = input.now ?? new Date().toISOString();

  return [...input.notifications]
    .map((notification) => ({
      id: notification.id,
      eventType: notification.eventType,
      title: notification.title,
      message: notification.message,
      severity: notification.severity,
      state: getOperationalAlertState(notification, now),
      targetPath: notification.targetPath,
      workOrderId: notification.workOrderId,
      entityType: notification.entityType,
      entityId: notification.entityId,
      actorDisplayName: notification.actor.displayName,
      recipientRole: notification.recipientRole,
      createdAt: notification.createdAt,
      dueAt: notification.dueAt,
    }))
    .sort((left, right) => {
      const stateOrder = compareState(left.state, right.state);
      if (stateOrder !== 0) {
        return stateOrder;
      }

      const severityOrder = compareSeverity(left.severity, right.severity);
      if (severityOrder !== 0) {
        return severityOrder;
      }

      return Date.parse(right.createdAt) - Date.parse(left.createdAt);
    });
}

export function getOperationalAlertState(
  notification: Pick<
    InternalNotificationRecord,
    "severity" | "dueAt" | "eventType"
  >,
  now: string,
): OperationalAlertState {
  if (!notification.dueAt) {
    return OPERATIONAL_ALERT_STATES.Active;
  }

  const dueAt = Date.parse(notification.dueAt);
  const current = Date.parse(now);
  if (Number.isNaN(dueAt) || Number.isNaN(current)) {
    return OPERATIONAL_ALERT_STATES.Active;
  }

  if (current > dueAt) {
    if (
      notification.severity === INTERNAL_NOTIFICATION_SEVERITIES.High ||
      notification.severity === INTERNAL_NOTIFICATION_SEVERITIES.Critical ||
      notification.eventType === "invoice_overdue"
    ) {
      return OPERATIONAL_ALERT_STATES.SlaBreached;
    }

    return OPERATIONAL_ALERT_STATES.Overdue;
  }

  if (dueAt - current <= 12 * 60 * 60 * 1000) {
    return OPERATIONAL_ALERT_STATES.AtRisk;
  }

  return OPERATIONAL_ALERT_STATES.Active;
}

function compareState(left: OperationalAlertState, right: OperationalAlertState): number {
  const weight: Record<OperationalAlertState, number> = {
    sla_breached: 0,
    overdue: 1,
    at_risk: 2,
    active: 3,
  };

  return weight[left] - weight[right];
}

function compareSeverity(
  left: InternalNotificationRecord["severity"],
  right: InternalNotificationRecord["severity"],
): number {
  const weight: Record<InternalNotificationRecord["severity"], number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
  };

  return weight[left] - weight[right];
}
