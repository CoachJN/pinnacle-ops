import { NextRequest } from "next/server";
import {
  getWorkOrderApiContext,
  jsonOk,
  parseJsonObject,
  withApiRoute,
} from "@/server/api/work-orders";
import { validationError } from "@/server/services/errors";

interface RouteContext {
  params: Promise<{ intakeEventId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/intake/review/[intakeEventId]/actions",
    async (requestContext) => {
      const context = await getWorkOrderApiContext(requestContext);
      const payload = await parseJsonObject(request);
      const { intakeEventId } = await params;
      const reviewContext = await context.services.intake.query.getReviewContext(
        intakeEventId,
        context.actor,
      );
      if (!reviewContext.ok) {
        throw reviewContext.error;
      }

      const aiIntakeDraftId =
        requiredString(payload.aiIntakeDraftId ?? reviewContext.value.drafts[0]?.id, "aiIntakeDraftId");
      const action = requiredString(payload.action, "action");

      if (action === "start_review") {
        const result = await context.services.intake.review.start({
          ...context.audit,
          aiIntakeDraftId,
        });
        if (!result.ok) {
          throw result.error;
        }
        return jsonOk({ data: { draft: result.value, message: "Review started." } });
      }

      if (action === "assign_review") {
        const result = await context.services.intake.review.assign({
          ...context.audit,
          aiIntakeDraftId,
          assignedReviewerUserId: optionalString(payload.assignedReviewerUserId),
        });
        if (!result.ok) {
          throw result.error;
        }
        return jsonOk({ data: { draft: result.value, message: "Review assignment updated." } });
      }

      if (action === "submit_decision") {
        const result = await context.services.intake.review.review({
          ...context.audit,
          aiIntakeDraftId,
          decision: requiredString(payload.decision, "decision") as
            | "approve"
            | "approve_with_edits"
            | "reject"
            | "merge_into_existing"
            | "escalate",
          reviewerNotes: optionalString(payload.reviewerNotes),
          mergedIntoWorkOrderId: optionalString(payload.mergedIntoWorkOrderId),
          rejectedReason: optionalString(payload.rejectedReason),
          escalatedToUserId: optionalString(payload.escalatedToUserId),
        });
        if (!result.ok) {
          throw result.error;
        }
        return jsonOk({ data: { result: result.value, message: "Review decision recorded." } });
      }

      if (action === "resolve_duplicate") {
        const result = await context.services.intake.review.resolveDuplicate({
          ...context.audit,
          aiIntakeDraftId,
          action: requiredString(payload.workflow, "workflow") as
            | "merge_into_existing"
            | "false_positive"
            | "escalate"
            | "create_new",
          candidateIds: Array.isArray(payload.candidateIds)
            ? payload.candidateIds.map((value) => requiredString(value, "candidateIds"))
            : [],
          mergedIntoWorkOrderId: optionalString(payload.mergedIntoWorkOrderId),
          reviewerNotes: optionalString(payload.reviewerNotes),
        });
        if (!result.ok) {
          throw result.error;
        }
        return jsonOk({ data: { result: result.value, message: "Duplicate workflow updated." } });
      }

      if (action === "escalate_review") {
        const result = await context.services.intake.review.escalate({
          ...context.audit,
          aiIntakeDraftId,
          reviewerNotes: optionalString(payload.reviewerNotes),
          escalatedToUserId: optionalString(payload.escalatedToUserId),
        });
        if (!result.ok) {
          throw result.error;
        }
        return jsonOk({ data: { result: result.value, message: "Review escalated." } });
      }

      throw validationError("Unsupported intake review action.");
    },
  );
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw validationError(`${field} is required.`);
  }
  return value.trim();
}

function optionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
