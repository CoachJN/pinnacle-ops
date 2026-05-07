import "server-only";

import type { SlaScanCursor, SlaScanType } from "@/modules/sla";
import type {
  FirestoreRepositories,
  RepositoryListResult,
} from "@/server/repositories";
import type { EntityId } from "@/types/entity";

export interface SlaScanCursorRepository {
  newId(): EntityId;
  getById(id: EntityId): Promise<SlaScanCursor | null>;
  create(cursor: SlaScanCursor): Promise<void>;
  save(cursor: SlaScanCursor): Promise<void>;
  findByScanType(input: {
    organizationId: EntityId;
    scanType: SlaScanType;
    timerType?: string | null;
  }): Promise<SlaScanCursor | null>;
  listByOrganizationId(
    organizationId: EntityId,
    options?: {
      limit?: number;
      scanType?: SlaScanType;
    },
  ): Promise<RepositoryListResult<SlaScanCursor>>;
}

export function createSlaScanCursorRepository(
  repositories: Pick<FirestoreRepositories, "slaScanCursors">,
): SlaScanCursorRepository {
  return {
    newId() {
      return repositories.slaScanCursors.newId();
    },
    async getById(id) {
      return repositories.slaScanCursors.getById(id);
    },
    async create(cursor) {
      await repositories.slaScanCursors.create(cursor);
    },
    async save(cursor) {
      await repositories.slaScanCursors.save(cursor);
    },
    async findByScanType(input) {
      return repositories.slaScanCursors.findByScanType(input);
    },
    async listByOrganizationId(organizationId, options) {
      return repositories.slaScanCursors.listByOrganizationId(organizationId, options);
    },
  };
}
