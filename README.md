# PinnOps

PinnOps is a Next.js and Firebase work order management platform with:

- canonical work-order lifecycle and authorization
- client and contractor portals
- quote and invoice workflows
- provider intake and review
- durable domain events, runtime jobs, dead letters, and repair tooling

## Local development

1. Copy `.env.example` into your local environment.
2. Populate Firebase browser and Admin SDK values.
3. Run:

```bash
npm install
npm run dev
```

Primary scripts:

- `npm run typecheck`
- `npm test`
- `npm run seed:qa`
- `npm run verify:workflow`

## Deployment and operations

Production rollout and runtime verification are documented in:

- `docs/operations/production-setup-checklist.md`
- `docs/operations/manual-smoke-tests.md`
- `docs/operations/runtime-recovery-runbook.md`
- `docs/operations/production-readiness-status.md`

Canonical architecture references:

- `docs/work-order-lifecycle.md`
- `docs/architecture/atomic-event-and-audit-persistence.md`
- `docs/architecture/external-boundary-lockdown.md`
- `docs/architecture/runtime-command-center.md`
- `docs/architecture/provider-runtime-operations.md`

## Current operational posture

This repository is in a manual-first runtime phase for production operations:

- canonical mutations route through domain services only
- runtime repair and replay are explicit operator actions
- provider ingress is normalized into canonical intake and communication artifacts
- broad autonomous orchestration is intentionally deferred

## Work order detail canonical tabs

- `Communications` is the canonical communication workspace for work orders. It consolidates internal notes, client/contractor-visible communication records, assignment notes, and communication-relevant timeline events.
- `Files` is the canonical workspace for attachment records and file handling. Attachments are not treated as standalone communications.
- `History / Audit` is the canonical workspace for lifecycle, assignment, finance, and broader audit/system history.
