# Runtime Command Center

## Purpose

Phase 20 introduces the canonical operational command center for distributed runtime visibility.

This command center answers:

- what the runtime is doing right now
- whether the orchestration substrate is healthy
- where retries, dead letters, backlog, and reconciliation failures exist
- which runtime records require explicit operator intervention

This phase does not introduce:

- AI-generated operational mutations
- autonomous remediation
- self-healing loops
- hidden repair on read

## Canonical model

The command center is built from canonical persisted runtime state only:

- `runtimeJobs`
- `runtimeDeadLetters`
- `runtimeEventProcessings`
- `slaTimers`
- `escalationOrchestrations`
- `deliveryPlans`
- `deliveryAttempts`
- `providerReceipts`

The operations bounded context adds three durable operational records:

- `operationsRuntimeProjections`
  - one persisted projection snapshot per tenant
  - stores queue, replay, provider, lag, stuck-runtime, and intervention summaries
- `operationsRuntimeAlerts`
  - durable deduplicated alerts keyed by tenant and alert condition
  - alerts are activated and resolved explicitly from projection refreshes
- `operationsRuntimeRepairActions`
  - durable operator repair history
  - every repair request is auditable, replay-safe, and tenant-scoped

These records are operational projections and audit artifacts only. They do not become authoritative workflow state.

## Health aggregation

Runtime health is classified deterministically as:

- `healthy`
- `degraded`
- `critical`

The classifier evaluates persisted signals including:

- dead-letter volume
- stuck runtime jobs with expired leases
- overdue queued jobs
- overdue SLA timers
- replay backlog
- provider reconciliation failures
- retry storms
- queue starvation lag

Health is computed during projection refresh and never inferred from UI-only state.

## Alerts

Durable alerts are generated from persisted projections and deduplicated by stable alert keys:

- `excessive_dead_letters`
- `stuck_runtime_jobs`
- `overdue_sla_evaluations`
- `replay_backlog_growth`
- `provider_reconciliation_failures`
- `repeated_transport_failures`
- `queue_starvation`
- `excessive_retry_churn`

Alert behavior:

- tenant-scoped only
- replay-safe because deduplication is stable
- resolved explicitly when the condition is absent on a later projection refresh
- correlation lineage is preserved on the alert record

## Repair model

Repair remains explicit and bounded. No repair runs automatically.

Supported repair actions:

- dead-letter replay
- stuck runtime requeue
- durable event replay retry
- provider reconciliation retry
- delivery retry reset

Safety guarantees:

- repairs operate through canonical runtime/domain services only
- repairs never mutate work orders directly
- repair actions are idempotent through stable action idempotency keys
- every repair attempt is persisted in `operationsRuntimeRepairActions`
- dead-letter replay and retry reset only enqueue canonical runtime work

## Diagnostics and APIs

Admin-only command center APIs:

- `GET /api/operations/runtime/summary`
- `GET /api/operations/runtime/health`
- `GET /api/operations/runtime/alerts`
- `GET /api/operations/runtime/dead-letter`
- `GET /api/operations/runtime/replay`
- `POST /api/operations/runtime/repair`

Behavioral rules:

- all APIs require internal operational runtime authorization
- read APIs are diagnostics only
- repair API is the only canonical mutation surface for operator runtime intervention in this phase
- no command-center mutation is triggered automatically by page load

## Removed fragmentation

Before this phase, runtime visibility was split across domain-specific diagnostics surfaces.

The canonical command-center path is now `operations/runtime/*`.

Existing lower-level runtime, SLA, transport, delivery, and provider operator services remain internal building blocks for bounded command-center actions and should not be treated as the primary operational control plane.

## Known limitations

- projections refresh on explicit reads; there is not yet a scheduled projection worker
- trend calculations compare against the previous persisted snapshot only
- repair history is durable, but richer operator annotations and case management do not exist yet
- provider health is currently derived from persisted receipt/webhook summaries, not from active provider heartbeat checks

## Phase 21 recommendation

Build a scheduled projection refresh and operator case-management layer on top of this substrate:

- background projection refresh jobs using the existing worker substrate
- richer alert acknowledgement/snooze semantics
- replay batch selection and operator replay queues
- tenant-safe dashboards backed only by the persisted projection records

Do not add autonomous remediation until those operator controls and replay guardrails are stable.
