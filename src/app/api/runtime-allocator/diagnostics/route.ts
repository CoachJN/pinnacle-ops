import { NextRequest } from "next/server";
import {
  createAllocatorHealthService,
  createAllocatorLeaseService,
  createAllocatorTelemetryService,
  createFirestoreRuntimeAllocatorRepositories,
  createRuntimeAllocationDiagnosticsService,
  createRuntimeAllocatorService,
  createRuntimeShardService,
} from "@/modules/runtime-allocator";
import { getRuntimeApiContext } from "@/server/api/runtime";
import { jsonOk, withApiRoute } from "@/server/api/work-orders";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "/api/runtime-allocator/diagnostics", async (requestContext) => {
    await getRuntimeApiContext(requestContext);
    const now = request.nextUrl.searchParams.get("now")?.trim() || new Date().toISOString();
    const shardCount = Number.parseInt(request.nextUrl.searchParams.get("shards") ?? "4", 10);
    const totalCapacity = Number.parseInt(request.nextUrl.searchParams.get("capacity") ?? "16", 10);
    const repositories = createFirestoreRuntimeAllocatorRepositories();
    const allocator = createRuntimeAllocatorService(repositories.global);
    const leases = createAllocatorLeaseService(repositories.leases);
    const shards = createRuntimeShardService();
    const diagnostics = createRuntimeAllocationDiagnosticsService(
      createAllocatorHealthService(leases),
      allocator,
      createAllocatorTelemetryService(allocator, leases, repositories.allocations),
      leases,
      repositories.allocations,
      shards,
    );
    const data = await diagnostics.getDiagnostics({
      now,
      shardCount: Number.isFinite(shardCount) ? Math.max(1, shardCount) : 4,
      totalCapacity: Number.isFinite(totalCapacity) ? Math.max(0, totalCapacity) : 16,
    });
    return jsonOk({ data });
  });
}
