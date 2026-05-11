import { NextRequest } from "next/server";
import {
  createAllocatorHealthService,
  createAllocatorLeaseService,
  createFirestoreRuntimeAllocatorRepositories,
  createRuntimeAllocatorService,
} from "@/modules/runtime-allocator";
import {
  createFirestoreRuntimeClaimRepositories,
  createRuntimeClaimBalancerService,
  createRuntimeClaimDiagnosticsService,
  createRuntimeWorkerHeartbeatService,
  createRuntimeWorkerScalingService,
} from "@/modules/runtime-claim";
import { getRuntimeApiContext } from "@/server/api/runtime";
import { jsonOk, withApiRoute } from "@/server/api/work-orders";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "/api/runtime-claim/diagnostics", async (requestContext) => {
    await getRuntimeApiContext(requestContext);
    const now = request.nextUrl.searchParams.get("now")?.trim() || new Date().toISOString();
    const shardCount = Number.parseInt(request.nextUrl.searchParams.get("shards") ?? "4", 10);
    const totalCapacity = Number.parseInt(request.nextUrl.searchParams.get("capacity") ?? "16", 10);
    const allocatorRepositories = createFirestoreRuntimeAllocatorRepositories();
    const claimRepositories = createFirestoreRuntimeClaimRepositories();
    const leases = createAllocatorLeaseService(allocatorRepositories.leases);
    const diagnostics = createRuntimeClaimDiagnosticsService(
      createAllocatorHealthService(leases),
      createRuntimeAllocatorService(allocatorRepositories.global),
      createRuntimeClaimBalancerService(),
      createRuntimeWorkerScalingService(),
      createRuntimeWorkerHeartbeatService(claimRepositories.workers, claimRepositories.recovery),
      claimRepositories.windows,
      claimRepositories.recovery,
    );
    const data = await diagnostics.getDiagnostics({
      now,
      shardCount: Number.isFinite(shardCount) ? Math.max(1, shardCount) : 4,
      totalCapacity: Number.isFinite(totalCapacity) ? Math.max(0, totalCapacity) : 16,
    });
    return jsonOk({ data });
  });
}
