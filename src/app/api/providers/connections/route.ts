import { NextRequest } from "next/server";
import { getProviderRuntimeApiContext } from "@/server/api/provider-runtime";
import { jsonOk, withApiRoute } from "@/server/api/work-orders";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "/api/providers/connections", async (requestContext) => {
    const context = await getProviderRuntimeApiContext(requestContext);
    const result = await context.services.providers.query.listConnections(
      context.actor.scope.organizationId,
    );
    if (!result.ok) {
      throw result.error;
    }

    return jsonOk({
      data: {
        connections: result.value,
      },
    });
  });
}

export async function POST(request: NextRequest) {
  return withApiRoute(request, "/api/providers/connections", async (requestContext) => {
    const context = await getProviderRuntimeApiContext(requestContext);
    const body = await request.json() as {
      providerKey: "microsoft_graph";
      mailboxAddress: string;
      displayName?: string | null;
      providerTenantId?: string | null;
      providerAccountId?: string | null;
      scopes?: string[];
      scopeMetadata?: Record<string, unknown>;
      expiresAt?: string | null;
      metadata?: Record<string, unknown>;
    };

    const result = await context.services.providers.connections.create({
      organizationId: context.actor.scope.organizationId,
      actor: context.audit.actor,
      providerKey: body.providerKey,
      mailboxAddress: body.mailboxAddress,
      displayName: body.displayName,
      providerTenantId: body.providerTenantId,
      providerAccountId: body.providerAccountId,
      scopes: body.scopes,
      scopeMetadata: body.scopeMetadata,
      expiresAt: body.expiresAt,
      metadata: body.metadata,
    });
    if (!result.ok) {
      throw result.error;
    }

    return jsonOk({
      data: {
        connection: result.value,
      },
    }, 201);
  });
}
