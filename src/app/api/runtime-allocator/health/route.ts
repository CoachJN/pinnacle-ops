import { NextRequest } from "next/server";
import {
  createAllocatorHealthService,
  createAllocatorLeaseService,
  createFirestoreRuntimeAllocatorRepositories,
} from "@/modules/runtime-allocator";
import { getRuntimeApiContext } from "@/server/api/runtime";
import { jsonOk, withApiRoute } from "@/server/api/work-orders";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "/api/runtime-allocator/health", async (requestContext) => {
    await getRuntimeApiContext(requestContext);
    const now = request.nextUrl.searchParams.get("now")?.trim() || new Date().toISOString();
    const shardCount = Number.parseInt(request.nextUrl.searchParams.get("shards") ?? "4", 10);
    const repositories = createFirestoreRuntimeAllocatorRepositories();
    const health = createAllocatorHealthService(createAllocatorLeaseService(repositories.leases));
    const data = await health.getHealth({
      now,
      shardCount: Number.isFinite(shardCount) ? Math.max(1, shardCount) : 4,
    });
    return jsonOk({ data });
  });
}
