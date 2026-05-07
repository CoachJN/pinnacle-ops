import { requireUserWithRole } from "@/lib/auth/guards";
import { APP_ROLE_LABELS, INTERNAL_APP_ROLES } from "@/lib/rbac/roles";
import { IntakeReviewPage } from "@/components/intake/intake-review-page";
import { getWorkOrderApiContext } from "@/server/api/work-orders";
import type { WorkOrderStatus } from "@/types/work-order";

interface IntakeDashboardPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function IntakeDashboardPage({
  searchParams,
}: IntakeDashboardPageProps) {
  await requireUserWithRole(INTERNAL_APP_ROLES);
  const context = await getWorkOrderApiContext();
  if (context.actor.actorType !== "internal") {
    throw new Error("Intake review requires an internal actor.");
  }

  const params = await searchParams;
  const queueResult = await context.services.intake.query.listReviewQueue(
    context.actor.scope.organizationId,
    context.actor,
    {
      reviewStatus: takeString(params?.status) as
        | "pending_review"
        | "under_review"
        | "escalated"
        | undefined,
      sourceType: takeString(params?.sourceType) as
        | "communication_message"
        | "portal_submission"
        | "email"
        | "sms"
        | "voicemail"
        | "ocr"
        | "attachment"
        | "transcript"
        | undefined,
      assignedReviewerUserId: takeString(params?.assignedReviewerUserId) ?? undefined,
      urgency: takeString(params?.urgency) ?? undefined,
      lifecycleRecommendation: (takeString(params?.lifecycleRecommendation) ?? undefined) as
        | WorkOrderStatus
        | undefined,
      sortBy: (takeString(params?.sortBy) as
        | "generatedAt"
        | "overallConfidence"
        | "duplicateRisk"
        | undefined) ?? "generatedAt",
      minimumConfidence: takeNumber(params?.minimumConfidence),
      maximumConfidence: takeNumber(params?.maximumConfidence),
    },
  );
  if (!queueResult.ok) {
    throw queueResult.error;
  }

  const selectedIntakeEventId =
    takeString(params?.intakeEventId) ?? queueResult.value[0]?.intakeEventId ?? null;
  const detail =
    selectedIntakeEventId == null
      ? null
      : await loadSelectedDetail(context, selectedIntakeEventId);

  const reviewersResult = await context.repositories.userProfiles.listByOrganizationId(
    context.actor.scope.organizationId,
    { limit: 100 },
  );
  const reviewers = reviewersResult.items
    .filter((profile): profile is typeof profile & { role: (typeof INTERNAL_APP_ROLES)[number] } =>
      INTERNAL_APP_ROLES.includes(profile.role as (typeof INTERNAL_APP_ROLES)[number]),
    )
    .map((profile) => ({
      id: profile.id,
      label: profile.displayName ?? profile.email,
      roleLabel: APP_ROLE_LABELS[profile.role],
    }));

  return (
    <IntakeReviewPage
      actorRoleLabel={APP_ROLE_LABELS[context.actor.role]}
      queue={queueResult.value}
      selectedIntakeEventId={selectedIntakeEventId}
      reviewers={reviewers}
      detail={detail}
    />
  );
}

async function loadSelectedDetail(
  context: Awaited<ReturnType<typeof getWorkOrderApiContext>>,
  intakeEventId: string,
) {
  const reviewContext = await context.services.intake.query.getReviewContext(
    intakeEventId,
    context.actor,
  );
  if (!reviewContext.ok) {
    throw reviewContext.error;
  }

  const latestDraft = reviewContext.value.drafts[0] ?? null;
  if (!latestDraft) {
    return {
      reviewContext: reviewContext.value,
      evidence: [],
      duplicates: [],
      latestDraftId: null,
    };
  }

  const [evidenceResult, duplicatesResult] = await Promise.all([
    context.services.intake.query.getEvidence(latestDraft.id, context.actor),
    context.services.intake.query.getDuplicateCandidates(latestDraft.id, context.actor),
  ]);
  if (!evidenceResult.ok) {
    throw evidenceResult.error;
  }
  if (!duplicatesResult.ok) {
    throw duplicatesResult.error;
  }

  return {
    reviewContext: reviewContext.value,
    evidence: evidenceResult.value,
    duplicates: duplicatesResult.value,
    latestDraftId: latestDraft.id,
  };
}

function takeString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function takeNumber(value: string | string[] | undefined) {
  const parsed = Number(takeString(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}
