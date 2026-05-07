import "server-only";

import type { EscalationOrchestration } from "@/modules/escalation";
import type { FirestoreRepositories } from "@/server/repositories";
import type { EntityId } from "@/types/entity";

export interface EscalationOrchestrationRepository {
  newId(): EntityId;
  getById(id: EntityId): Promise<EscalationOrchestration | null>;
  create(orchestration: EscalationOrchestration): Promise<void>;
  save(orchestration: EscalationOrchestration): Promise<void>;
  findByIdempotencyKey(input: {
    organizationId: EntityId;
    escalationType: EscalationOrchestration["escalationType"];
    idempotencyKey: string;
  }): Promise<EscalationOrchestration | null>;
  findLatestByTimer(input: {
    organizationId: EntityId;
    escalationType: EscalationOrchestration["escalationType"];
    sourceSlaTimerId: EntityId;
  }): Promise<EscalationOrchestration | null>;
  findOpenByCondition(input: {
    organizationId: EntityId;
    escalationType: EscalationOrchestration["escalationType"];
    targetEntityType: EscalationOrchestration["targetEntityType"];
    targetEntityId: EntityId;
  }): Promise<EscalationOrchestration | null>;
  listByOrganizationId(
    organizationId: EntityId,
    options?: {
      limit?: number;
      statuses?: readonly EscalationOrchestration["status"][];
      escalationType?: EscalationOrchestration["escalationType"];
    },
  ): Promise<readonly EscalationOrchestration[]>;
}

export function createEscalationOrchestrationRepository(
  repositories: Pick<FirestoreRepositories, "escalationOrchestrations">,
): EscalationOrchestrationRepository {
  return {
    newId() {
      return repositories.escalationOrchestrations.newId();
    },
    async getById(id) {
      return repositories.escalationOrchestrations.getById(id);
    },
    async create(orchestration) {
      await repositories.escalationOrchestrations.create(orchestration);
    },
    async save(orchestration) {
      await repositories.escalationOrchestrations.save(orchestration);
    },
    async findByIdempotencyKey(input) {
      return repositories.escalationOrchestrations.findByIdempotencyKey(input);
    },
    async findLatestByTimer(input) {
      return repositories.escalationOrchestrations.findLatestByTimer(input);
    },
    async findOpenByCondition(input) {
      return repositories.escalationOrchestrations.findOpenByCondition(input);
    },
    async listByOrganizationId(organizationId, options) {
      const result = await repositories.escalationOrchestrations.listByOrganizationId(
        organizationId,
        options,
      );
      return result.items;
    },
  };
}
