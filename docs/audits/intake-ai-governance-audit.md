# Intake & AI Governance Audit

Date: 2026-05-07

## Scope

Reviewed:

- intake bounded context
- intake events
- intake artifacts
- AI intake drafts
- review workflows
- duplicate screening
- evidence persistence
- confidence persistence
- review decisions
- conversion boundaries
- merge workflows
- escalation flows
- intake timeline integration

Primary references:

- `docs/architecture/ai-intake-foundation.md`
- `docs/architecture/intake-review-and-ingestion-edge.md`
- `src/server/services/intake-service.ts`
- `src/app/api/intake/review/[intakeEventId]/actions/route.ts`
- `src/components/intake/intake-review-page.tsx`
- `src/server/services/work-order-service.ts`
- `src/tests/intake-service.test.mts`

## Executive Summary

Overall assessment: Partially compliant, with a sound canonical intake boundary but meaningful governance gaps.

What is working well:

- AI does not directly create or mutate authoritative work orders.
- Provider ingestion is isolated to intake, communications, artifacts, and receipts.
- Human review is required before conversion, merge, rejection, or escalation.
- Evidence, confidence, duplicate candidates, approvals, decisions, and timeline events all have canonical persistence models.
- The intake event timeline is durable and tenant-scoped.

What is not yet governance-safe enough:

- Some AI-side draft mutations are not auditable as first-class governance events.
- Some duplicate-review outcomes are not persisted as canonical decisions.
- The current HTTP/UI review boundary does not actually support reviewer edits, even though the domain service does.
- Reviewer authorization is broad to all internal roles rather than a dedicated reviewer permission.
- AI provenance is only partially explicit; runtime actor typing collapses AI into `system` or `user`.
- Evidence references are persisted without strong referential validation.
- Converted work orders do not persist a strong source link back to the approving intake records.

Risk rating: Medium.

---

## 1. AI Governance Assessment

Assessment: Mixed, with strong architectural intent and moderate implementation drift.

Strengths:

- The architecture explicitly states that AI may suggest but may not directly mutate authoritative operational state (`docs/architecture/ai-intake-foundation.md:9-22`).
- The conversion boundary is implemented through intake review into `workOrders.create`, not through provider or AI-side mutation (`src/server/services/intake-service.ts:1198-1236`).
- The service blocks `system` actors from making review decisions (`src/server/services/intake-service.ts:1167-1168` and `640-670` path guard).

Governance gaps:

- AI enrichment after draft creation is not durably audited. Duplicate screening mutates `duplicateCandidates` and `workOrderMatchSuggestions` directly, then saves the draft without emitting a domain event or persisting new AI run metadata (`src/server/services/intake-service.ts:470-489`).
- The event model supports `actorType: "ai"` (`src/server/events/types.ts:15-29`), but intake actor mapping only records `system` or `user` (`src/server/services/intake-service.ts:2172-2187`). That weakens provenance for future AI workers.
- The provider receipt stores the full replay payload in metadata (`src/server/services/intake-service.ts:1918-1923`). This is operationally useful, but it increases sensitivity and size risk unless governed more tightly.

Conclusion:

The canonical rule set is correct, but the runtime still lacks fully explainable and explicitly attributed AI mutation trails for post-draft enrichment.

## 2. Intake Architecture Assessment

Assessment: Strong canonical bounded context design.

Strengths:

- Intake has distinct canonical aggregates: `intakeEvents`, `intakeArtifacts`, `aiIntakeDrafts`, `intakeApprovals`, and `intakeDecisions` (`docs/architecture/ai-intake-foundation.md:24-200`).
- Provider ingestion creates intake and communication records without work-order mutation (`docs/architecture/intake-review-and-ingestion-edge.md:85-111`; covered by `src/tests/intake-service.test.mts:168-214` and provider-safe ingestion test in the same file).
- The service layer keeps route handlers thin and centralizes intake behavior in `src/server/services/intake-service.ts`.

Gaps:

- `createAiDraftInternal` only checks that at least one `artifactId` was provided; it does not validate that each artifact exists, belongs to the same intake event, or matches the referenced evidence (`src/server/services/intake-service.ts:2087-2138`).
- `evidenceReferences` are accepted and persisted without validation (`src/server/services/intake-service.ts:2111-2112`).

Conclusion:

The bounded context is well-formed, but provenance integrity inside the context is not fully enforced yet.

## 3. Review Boundary Assessment

Assessment: Human gate exists, but the reviewer boundary is thinner than the domain model implies.

Strengths:

- Review, merge, reject, and escalate all route through the intake service and require a non-system actor (`src/server/services/intake-service.ts:1167-1168`).
- Durable `IntakeDecision` and `IntakeApproval` records exist for approve/merge paths (`src/server/services/intake-service.ts:1175-1298`).

Gaps:

- The domain service supports `approvedInput` overrides for true reviewer edits (`src/server/services/intake-service.ts:1198-1253`, `2460-2498`), but the HTTP route does not accept or forward `approvedInput` for either `submit_decision` or `resolve_duplicate` (`src/app/api/intake/review/[intakeEventId]/actions/route.ts:57-92`).
- The UI exposes a button labeled "Create new work order" that submits `approve_with_edits`, but it offers no approved-field editing surface (`src/components/intake/intake-review-page.tsx:303-317`).
- Intake review access is granted to all internal roles (`coordinator`, `manager`, `finance_admin`, `owner`) through `INTERNAL_APP_ROLES`, with no intake-specific reviewer permission or separation of duties (`src/lib/rbac/roles.ts:14-19`; `src/app/(app)/dashboard/intake/page.tsx:14-15`).

Conclusion:

There is a real human-review gate, but the actual operational boundary is closer to "approve draft as-is" than "review and explicitly approve corrected intake data."

## 4. Evidence / Confidence Assessment

Assessment: Persistence exists, but explainability is only partially enforced and surfaced.

Strengths:

- Evidence is persisted with field, excerpt, confidence, offsets, rationale, and source references in the draft model (`docs/architecture/ai-intake-foundation.md:117-145`; `src/modules/intake/domain/types.ts:117-138`).
- Overall and per-field confidence are persisted (`src/modules/intake/domain/types.ts:320-327`; `src/server/services/intake-service.ts:2109-2112`).
- Tests confirm evidence and confidence persistence on draft creation (`src/tests/intake-service.test.mts:100-149`).

Gaps:

- The service does not validate that evidence artifact/message references resolve to canonical artifacts/messages for the same intake event (`src/server/services/intake-service.ts:2087-2138`).
- The reviewer UI shows excerpt, rationale, and evidence confidence, but not offsets, source message identity, or per-field confidence (`src/components/intake/intake-review-page.tsx:350-366` and confidence summary only at `246-250`).
- Per-field confidence is persisted but not meaningfully surfaced in the review workflow.

Conclusion:

Evidence and confidence persistence are present, but reviewer explainability is incomplete and provenance validation is too soft.

## 5. Duplicate Screening Assessment

Assessment: Safe from autonomous merge, but not fully durable as a governance workflow.

Strengths:

- Duplicate screening is non-authoritative and does not autonomously merge (`docs/architecture/ai-intake-foundation.md:147-165`).
- Merge into existing work order requires a human decision and persists approval/decision records (`src/server/services/intake-service.ts:1264-1287`, `1296-1453`).

Critical gap:

- `false_positive` duplicate handling does not create an `IntakeDecision` or `IntakeApproval`; it only mutates the draft and emits a domain event (`src/server/services/intake-service.ts:641-670`). This conflicts with the architectural rule that every review action writes an `IntakeDecision` (`docs/architecture/ai-intake-foundation.md:182-187`).

Additional gaps:

- The draft is updated for false positives without `lastReviewedAt`, `reviewerUserId`, `reviewerDecision`, or `latestDecisionId` being advanced in the same way as full review decisions (`src/server/services/intake-service.ts:641-670` vs. `1301-1335`).
- Duplicate screening updates from AI are silent from an audit perspective (`src/server/services/intake-service.ts:470-489`).

Conclusion:

Duplicate handling is operationally cautious but not yet fully decision-durable.

## 6. Conversion Safety Assessment

Assessment: Strong boundary, incomplete provenance linkage after conversion.

Strengths:

- Conversion happens only from the intake review service after building an approved DTO (`src/server/services/intake-service.ts:1198-1236`).
- `IntakeDecision`, `IntakeApproval`, `intake_conversion_requested`, and `intake_conversion_completed` are all recorded (`src/server/services/intake-service.ts:1204-1218`, `1243-1261`, `1337-1453`).
- Tests confirm conversion routes through the canonical work-order boundary (`src/tests/intake-service.test.mts:168-214`).

Gaps:

- The created work order stores `intakeReceivedAt`, but no explicit `intakeEventId`, `aiIntakeDraftId`, or `approvalId` on the work-order record itself (`src/server/services/work-order-service.ts:298-322`).
- Provenance therefore depends on timeline events and the intake side records rather than a direct canonical back-reference on the converted work order.

Conclusion:

The mutation boundary is safe, but post-conversion provenance is event-based rather than strongly linked in the authoritative entity.

## 7. Escalation / Governance Assessment

Assessment: Escalation exists but is light on operational control.

Strengths:

- Escalation decisions create `IntakeDecision`, update draft/event state, and emit `intake_review_escalated` (`src/server/services/intake-service.ts:1291-1453`).
- Reviewer attribution and optional target user are persisted on full escalation (`src/server/services/intake-service.ts:1181-1189`, `1307-1315`, `1420-1424`).

Gaps:

- The duplicate workflow `escalate` path hard-codes `escalatedToUserId: null`, so duplicate-triggered escalation loses reviewer-selected target attribution (`src/server/services/intake-service.ts:704-710`).
- There is no visible dedicated escalation policy, queue ownership rule, or SLA governance for intake review itself in the intake boundary.
- All internal roles can execute intake review actions; there is no tighter reviewer or approver control plane (`src/lib/rbac/roles.ts:14-19`; `src/app/(app)/dashboard/intake/page.tsx:14-15`).

Conclusion:

Escalation is durable, but governance control over who may escalate and where it must land is still broad and loosely enforced.

## 8. Auditability Assessment

Assessment: Good event coverage, but important blind spots remain.

Strengths:

- Intake creation, artifact creation, review start, assignment, decision, escalation, duplicate review, merge, and conversion all emit domain events (`src/server/services/intake-service.ts` across `381-444`, `526-571`, `1204-1453`, `1778-1810`, `2152-2165`).
- Timeline reads are tenant-scoped and visibility-filtered (`src/server/services/domain-event-service.ts:297-312`).
- Review context includes approvals, decisions, drafts, artifacts, and timeline (`src/server/services/intake-service.ts:781-808`).

Gaps:

- Duplicate screening AI updates are not evented (`src/server/services/intake-service.ts:470-489`).
- False-positive duplicate resolution is not persisted as a canonical decision (`src/server/services/intake-service.ts:641-670`).
- `getReviewContext` loads artifacts in ascending order but treats `artifacts.items[0]` as the latest artifact, so the rendered linked communication can point at the oldest artifact instead of the newest one (`src/server/repositories/firestore/repositories.ts:2261-2268`; `src/server/services/intake-service.ts:795-797`).

Conclusion:

The audit trail is substantial, but not yet complete or consistently canonical for every reviewer-visible decision.

## 9. Remaining AI Governance Risks

1. Silent AI mutation risk. Post-draft screening updates can change duplicate candidates without a new governance event or run attribution.
2. Non-durable duplicate review risk. False-positive resolutions are not first-class decisions.
3. Reviewer edit illusion. The service supports approved edits, but the route/UI do not operationalize them.
4. Provenance ambiguity. Event types support `ai`, but intake actor mapping does not.
5. Weak evidence integrity. Evidence and artifact references are not strongly validated at write time.
6. Broad reviewer authority. Any internal role can review and convert intake.
7. Work-order back-reference gap. Converted work orders do not store canonical intake source IDs.
8. Sensitive replay payload retention risk. Full provider replay payloads are stored in receipt metadata.
9. Visibility gap risk. Review detail may show the wrong linked communication when multiple artifacts exist.

## 10. Recommended Corrective Actions

Priority 0:

- Make every duplicate-review action write an `IntakeDecision`, including `false_positive`.
- Emit a canonical domain event for AI duplicate-screening and enrichment updates, with run metadata and actor attribution.
- Add explicit AI actor/provenance support to intake writes instead of collapsing to `system` or `user`.

Priority 1:

- Extend `POST /api/intake/review/[intakeEventId]/actions` to accept `approvedInput` for `submit_decision` and `resolve_duplicate`.
- Add a reviewer editing surface for title, description, priority, client, location, requester, and category before approval.
- Add referential validation for `artifactIds`, `evidence.artifactId`, `evidence.communicationMessageId`, and `evidenceReferences`.

Priority 2:

- Add intake-specific reviewer/approver authorization rules rather than allowing all internal roles.
- Persist canonical back-references from converted work orders to `intakeEventId`, `aiIntakeDraftId`, and `intakeApprovalId`.
- Correct review-context linked communication selection so it uses the intended canonical/latest artifact.

Priority 3:

- Reduce provider receipt replay-payload storage scope or move large/sensitive payload snapshots to governed artifact/blob storage.
- Surface per-field confidence, evidence offsets, and source message identity in reviewer tooling.
- Add tests for:
  - false-positive duplicate resolution creating a decision record
  - approved-input HTTP path support
  - evidence/artifact referential validation failures
  - AI enrichment event emission
  - multi-artifact review context selecting the correct linked communication

## Final Verdict

The platform is much closer to AI-safe intake governance than the earlier readiness audit baseline. The canonical boundary is now present and materially safer than direct work-order creation from AI or providers.

However, it is not yet fully explainable or governance-complete. The largest issues are not catastrophic direct-mutation failures; they are decision durability, provenance completeness, and reviewer-operability gaps that would matter during incident review, compliance review, or contested duplicate/conversion outcomes.
