import { NextRequest } from "next/server";
import {
  getWorkOrderApiContext,
  jsonOk,
  withApiRoute,
} from "@/server/api/work-orders";
import type { WorkOrderStatus } from "@/types/work-order";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "/api/intake/review", async (requestContext) => {
    const context = await getWorkOrderApiContext(requestContext);
    const result = await context.services.intake.query.listReviewQueue(
      context.actor.scope.organizationId,
      context.actor,
      {
        reviewStatus: readString(request, "status") as
          | "pending_review"
          | "under_review"
          | "escalated"
          | undefined,
        sourceType: readString(request, "sourceType") as
          | "communication_message"
          | "portal_submission"
          | "email"
          | "sms"
          | "voicemail"
          | "ocr"
          | "attachment"
          | "transcript"
          | undefined,
        assignedReviewerUserId: readString(request, "assignedReviewerUserId") ?? undefined,
        urgency: readString(request, "urgency") ?? undefined,
        lifecycleRecommendation: (readString(request, "lifecycleRecommendation") ?? undefined) as
          | WorkOrderStatus
          | undefined,
        sortBy: (readString(request, "sortBy") as
          | "generatedAt"
          | "overallConfidence"
          | "duplicateRisk"
          | undefined) ?? "generatedAt",
        minimumConfidence: readNumber(request, "minimumConfidence"),
        maximumConfidence: readNumber(request, "maximumConfidence"),
      },
    );
    if (!result.ok) {
      throw result.error;
    }

    return jsonOk({
      data: {
        queue: result.value,
      },
    });
  });
}

function readString(request: NextRequest, key: string) {
  return request.nextUrl.searchParams.get(key)?.trim() || null;
}

function readNumber(request: NextRequest, key: string) {
  const raw = readString(request, key);
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}
