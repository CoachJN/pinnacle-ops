import "server-only";

import type { DeliveryPlan } from "@/modules/delivery";
import type { FirestoreRepositories } from "@/server/repositories";
import type { EntityId } from "@/types/entity";

export interface DeliveryPlanRepository {
  newId(): EntityId;
  getById(id: EntityId): Promise<DeliveryPlan | null>;
  create(plan: DeliveryPlan): Promise<void>;
  save(plan: DeliveryPlan): Promise<void>;
  findByIdempotencyKey(input: {
    organizationId: EntityId;
    deliveryType: DeliveryPlan["deliveryType"];
    idempotencyKey: string;
  }): Promise<DeliveryPlan | null>;
  findActiveForRecipient(input: {
    organizationId: EntityId;
    deliveryType: DeliveryPlan["deliveryType"];
    sourceEscalationId: EntityId;
    sourceEscalationStageNumber: number | null;
    recipientId: EntityId;
    channel: DeliveryPlan["channel"];
  }): Promise<DeliveryPlan | null>;
  listByOrganizationId(
    organizationId: EntityId,
    options?: {
      limit?: number;
      statuses?: readonly DeliveryPlan["status"][];
      channel?: DeliveryPlan["channel"];
      deliveryType?: DeliveryPlan["deliveryType"];
    },
  ): Promise<readonly DeliveryPlan[]>;
  listByEscalation(input: {
    organizationId: EntityId;
    sourceEscalationId: EntityId;
    limit?: number;
  }): Promise<readonly DeliveryPlan[]>;
}

export function createDeliveryPlanRepository(
  repositories: Pick<FirestoreRepositories, "deliveryPlans">,
): DeliveryPlanRepository {
  return {
    newId() {
      return repositories.deliveryPlans.newId();
    },
    async getById(id) {
      return repositories.deliveryPlans.getById(id);
    },
    async create(plan) {
      await repositories.deliveryPlans.create(plan);
    },
    async save(plan) {
      await repositories.deliveryPlans.save(plan);
    },
    async findByIdempotencyKey(input) {
      return repositories.deliveryPlans.findByIdempotencyKey(input);
    },
    async findActiveForRecipient(input) {
      return repositories.deliveryPlans.findActiveForRecipient(input);
    },
    async listByOrganizationId(organizationId, options) {
      const result = await repositories.deliveryPlans.listByOrganizationId(organizationId, options);
      return result.items;
    },
    async listByEscalation(input) {
      const result = await repositories.deliveryPlans.listByEscalation(input);
      return result.items;
    },
  };
}
