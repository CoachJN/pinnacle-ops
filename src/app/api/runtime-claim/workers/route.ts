import { NextRequest } from "next/server";
import {
  createFirestoreRuntimeClaimRepositories,
  createRuntimeWorkerHeartbeatService,
} from "@/modules/runtime-claim";
import { getRuntimeApiContext } from "@/server/api/runtime";
import { jsonOk, withApiRoute } from "@/server/api/work-orders";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "/api/runtime-claim/workers", async (requestContext) => {
    await getRuntimeApiContext(requestContext);
    const repositories = createFirestoreRuntimeClaimRepositories();
    const heartbeat = createRuntimeWorkerHeartbeatService(repositories.workers, repositories.recovery);
    const data = await heartbeat.listWorkers();
    return jsonOk({ data });
  });
}
