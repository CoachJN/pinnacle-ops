import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type {
  ClientQuote,
  ContractorQuote,
  Invoice,
} from "@/types/financial";
import type { WorkOrder } from "@/types/work-order";
import type { WorkflowActionAvailabilityResult } from "../action-gating/index.ts";
import type {
  ScheduledWorkflowExecutionRecord,
  WorkflowSlaTimer,
} from "../execution/index.ts";
import type { WorkflowOrchestrationRecord } from "../orchestration/index.ts";
import type { PlatformRole } from "../rbac-transition/index.ts";
import type { TransitionLifecycle } from "../transition-engine/index.ts";

export type OptimizationEntityType = "work-order" | "invoice" | "quote";

export type OptimizationPriorityTier = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type OptimizationSignalSeverity =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type OptimizationRuntimePosture = "active" | "limited" | "deferred";

export type OptimizationQuoteEntity = ContractorQuote | ClientQuote | {
  readonly id: EntityId;
  readonly status?: string | null;
  readonly createdAt?: IsoDateTimeString;
  readonly updatedAt?: IsoDateTimeString;
  readonly expiresAt?: IsoDateTimeString;
  readonly workOrderId?: EntityId;
};

export type OptimizationEntity = WorkOrder | Invoice | OptimizationQuoteEntity;

export interface OptimizationEntityReference {
  readonly lifecycle: TransitionLifecycle;
  readonly entityType: OptimizationEntityType;
  readonly entityId: EntityId;
  readonly status?: string | null;
}

export interface WorkflowOptimizationContext extends OptimizationEntityReference {
  readonly entity?: OptimizationEntity | null;
  readonly statusEnteredAt?: IsoDateTimeString | null;
  readonly now?: IsoDateTimeString;
  readonly slaTimers?: readonly WorkflowSlaTimer[];
  readonly orchestrationRecords?: readonly WorkflowOrchestrationRecord[];
  readonly executionRecords?: readonly ScheduledWorkflowExecutionRecord[];
  readonly actionAvailability?: WorkflowActionAvailabilityResult | null;
  readonly quoteRuntimePosture?: OptimizationRuntimePosture;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface OptimizationSignal {
  readonly code: string;
  readonly label: string;
  readonly weight: number;
  readonly severity: OptimizationSignalSeverity;
  readonly message: string;
  readonly source: "sla" | "status" | "age" | "invoice" | "execution" | "orchestration" | "quote" | "assignment";
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface WorkflowPriorityScore {
  readonly score: number;
  readonly tier: OptimizationPriorityTier;
  readonly contributingFactors: readonly OptimizationSignal[];
  readonly reasons: readonly string[];
}

export interface WorkflowRiskSignal {
  readonly type:
    | "SLA_BREACHED"
    | "SLA_NEARING_DUE"
    | "MULTIPLE_RETRIES_FAILED"
    | "LONG_TIME_IN_STATUS"
    | "INVOICE_OVERDUE"
    | "QUOTE_OR_APPROVAL_STALLED"
    | "QUOTE_RUNTIME_DEFERRED";
  readonly severity: OptimizationSignalSeverity;
  readonly message: string;
  readonly relatedEntity: OptimizationEntityReference;
  readonly contributingSignals: readonly OptimizationSignal[];
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface OptimizationAgent {
  readonly agentId: EntityId;
  readonly displayName?: string;
  readonly roles: readonly PlatformRole[];
  readonly activeWorkCount?: number;
  readonly lastAssignedAt?: IsoDateTimeString | null;
}

export interface AssignmentRecommendation {
  readonly recommendedRole: PlatformRole;
  readonly recommendedAgentId?: EntityId;
  readonly reason: string;
  readonly contributingSignals: readonly OptimizationSignal[];
}

export interface NextWorkflowActionRecommendation {
  readonly actionCode: string;
  readonly message: string;
  readonly priority: OptimizationPriorityTier;
  readonly reason: string;
  readonly contributingSignals: readonly OptimizationSignal[];
  readonly runtimePosture?: OptimizationRuntimePosture;
}

export interface OptimizedWorkQueueItem extends OptimizationEntityReference {
  readonly entity?: OptimizationEntity | null;
  readonly priority: WorkflowPriorityScore;
  readonly riskSignals: readonly WorkflowRiskSignal[];
  readonly assignmentRecommendation: AssignmentRecommendation;
  readonly nextActions: readonly NextWorkflowActionRecommendation[];
  readonly rankingReasons: readonly string[];
  readonly quoteRuntimePosture?: OptimizationRuntimePosture;
}

export interface BuildOptimizedWorkQueueInput {
  readonly entities: readonly WorkflowOptimizationContext[];
  readonly availableAgents?: readonly OptimizationAgent[];
  readonly now?: IsoDateTimeString;
}

export interface OptimizedWorkQueue {
  readonly items: readonly OptimizedWorkQueueItem[];
  readonly groupedByPriority: Readonly<Record<OptimizationPriorityTier, readonly OptimizedWorkQueueItem[]>>;
  readonly generatedAt: IsoDateTimeString;
}

export interface BuildWorkflowOperationalInsightsInput extends BuildOptimizedWorkQueueInput {
  readonly queue?: OptimizedWorkQueue;
}

export interface WorkflowOperationalInsights {
  readonly generatedAt: IsoDateTimeString;
  readonly totalActiveWork: number;
  readonly breachedSlaCount: number;
  readonly overdueInvoiceCount: number;
  readonly highRiskWorkCount: number;
  readonly workloadByRole: Readonly<Partial<Record<PlatformRole, number>>>;
  readonly distributionByPriority: Readonly<Record<OptimizationPriorityTier, number>>;
  readonly quoteRuntimePosture: {
    readonly deferredCount: number;
    readonly limitedInsightCount: number;
    readonly message: string;
  };
  readonly contributingSignals: readonly OptimizationSignal[];
  readonly queue?: OptimizedWorkQueue;
}
