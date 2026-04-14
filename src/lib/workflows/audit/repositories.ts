import type {
  TransitionAuditRecord,
  TransitionEventRecord,
} from "./types.ts";

type Awaitable<T> = T | Promise<T>;

export interface TransitionAuditRepository {
  readonly recordTransitionAudit?: (
    record: TransitionAuditRecord,
  ) => Awaitable<void>;
  readonly recordTransitionEvent?: (
    event: TransitionEventRecord,
  ) => Awaitable<void>;
}
