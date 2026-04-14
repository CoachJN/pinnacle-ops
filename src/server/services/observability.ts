import "server-only";

import { createAppLogger, type AppLogger } from "../../lib/logging/logger.ts";
import type { EntityId } from "@/types/entity";
import type { UserRole } from "@/types/permissions";

export interface ServiceLoggingContext {
  requestId?: string;
  actor: {
    userId: EntityId;
    role: UserRole | "system";
  };
}

export function createServiceLogger(
  useCase: string,
  context: ServiceLoggingContext,
): AppLogger {
  return createAppLogger({
    layer: "service",
    useCase,
    requestId: context.requestId,
    actor: {
      type: context.actor.role === "system" ? "system" : "user",
      userId: context.actor.role === "system" ? null : context.actor.userId,
      role: context.actor.role,
    },
  });
}
