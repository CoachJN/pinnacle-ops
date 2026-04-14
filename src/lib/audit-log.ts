import type {
  AuthorizableEntity,
  AuthorizationAction,
  AuthorizationAuditEvent,
} from "@/lib/authorization";
import type { AccessActor } from "@/types/auth";
import type { EntityId, IsoDateTimeString } from "@/types/entity";

export type SecurityAuditEventKind =
  | AuthorizationAuditEvent["kind"]
  | "status_transition"
  | "financial_action";

export interface SecurityAuditEvent {
  eventType: "security_audit";
  kind: SecurityAuditEventKind;
  userId: EntityId;
  role: AccessActor["role"];
  action: AuthorizationAction;
  entity: AuthorizableEntity;
  entityId?: EntityId;
  organizationId?: EntityId;
  timestamp: IsoDateTimeString;
  currentStatus?: string;
  nextStatus?: string;
  reason?: string;
  correlationId?: string;
}

export interface SecurityAuditEventSink {
  persist(event: SecurityAuditEvent): void | Promise<void>;
}

export type SecurityAuditLogger = (
  event: SecurityAuditEvent,
) => void | Promise<void>;

const processLocalAuditEvents: SecurityAuditEvent[] = [];
let configuredAuditSink: SecurityAuditEventSink | undefined;

export function configureSecurityAuditSink(sink: SecurityAuditEventSink): void {
  configuredAuditSink = sink;
}

export function getProcessLocalAuditEvents(): readonly SecurityAuditEvent[] {
  return processLocalAuditEvents;
}

export function createSecurityAuditLogger(
  sink: SecurityAuditEventSink,
): SecurityAuditLogger {
  return (event) => {
    void sink.persist(event);
  };
}

export const defaultSecurityAuditLogger: SecurityAuditLogger = (event) => {
  processLocalAuditEvents.push(event);
  void configuredAuditSink?.persist(event);
};

export function authorizationAuditToSecurityAuditEvent(
  event: AuthorizationAuditEvent,
  timestamp: IsoDateTimeString = new Date().toISOString(),
): SecurityAuditEvent {
  return {
    eventType: "security_audit",
    kind: event.kind,
    userId: event.actor.userId,
    role: event.actor.role,
    action: event.action,
    entity: event.entity,
    entityId: event.targetEntityId,
    organizationId: event.organizationId,
    timestamp,
    currentStatus: event.currentStatus,
    nextStatus: event.nextStatus,
    reason: event.reason,
    correlationId: event.correlationId,
  };
}

export function createAuthorizationAuditLogger(
  logger: SecurityAuditLogger = defaultSecurityAuditLogger,
) {
  return (event: AuthorizationAuditEvent): void => {
    void logger(authorizationAuditToSecurityAuditEvent(event));
  };
}
