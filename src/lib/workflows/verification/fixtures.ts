import type { ClientInvoice as Invoice } from "@/types/invoice";
import type { WorkOrder } from "@/types/work-order";
import type {
  WorkflowActionAvailabilityResult,
} from "../action-gating/index.ts";
import type {
  TransitionAuditRecord,
  TransitionEventRecord,
} from "../audit/index.ts";
import type {
  ClaimScheduledWorkflowActionsInput,
  ScheduledWorkflowExecutionRecord,
  ScheduledWorkflowExecutionStatus,
  WorkflowExecutionAdapters,
  WorkflowExecutionAttempt,
  WorkflowMonitoringSummary,
  WorkflowSlaBreachRecord,
  WorkflowSlaTimer,
} from "../execution/index.ts";
import {
  buildOptimizedWorkQueue,
  buildWorkflowOperationalInsights,
  computeWorkflowPriorityScore,
  type OptimizedWorkQueue,
  type WorkflowOperationalInsights,
  type WorkflowOptimizationContext,
  type WorkflowPriorityScore,
} from "../optimization/index.ts";
import type {
  WorkflowOrchestrationAction,
  WorkflowOrchestrationRecord,
} from "../orchestration/index.ts";
import type {
  AutomationIntent,
  NotificationIntent,
} from "../reactions/index.ts";
import type {
  InvoiceLifecycleStatus,
  WorkOrderLifecycleStatus,
} from "../lifecycle/index.ts";
import {
  INVOICE_STATUS,
  WORK_ORDER_STATUS,
} from "../lifecycle/index.ts";
import type {
  LifecycleTransitionRepositories,
  TransitionUpdateMetadata,
} from "../transition-service/index.ts";
import type { WorkflowVerificationArtifactSnapshot } from "./types.ts";

export class VerificationClock {
  #current: Date;

  constructor(now = "2026-01-01T00:00:00.000Z") {
    this.#current = new Date(now);
  }

  now(): string {
    return this.#current.toISOString();
  }

  advance(input: { hours?: number; minutes?: number; days?: number }): string {
    const deltaMs =
      (input.days ?? 0) * 24 * 60 * 60 * 1000 +
      (input.hours ?? 0) * 60 * 60 * 1000 +
      (input.minutes ?? 0) * 60 * 1000;
    this.#current = new Date(this.#current.getTime() + deltaMs);
    return this.now();
  }

  set(now: string): string {
    this.#current = new Date(now);
    return this.now();
  }
}

export interface WorkflowVerificationEnvironment
  extends Required<
    Pick<
      LifecycleTransitionRepositories,
      | "getWorkOrderById"
      | "updateWorkOrderStatus"
      | "getInvoiceById"
      | "updateInvoiceStatus"
      | "recordTransitionAudit"
      | "recordTransitionEvent"
      | "sendInternalNotification"
      | "sendClientNotification"
      | "enqueueAutomationIntent"
      | "createInternalTask"
      | "recordWorkflowOrchestrationAction"
      | "recordWorkflowOrchestrationActions"
      | "updateWorkflowOrchestrationActionStatus"
      | "listPendingWorkflowOrchestrationActions"
      | "claimScheduledWorkflowExecutions"
      | "claimScheduledWorkflowExecutionById"
      | "getScheduledWorkflowExecutionById"
      | "updateScheduledWorkflowExecutionStatus"
      | "recordWorkflowExecutionAttempt"
      | "executeScheduledWorkflowAction"
      | "listWorkflowExecutionsForMonitoring"
      | "recordWorkflowSlaTimer"
      | "recordWorkflowSlaTimers"
      | "listActiveWorkflowSlaTimersDue"
      | "listActiveWorkflowSlaTimersForEntity"
      | "updateWorkflowSlaTimerStatus"
      | "recordWorkflowSlaBreach"
      | "listWorkflowSlaTimersForMonitoring"
      | "listWorkflowSlaBreachesForMonitoring"
    >
  > {
  readonly clock: VerificationClock;
  readonly workOrders: Map<string, WorkOrder & { quoteRequired?: boolean; quoteStatus?: string | null }>;
  readonly invoices: Map<string, Invoice>;
  readonly transitionAuditRecords: TransitionAuditRecord[];
  readonly transitionEventRecords: TransitionEventRecord[];
  readonly sentInternalNotifications: NotificationIntent[];
  readonly sentClientNotifications: NotificationIntent[];
  readonly enqueuedAutomationIntents: AutomationIntent[];
  readonly workflowOrchestrationRecords: WorkflowOrchestrationRecord[];
  readonly scheduledWorkflowActions: ScheduledWorkflowExecutionRecord[];
  readonly workflowExecutionAttempts: WorkflowExecutionAttempt[];
  readonly workflowSlaTimers: WorkflowSlaTimer[];
  readonly workflowSlaBreaches: WorkflowSlaBreachRecord[];
  readonly actionAvailabilityResults: WorkflowActionAvailabilityResult[];
  readonly priorityScores: Map<string, WorkflowPriorityScore>;
  optimizationQueue?: OptimizedWorkQueue;
  operationalInsights?: WorkflowOperationalInsights;
  monitoringSummary?: WorkflowMonitoringSummary;
  failScheduledExecution?: boolean;
  seedWorkOrder: (input?: WorkOrderFixtureOverrides) => WorkOrder & { quoteRequired?: boolean; quoteStatus?: string | null };
  seedInvoice: (input?: InvoiceFixtureOverrides) => Invoice;
  setQuoteState: (workOrderId: string, quoteStatus: string | null) => void;
  recordActionAvailability: (result: WorkflowActionAvailabilityResult) => void;
  computeOptimization: (contexts?: readonly WorkflowOptimizationContext[]) => OptimizedWorkQueue;
  snapshot: () => WorkflowVerificationArtifactSnapshot;
}

export function createWorkflowVerificationEnvironment(input: {
  readonly now?: string;
} = {}): WorkflowVerificationEnvironment {
  const clock = new VerificationClock(input.now);
  const env: WorkflowVerificationEnvironment = {
    clock,
    workOrders: new Map(),
    invoices: new Map(),
    transitionAuditRecords: [],
    transitionEventRecords: [],
    sentInternalNotifications: [],
    sentClientNotifications: [],
    enqueuedAutomationIntents: [],
    workflowOrchestrationRecords: [],
    scheduledWorkflowActions: [],
    workflowExecutionAttempts: [],
    workflowSlaTimers: [],
    workflowSlaBreaches: [],
    actionAvailabilityResults: [],
    priorityScores: new Map(),
    failScheduledExecution: false,

    getWorkOrderById(entityId) {
      return this.workOrders.get(entityId) ?? null;
    },
    updateWorkOrderStatus(entityId, nextStatus, updateMeta) {
      const workOrder = this.workOrders.get(entityId);
      if (!workOrder) {
        throw new Error(`work order ${entityId} not found`);
      }
      workOrder.status = nextStatus as WorkOrder["status"];
      workOrder.updatedAt = this.clock.now();
      workOrder.updatedByUserId = updateMeta?.actorUserId ?? workOrder.updatedByUserId;
      return workOrder;
    },
    getInvoiceById(entityId) {
      return this.invoices.get(entityId) ?? null;
    },
    updateInvoiceStatus(entityId, nextStatus, updateMeta) {
      const invoice = this.invoices.get(entityId);
      if (!invoice) {
        throw new Error(`invoice ${entityId} not found`);
      }
      invoice.status = nextStatus as Invoice["status"];
      invoice.updatedAt = this.clock.now();
      invoice.updatedByUserId = updateMeta?.actorUserId ?? invoice.updatedByUserId;
      return invoice;
    },
    recordTransitionAudit(record) {
      this.transitionAuditRecords.push(record);
    },
    recordTransitionEvent(record) {
      this.transitionEventRecords.push(record);
    },
    sendInternalNotification(intent) {
      this.sentInternalNotifications.push(intent);
    },
    sendClientNotification(intent) {
      this.sentClientNotifications.push(intent);
    },
    enqueueAutomationIntent(intent) {
      this.enqueuedAutomationIntents.push(intent);
    },
    createInternalTask(intent) {
      this.enqueuedAutomationIntents.push(intent);
    },
    recordWorkflowOrchestrationAction(action) {
      this.workflowOrchestrationRecords.push(action);
      if (action.status === "SCHEDULED") {
        this.scheduledWorkflowActions.push(toScheduledExecution(action));
      }
      return action;
    },
    recordWorkflowOrchestrationActions(actions) {
      actions.forEach((action) => this.recordWorkflowOrchestrationAction(action));
      return actions;
    },
    updateWorkflowOrchestrationActionStatus(actionId, status, details) {
      const index = this.workflowOrchestrationRecords.findIndex(
        (record) => record.actionId === actionId,
      );
      if (index === -1) {
        throw new Error(`orchestration action ${actionId} not found`);
      }
      this.workflowOrchestrationRecords[index] = {
        ...this.workflowOrchestrationRecords[index],
        status,
        message: details?.message ?? this.workflowOrchestrationRecords[index].message,
        metadata: details?.metadata ?? this.workflowOrchestrationRecords[index].metadata,
      };
      return this.workflowOrchestrationRecords[index];
    },
    listPendingWorkflowOrchestrationActions(filter = {}) {
      return this.workflowOrchestrationRecords.filter((record) =>
        (filter.status ? record.status === filter.status : true) &&
        (filter.lifecycle ? record.lifecycle === filter.lifecycle : true) &&
        (filter.entityType ? record.entityType === filter.entityType : true) &&
        (filter.entityId ? record.entityId === filter.entityId : true),
      );
    },
    claimScheduledWorkflowExecutions(input) {
      return claimScheduled(this, input);
    },
    claimScheduledWorkflowExecutionById(actionId, input) {
      return claimScheduled(this, { ...input, limit: 1 }).find(
        (record) => record.actionId === actionId,
      ) ?? null;
    },
    getScheduledWorkflowExecutionById(actionId) {
      return this.scheduledWorkflowActions.find((record) => record.actionId === actionId) ?? null;
    },
    updateScheduledWorkflowExecutionStatus(actionId, update) {
      const index = this.scheduledWorkflowActions.findIndex(
        (record) => record.actionId === actionId,
      );
      if (index === -1) {
        throw new Error(`scheduled action ${actionId} not found`);
      }
      this.scheduledWorkflowActions[index] = {
        ...this.scheduledWorkflowActions[index],
        status: update.status,
        claimedByWorkerId: update.workerId ?? this.scheduledWorkflowActions[index].claimedByWorkerId,
        startedAt: update.startedAt ?? this.scheduledWorkflowActions[index].startedAt,
        completedAt: update.completedAt ?? this.scheduledWorkflowActions[index].completedAt,
        nextRetryAt: update.nextRetryAt ?? this.scheduledWorkflowActions[index].nextRetryAt,
        attemptCount: update.attemptCount ?? this.scheduledWorkflowActions[index].attemptCount,
        metadata: update.metadata ?? this.scheduledWorkflowActions[index].metadata,
        updatedAt: update.updatedAt ?? this.clock.now(),
      };
      return this.scheduledWorkflowActions[index];
    },
    recordWorkflowExecutionAttempt(attempt) {
      this.workflowExecutionAttempts.push(attempt);
      return attempt;
    },
    executeScheduledWorkflowAction() {
      if (this.failScheduledExecution) {
        throw new Error("verification injected scheduled execution failure");
      }
    },
    listWorkflowExecutionsForMonitoring() {
      return this.scheduledWorkflowActions;
    },
    recordWorkflowSlaTimer(timer) {
      this.workflowSlaTimers.push(timer);
      return timer;
    },
    recordWorkflowSlaTimers(timers) {
      this.workflowSlaTimers.push(...timers);
      return timers;
    },
    listActiveWorkflowSlaTimersDue(input = {}) {
      const current = new Date(input.now ?? this.clock.now()).getTime();
      return this.workflowSlaTimers.filter(
        (timer) =>
          timer.status === "ACTIVE" &&
          !timer.satisfiedAt &&
          new Date(timer.dueAt).getTime() <= current &&
          (input.lifecycle ? timer.lifecycle === input.lifecycle : true) &&
          (input.entityType ? timer.entityType === input.entityType : true) &&
          (input.entityId ? timer.entityId === input.entityId : true),
      );
    },
    listActiveWorkflowSlaTimersForEntity(input) {
      return this.workflowSlaTimers.filter(
        (timer) =>
          timer.status === "ACTIVE" &&
          timer.lifecycle === input.lifecycle &&
          timer.entityType === input.entityType &&
          timer.entityId === input.entityId,
      );
    },
    updateWorkflowSlaTimerStatus(timerId, update) {
      const index = this.workflowSlaTimers.findIndex((timer) => timer.timerId === timerId);
      if (index === -1) {
        throw new Error(`SLA timer ${timerId} not found`);
      }
      this.workflowSlaTimers[index] = {
        ...this.workflowSlaTimers[index],
        ...update,
        updatedAt: update.updatedAt ?? this.clock.now(),
      };
      return this.workflowSlaTimers[index];
    },
    recordWorkflowSlaBreach(breach) {
      this.workflowSlaBreaches.push(breach);
      return breach;
    },
    listWorkflowSlaTimersForMonitoring() {
      return this.workflowSlaTimers;
    },
    listWorkflowSlaBreachesForMonitoring() {
      return this.workflowSlaBreaches;
    },
    seedWorkOrder(overrides = {}) {
      const workOrder = makeWorkOrder(overrides);
      this.workOrders.set(workOrder.id, workOrder);
      return workOrder;
    },
    seedInvoice(overrides = {}) {
      const invoice = makeInvoice(overrides);
      this.invoices.set(invoice.id, invoice);
      return invoice;
    },
    setQuoteState(workOrderId, quoteStatus) {
      const workOrder = this.workOrders.get(workOrderId);
      if (!workOrder) {
        throw new Error(`work order ${workOrderId} not found`);
      }
      workOrder.quoteStatus = quoteStatus;
    },
    recordActionAvailability(result) {
      this.actionAvailabilityResults.push(result);
    },
    computeOptimization(contexts) {
      const optimizationContexts = contexts ?? buildOptimizationContexts(this);
      this.priorityScores.clear();
      for (const context of optimizationContexts) {
        this.priorityScores.set(context.entityId, computeWorkflowPriorityScore(context));
      }
      const queue = buildOptimizedWorkQueue({
        now: this.clock.now(),
        entities: optimizationContexts,
      });
      this.optimizationQueue = queue;
      this.operationalInsights = buildWorkflowOperationalInsights({
        now: this.clock.now(),
        entities: optimizationContexts,
        queue,
      });
      return queue;
    },
    snapshot() {
      return buildArtifactSnapshot(this);
    },
  };

  return env;
}

export function makeWorkOrder(
  overrides: WorkOrderFixtureOverrides = {},
): WorkOrder & { quoteRequired?: boolean; quoteStatus?: string | null } {
  return {
    id: "wo-1",
    workOrderNumber: "WO-1001",
    organizationId: "org-1",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    requestedByContactId: "contact-1",
    title: "Leaking pipe",
    description: "Pipe under sink is leaking",
    status: WORK_ORDER_STATUS.New as WorkOrder["status"],
    priority: "medium",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    quoteRequired: false,
    ...overrides,
  } as WorkOrder & { quoteRequired?: boolean; quoteStatus?: string | null };
}

export function makeInvoice(overrides: InvoiceFixtureOverrides = {}): Invoice {
  return {
    id: "invoice-1",
    organizationId: "org-1",
    workOrderId: "wo-1",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    status: INVOICE_STATUS.NotReady as Invoice["status"],
    currencyCode: "USD",
    subtotalAmountCents: 10000,
    totalAmountCents: 10000,
    dueAt: "2026-01-08T00:00:00.000Z",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    ...overrides,
  } as Invoice;
}

function buildArtifactSnapshot(
  env: WorkflowVerificationEnvironment,
): WorkflowVerificationArtifactSnapshot {
  return {
    workOrders: [...env.workOrders.values()],
    invoices: [...env.invoices.values()],
    auditCount: env.transitionAuditRecords.length,
    eventCount: env.transitionEventRecords.length,
    reactionIntentCount:
      env.sentInternalNotifications.length +
      env.sentClientNotifications.length +
      env.enqueuedAutomationIntents.length,
    notificationIntentCount:
      env.sentInternalNotifications.length + env.sentClientNotifications.length,
    automationIntentCount: env.enqueuedAutomationIntents.length,
    orchestrationActionCount: env.workflowOrchestrationRecords.length,
    scheduledActionCount: env.scheduledWorkflowActions.length,
    slaTimerCount: env.workflowSlaTimers.length,
    slaBreachCount: env.workflowSlaBreaches.length,
    transitionAudits: [...env.transitionAuditRecords],
    transitionEvents: [...env.transitionEventRecords],
    notificationIntents: [
      ...env.sentInternalNotifications,
      ...env.sentClientNotifications,
    ],
    automationIntents: [...env.enqueuedAutomationIntents],
    orchestrationActions: [...env.workflowOrchestrationRecords],
    scheduledActions: [...env.scheduledWorkflowActions],
    executionAttempts: [...env.workflowExecutionAttempts],
    slaTimers: [...env.workflowSlaTimers],
    slaBreaches: [...env.workflowSlaBreaches],
    actionAvailability: [...env.actionAvailabilityResults],
    priorityScores: Object.fromEntries(env.priorityScores),
    optimizationQueue: env.optimizationQueue,
    monitoringSummary: env.monitoringSummary,
  };
}

function toScheduledExecution(
  action: WorkflowOrchestrationAction,
): ScheduledWorkflowExecutionRecord {
  return {
    actionId: action.actionId,
    ruleKey: action.ruleKey,
    lifecycle: action.lifecycle,
    entityType: action.entityType,
    entityId: action.entityId,
    actionType: action.actionType,
    status: "PENDING",
    priority: action.priority,
    severity: action.severity,
    scheduledFor: action.scheduledFor,
    attemptCount: 0,
    maxAttempts: 3,
    assignedAudience: action.assignedAudience,
    targetQueue: action.targetQueue,
    message: action.message,
    metadata: action.metadata,
    createdAt: action.createdAt,
    updatedAt: action.createdAt,
  };
}

function claimScheduled(
  env: WorkflowVerificationEnvironment,
  input: ClaimScheduledWorkflowActionsInput,
): ScheduledWorkflowExecutionRecord[] {
  const now = input.now ?? env.clock.now();
  const current = new Date(now).getTime();
  const eligible = env.scheduledWorkflowActions
    .filter(
      (action) =>
        (action.status === "PENDING" || action.status === "RETRY_SCHEDULED") &&
        (!action.scheduledFor || new Date(action.scheduledFor).getTime() <= current) &&
        (!action.nextRetryAt || new Date(action.nextRetryAt).getTime() <= current) &&
        (input.lifecycle ? action.lifecycle === input.lifecycle : true) &&
        (input.entityType ? action.entityType === input.entityType : true) &&
        (input.actionTypes ? input.actionTypes.includes(action.actionType) : true),
    )
    .slice(0, input.limit ?? 10);

  return eligible.map((action) => {
    const updated: ScheduledWorkflowExecutionRecord = {
      ...action,
      status: "CLAIMED" as ScheduledWorkflowExecutionStatus,
      claimedByWorkerId: input.workerId,
      claimedAt: now,
      updatedAt: now,
    };
    const index = env.scheduledWorkflowActions.findIndex(
      (candidate) => candidate.actionId === action.actionId,
    );
    env.scheduledWorkflowActions[index] = updated;
    return updated;
  });
}

function buildOptimizationContexts(
  env: WorkflowVerificationEnvironment,
): WorkflowOptimizationContext[] {
  return [
    ...[...env.workOrders.values()].map((workOrder) => ({
      lifecycle: "work-order" as const,
      entityType: "work-order" as const,
      entityId: workOrder.id,
      status: workOrder.status,
      entity: workOrder,
      now: env.clock.now(),
      slaTimers: env.workflowSlaTimers.filter((timer) => timer.entityId === workOrder.id),
      orchestrationRecords: env.workflowOrchestrationRecords.filter(
        (record) => record.entityId === workOrder.id,
      ),
      executionRecords: env.scheduledWorkflowActions.filter(
        (record) => record.entityId === workOrder.id,
      ),
    })),
    ...[...env.invoices.values()].map((invoice) => ({
      lifecycle: "invoice" as const,
      entityType: "invoice" as const,
      entityId: invoice.id,
      status: invoice.status,
      entity: invoice,
      now: env.clock.now(),
      slaTimers: env.workflowSlaTimers.filter((timer) => timer.entityId === invoice.id),
      orchestrationRecords: env.workflowOrchestrationRecords.filter(
        (record) => record.entityId === invoice.id,
      ),
      executionRecords: env.scheduledWorkflowActions.filter(
        (record) => record.entityId === invoice.id,
      ),
    })),
  ];
}

export function seedStandardWorkOrder(
  env: WorkflowVerificationEnvironment,
  overrides: WorkOrderFixtureOverrides = {},
) {
  return env.seedWorkOrder({
    id: "wo-standard",
    quoteRequired: true,
    quoteStatus: null,
    ...overrides,
  });
}

export function seedStandardInvoice(
  env: WorkflowVerificationEnvironment,
  overrides: InvoiceFixtureOverrides = {},
) {
  return env.seedInvoice({
    id: "invoice-standard",
    workOrderId: "wo-standard",
    ...overrides,
  });
}

export type VerificationTransitionMetadata = TransitionUpdateMetadata;
export type VerificationExecutionAdapters = WorkflowExecutionAdapters;

export type WorkOrderFixtureOverrides = Omit<Partial<WorkOrder>, "status"> & {
  readonly status?: WorkOrder["status"] | WorkOrderLifecycleStatus | string;
  readonly quoteRequired?: boolean;
  readonly quoteStatus?: string | null;
};

export type InvoiceFixtureOverrides = Omit<Partial<Invoice>, "status"> & {
  readonly status?: Invoice["status"] | InvoiceLifecycleStatus | string;
};
