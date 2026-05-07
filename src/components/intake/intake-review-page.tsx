"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface IntakeReviewPageProps {
  actorRoleLabel: string;
  queue: Array<{
    intakeEventId: string;
    aiIntakeDraftId: string;
    sourceType: string;
    reviewStatus: string;
    assignedReviewerUserId: string | null;
    escalationState: string;
    duplicateRisk: string;
    summary: string;
    overallConfidence: number;
    duplicateCandidateCount: number;
    urgency: string | null;
    lifecycleRecommendation: string | null;
    generatedAt: string;
    createdAt: string;
    latestDecisionAt: string | null;
    relatedWorkOrderId: string | null;
  }>;
  selectedIntakeEventId: string | null;
  reviewers: Array<{ id: string; label: string; roleLabel: string }>;
  detail: {
    reviewContext: {
      event: {
        id: string;
        status: string;
        source: { sourceType: string; externalSourceId: string | null };
        summary: string | null;
        relatedWorkOrderId: string | null;
        receivedAt: string;
      };
      drafts: Array<{
        id: string;
        reviewStatus: string;
        overallConfidence: number;
        extractedTitle: string | null;
        extractedDescription: string | null;
        extractedUrgency: string | null;
        extractedSuggestedLifecycle: string | null;
        assignedReviewerUserId: string | null;
        reviewerNotes: string | null;
      }>;
      timeline: Array<{
        id: string;
        type: string;
        summary: string;
        occurredAt: string;
      }>;
      linkedCommunication: {
        message: { body: string; plainTextBody: string; subject: string | null } | null;
        attachments: Array<{ id: string; fileName: string; contentType: string | null }>;
      } | null;
    };
    evidence: Array<{
      evidence: { id: string; field: string; confidence: number; excerpt: string; rationale: string | null };
      artifact: { id: string; kind: string; normalizedContent: string } | null;
      attachments: Array<{ id: string; fileName: string; contentType: string | null }>;
    }>;
    duplicates: Array<{
      candidate: { id: string; candidateWorkOrderId: string; candidateWorkOrderNumber: string | null; confidence: number; rationale: string | null; status: string };
      workOrder: { id: string; workOrderNumber: string; title: string; lifecycleStatus: string; priority: string; clientSnapshot: { name: string } | null; locationSnapshot: { name: string } | null } | null;
      timeline: Array<{ id: string; occurredAt: string; summary: string }>;
      communications: Array<{ id: string; createdAt: string; body: string }>;
      attachments: Array<{ id: string; fileName: string }>;
    }>;
    latestDraftId: string | null;
  } | null;
}

export function IntakeReviewPage({
  actorRoleLabel,
  queue,
  selectedIntakeEventId,
  reviewers,
  detail,
}: IntakeReviewPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reviewerUserId, setReviewerUserId] = useState(
    detail?.reviewContext.drafts[0]?.assignedReviewerUserId ?? "",
  );
  const [notes, setNotes] = useState("");
  const [mergeTarget, setMergeTarget] = useState(
    detail?.duplicates[0]?.workOrder?.id ?? "",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function submitAction(payload: Record<string, unknown>) {
    if (!selectedIntakeEventId) {
      return;
    }

    setMessage(null);
    const response = await fetch(`/api/intake/review/${selectedIntakeEventId}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => null)) as
      | { data?: { message?: string } }
      | { error?: { message?: string } }
      | null;

    if (!response.ok) {
      setMessage(
        body && "error" in body
          ? body.error?.message ?? "Unable to complete the intake action."
          : "Unable to complete the intake action.",
      );
      return;
    }

    setMessage(
      body && "data" in body
        ? body.data?.message ?? "Intake review updated."
        : "Intake review updated.",
    );
    startTransition(() => router.refresh());
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Operational intake
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
          Intake review queue
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">
          Human review remains authoritative. Providers only land normalized communications,
          intake artifacts, and evidence for internal review.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-neutral-500">
          <span className="rounded-full border border-neutral-200 px-3 py-1">Role {actorRoleLabel}</span>
          <span className="rounded-full border border-neutral-200 px-3 py-1">{queue.length} queued items</span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(24rem,0.9fr)_minmax(0,1.4fr)]">
        <section className="space-y-4">
          <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {["pending_review", "under_review", "escalated"].map((status) => (
                <Link
                  key={status}
                  className="rounded-full border border-neutral-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-600 hover:border-neutral-400 hover:text-neutral-950"
                  href={`/dashboard/intake?status=${status}`}
                >
                  {status.replaceAll("_", " ")}
                </Link>
              ))}
              <Link
                className="rounded-full border border-neutral-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-600 hover:border-neutral-400 hover:text-neutral-950"
                href="/dashboard/intake"
              >
                Reset
              </Link>
            </div>
          </div>

          <div className="space-y-3">
            {queue.map((item) => {
              const isActive = item.intakeEventId === selectedIntakeEventId;
              return (
                <Link
                  key={item.aiIntakeDraftId}
                  href={`/dashboard/intake?intakeEventId=${item.intakeEventId}`}
                  className={
                    isActive
                      ? "block rounded-3xl border border-neutral-950 bg-neutral-950 p-4 text-white shadow-sm"
                      : "block rounded-3xl border border-neutral-200 bg-white p-4 text-neutral-950 shadow-sm transition hover:border-neutral-300"
                  }
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">
                        {item.sourceType.replaceAll("_", " ")}
                      </p>
                      <h2 className="mt-2 text-base font-semibold">{item.summary}</h2>
                    </div>
                    <span className="rounded-full border border-current/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
                      {percent(item.overallConfidence)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs opacity-80">
                    <span>{item.reviewStatus.replaceAll("_", " ")}</span>
                    <span>Duplicate risk {item.duplicateRisk}</span>
                    <span>{item.duplicateCandidateCount} candidates</span>
                    {item.urgency ? <span>Urgency {item.urgency}</span> : null}
                  </div>
                </Link>
              );
            })}

            {queue.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-sm text-neutral-600">
                No intake items match the current filters.
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-4">
          {!detail ? (
            <div className="rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-sm text-neutral-600">
              Select an intake item to inspect evidence, duplicate candidates, communication
              linkage, and timeline history.
            </div>
          ) : (
            <>
              <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                      Intake detail
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-neutral-950">
                      {detail.reviewContext.drafts[0]?.extractedTitle ??
                        detail.reviewContext.event.summary ??
                        "Untitled intake"}
                    </h2>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">
                      {detail.reviewContext.drafts[0]?.extractedDescription ??
                        detail.reviewContext.linkedCommunication?.message?.plainTextBody ??
                        "No extracted description yet."}
                    </p>
                  </div>
                  {detail.reviewContext.event.relatedWorkOrderId ? (
                    <Link
                      className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500"
                      href={`/dashboard/work-orders/${detail.reviewContext.event.relatedWorkOrderId}`}
                    >
                      Open linked work order
                    </Link>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Review status" value={detail.reviewContext.drafts[0]?.reviewStatus ?? detail.reviewContext.event.status} />
                  <Metric label="Confidence" value={percent(detail.reviewContext.drafts[0]?.overallConfidence ?? 0)} />
                  <Metric label="Urgency" value={detail.reviewContext.drafts[0]?.extractedUrgency ?? "Not extracted"} />
                  <Metric label="Lifecycle suggestion" value={detail.reviewContext.drafts[0]?.extractedSuggestedLifecycle ?? "Not suggested"} />
                </div>
              </div>

              <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-neutral-950">Reviewer actions</h3>
                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)]">
                  <textarea
                    className="min-h-28 rounded-2xl border border-neutral-300 px-4 py-3 text-sm text-neutral-900 outline-none focus:border-neutral-500"
                    placeholder="Add reviewer notes, escalation context, or merge reasoning."
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                  <div className="space-y-3">
                    <select
                      className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm text-neutral-900"
                      value={reviewerUserId}
                      onChange={(event) => setReviewerUserId(event.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {reviewers.map((reviewer) => (
                        <option key={reviewer.id} value={reviewer.id}>
                          {reviewer.label} · {reviewer.roleLabel}
                        </option>
                      ))}
                    </select>
                    <button
                      className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-700 hover:border-neutral-500 disabled:opacity-50"
                      disabled={isPending || !detail.latestDraftId}
                      onClick={() =>
                        submitAction({
                          action: "assign_review",
                          aiIntakeDraftId: detail.latestDraftId,
                          assignedReviewerUserId: reviewerUserId || null,
                        })
                      }
                    >
                      Save assignment
                    </button>
                    <button
                      className="w-full rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                      disabled={isPending || !detail.latestDraftId}
                      onClick={() =>
                        submitAction({
                          action: "start_review",
                          aiIntakeDraftId: detail.latestDraftId,
                        })
                      }
                    >
                      Start review
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    disabled={isPending || !detail.latestDraftId}
                    onClick={() =>
                      submitAction({
                        action: "submit_decision",
                        aiIntakeDraftId: detail.latestDraftId,
                        decision: "approve_with_edits",
                        reviewerNotes: notes || null,
                      })
                    }
                  >
                    Create new work order
                  </button>
                  <button
                    className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-700 hover:border-neutral-500 disabled:opacity-50"
                    disabled={isPending || !detail.latestDraftId}
                    onClick={() =>
                      submitAction({
                        action: "submit_decision",
                        aiIntakeDraftId: detail.latestDraftId,
                        decision: "reject",
                        reviewerNotes: notes || null,
                      })
                    }
                  >
                    Reject intake
                  </button>
                  <button
                    className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 disabled:opacity-50"
                    disabled={isPending || !detail.latestDraftId}
                    onClick={() =>
                      submitAction({
                        action: "escalate_review",
                        aiIntakeDraftId: detail.latestDraftId,
                        reviewerNotes: notes || null,
                        escalatedToUserId: reviewerUserId || null,
                      })
                    }
                  >
                    Escalate review
                  </button>
                </div>
                {message ? <p className="mt-4 text-sm text-neutral-600">{message}</p> : null}
              </div>

              <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-neutral-950">Evidence</h3>
                <div className="mt-4 space-y-3">
                  {detail.evidence.map((item) => (
                    <article className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4" key={item.evidence.id}>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                        <span>{item.evidence.field.replaceAll("_", " ")}</span>
                        <span>{percent(item.evidence.confidence)}</span>
                        {item.artifact ? <span>{item.artifact.kind.replaceAll("_", " ")}</span> : null}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-neutral-800">{item.evidence.excerpt}</p>
                      {item.evidence.rationale ? (
                        <p className="mt-2 text-sm text-neutral-600">{item.evidence.rationale}</p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-neutral-950">Duplicate comparison</h3>
                <div className="mt-4 space-y-4">
                  {detail.duplicates.map((item) => (
                    <article className="rounded-2xl border border-neutral-200 p-4" key={item.candidate.id}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                            Candidate {item.candidate.candidateWorkOrderNumber ?? item.candidate.candidateWorkOrderId}
                          </p>
                          <h4 className="mt-2 text-base font-semibold text-neutral-950">
                            {item.workOrder?.title ?? "Existing work order unavailable"}
                          </h4>
                          <p className="mt-2 text-sm text-neutral-600">
                            {item.candidate.rationale ?? "No duplicate rationale provided."}
                          </p>
                        </div>
                        <span className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-600">
                          {percent(item.candidate.confidence)}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <Metric label="Lifecycle" value={item.workOrder?.lifecycleStatus ?? "Unknown"} />
                        <Metric label="Priority" value={item.workOrder?.priority ?? "Unknown"} />
                        <Metric label="Client" value={item.workOrder?.clientSnapshot?.name ?? "Unknown"} />
                        <Metric label="Location" value={item.workOrder?.locationSnapshot?.name ?? "Unknown"} />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <input
                          className="min-w-[14rem] rounded-2xl border border-neutral-300 px-4 py-3 text-sm text-neutral-900"
                          placeholder="Merge target work order id"
                          value={mergeTarget}
                          onChange={(event) => setMergeTarget(event.target.value)}
                        />
                        <button
                          className="rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                          disabled={isPending || !detail.latestDraftId || !mergeTarget}
                          onClick={() =>
                            submitAction({
                              action: "resolve_duplicate",
                              aiIntakeDraftId: detail.latestDraftId,
                              workflow: "merge_into_existing",
                              candidateIds: [item.candidate.id],
                              mergedIntoWorkOrderId: mergeTarget,
                              reviewerNotes: notes || null,
                            })
                          }
                        >
                          Merge into existing
                        </button>
                        <button
                          className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-700 hover:border-neutral-500 disabled:opacity-50"
                          disabled={isPending || !detail.latestDraftId}
                          onClick={() =>
                            submitAction({
                              action: "resolve_duplicate",
                              aiIntakeDraftId: detail.latestDraftId,
                              workflow: "false_positive",
                              candidateIds: [item.candidate.id],
                              reviewerNotes: notes || null,
                            })
                          }
                        >
                          Mark false positive
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-neutral-950">Timeline</h3>
                <div className="mt-4 space-y-3">
                  {detail.reviewContext.timeline.map((entry) => (
                    <article className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4" key={entry.id}>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                        {entry.type.replaceAll("_", " ")}
                      </p>
                      <p className="mt-2 text-sm text-neutral-800">{entry.summary}</p>
                      <p className="mt-2 text-xs text-neutral-500">{formatDateTime(entry.occurredAt)}</p>
                    </article>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-neutral-950">{value}</p>
    </div>
  );
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
