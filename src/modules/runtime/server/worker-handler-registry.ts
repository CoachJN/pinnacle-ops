import "server-only";

import type {
  RegisteredWorkerHandler,
  WorkerHandlerDefinition,
} from "@/modules/runtime";

export interface WorkerHandlerRegistry<TServices = unknown> {
  get(type: string): WorkerHandlerDefinition<TServices> | null;
  list(): readonly RegisteredWorkerHandler[];
}

export function createWorkerHandlerRegistry<TServices = unknown>(
  definitions: readonly WorkerHandlerDefinition<TServices>[] = [],
): WorkerHandlerRegistry<TServices> {
  const byType = new Map<string, WorkerHandlerDefinition<TServices>>();

  for (const definition of definitions) {
    byType.set(definition.type, definition);
  }

  return {
    get(type) {
      return byType.get(type) ?? null;
    },
    list() {
      return [...byType.values()]
        .map((definition) => ({
          type: definition.type,
          description: definition.description,
        }))
        .sort((left, right) => left.type.localeCompare(right.type));
    },
  };
}
