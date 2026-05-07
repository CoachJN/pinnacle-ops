import { NextRequest } from "next/server";
import {
  getWorkOrderApiContext,
  jsonOk,
  withApiRoute,
} from "@/server/api/work-orders";

interface RouteContext {
  params: Promise<{ intakeEventId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/intake/review/[intakeEventId]",
    async (requestContext) => {
      const context = await getWorkOrderApiContext(requestContext);
      const { intakeEventId } = await params;
      const reviewContext = await context.services.intake.query.getReviewContext(
        intakeEventId,
        context.actor,
      );
      if (!reviewContext.ok) {
        throw reviewContext.error;
      }

      const latestDraftId = reviewContext.value.drafts[0]?.id ?? null;
      const [evidenceResult, duplicatesResult] = latestDraftId
        ? await Promise.all([
            context.services.intake.query.getEvidence(latestDraftId, context.actor),
            context.services.intake.query.getDuplicateCandidates(latestDraftId, context.actor),
          ])
        : [
            { ok: true as const, value: [] },
            { ok: true as const, value: [] },
          ];
      if (!evidenceResult.ok) {
        throw evidenceResult.error;
      }
      if (!duplicatesResult.ok) {
        throw duplicatesResult.error;
      }

      return jsonOk({
        data: {
          reviewContext: reviewContext.value,
          evidence: evidenceResult.value,
          duplicates: duplicatesResult.value,
          latestDraftId,
        },
      });
    },
  );
}
