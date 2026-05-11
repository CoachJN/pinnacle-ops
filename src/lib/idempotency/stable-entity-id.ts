import { createHash } from "node:crypto";

import type { EntityId } from "@/types/entity";

export function buildStableEntityId(namespace: string, parts: readonly (string | null | undefined)[]): EntityId {
  const normalizedNamespace = normalizePart(namespace, "namespace");
  const normalizedParts = parts.map((part, index) => normalizePart(part, `part-${index}`));
  const digest = createHash("sha256")
    .update([normalizedNamespace, ...normalizedParts].join("|"))
    .digest("hex")
    .slice(0, 24);
  return `${normalizedNamespace}-${digest}`;
}

function normalizePart(value: string | null | undefined, fallback: string): string {
  const normalized = value?.trim().replace(/[^a-zA-Z0-9:_-]+/g, "-") ?? "";
  return normalized.length > 0 ? normalized : fallback;
}
