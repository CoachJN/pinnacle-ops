import "server-only";

import type { DeliveryAttempt } from "@/modules/transport";
import type { FirestoreRepositories } from "@/server/repositories";
import type { EntityId } from "@/types/entity";

export interface TransportAttemptRepository {
  newId(): EntityId;
  getById(id: EntityId): Promise<DeliveryAttempt | null>;
  create(attempt: DeliveryAttempt): Promise<void>;
  save(attempt: DeliveryAttempt): Promise<void>;
  findByIdempotencyKey(input: {
    organizationId: EntityId;
    deliveryPlanId: EntityId;
    idempotencyKey: string;
  }): Promise<DeliveryAttempt | null>;
  listByDeliveryPlanId(input: {
    organizationId: EntityId;
    deliveryPlanId: EntityId;
    limit?: number;
  }): Promise<readonly DeliveryAttempt[]>;
  listByOrganizationId(
    organizationId: EntityId,
    options?: {
      limit?: number;
      statuses?: readonly DeliveryAttempt["status"][];
      channel?: DeliveryAttempt["channel"];
      adapterType?: DeliveryAttempt["adapterType"];
    },
  ): Promise<readonly DeliveryAttempt[]>;
}

export function createTransportAttemptRepository(
  repositories: Pick<FirestoreRepositories, "deliveryAttempts">,
): TransportAttemptRepository {
  return {
    newId() {
      return repositories.deliveryAttempts.newId();
    },
    async getById(id) {
      return repositories.deliveryAttempts.getById(id);
    },
    async create(attempt) {
      await repositories.deliveryAttempts.create(attempt);
    },
    async save(attempt) {
      await repositories.deliveryAttempts.save(attempt);
    },
    async findByIdempotencyKey(input) {
      return repositories.deliveryAttempts.findByIdempotencyKey(input);
    },
    async listByDeliveryPlanId(input) {
      const result = await repositories.deliveryAttempts.listByDeliveryPlanId(input);
      return result.items;
    },
    async listByOrganizationId(organizationId, options) {
      const result = await repositories.deliveryAttempts.listByOrganizationId(organizationId, options);
      return result.items;
    },
  };
}
