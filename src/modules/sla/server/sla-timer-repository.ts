import "server-only";

import type { SlaTimer, SlaTimerStatus, SlaTimerType } from "@/modules/sla";
import type {
  FirestoreRepositories,
  RepositoryListResult,
} from "@/server/repositories";
import type { EntityId } from "@/types/entity";

export interface SlaTimerRepository {
  newId(): EntityId;
  getById(id: EntityId): Promise<SlaTimer | null>;
  create(timer: SlaTimer): Promise<void>;
  save(timer: SlaTimer): Promise<void>;
  findByIdempotencyKey(input: {
    organizationId: EntityId;
    type: SlaTimerType;
    idempotencyKey: string;
  }): Promise<SlaTimer | null>;
  listByOrganizationId(
    organizationId: EntityId,
    options?: {
      limit?: number;
      statuses?: readonly SlaTimerStatus[];
      type?: SlaTimerType;
    },
  ): Promise<RepositoryListResult<SlaTimer>>;
  scanScheduledDueTimers(input: {
    organizationId: EntityId;
    dueBefore: string;
    limit: number;
    type?: SlaTimerType;
    after?: {
      dueAt: string;
      id: EntityId;
    } | null;
  }): Promise<RepositoryListResult<SlaTimer>>;
}

export function createSlaTimerRepository(
  repositories: Pick<FirestoreRepositories, "slaTimers">,
): SlaTimerRepository {
  return {
    newId() {
      return repositories.slaTimers.newId();
    },
    async getById(id) {
      return repositories.slaTimers.getById(id);
    },
    async create(timer) {
      await repositories.slaTimers.create(timer);
    },
    async save(timer) {
      await repositories.slaTimers.save(timer);
    },
    async findByIdempotencyKey(input) {
      return repositories.slaTimers.findByIdempotencyKey(input);
    },
    async listByOrganizationId(organizationId, options) {
      return repositories.slaTimers.listByOrganizationId(organizationId, options);
    },
    async scanScheduledDueTimers(input) {
      return repositories.slaTimers.scanScheduledDueTimers(input);
    },
  };
}
