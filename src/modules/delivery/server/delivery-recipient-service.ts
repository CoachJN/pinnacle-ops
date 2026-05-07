import "server-only";

import type { DeliveryPolicyService } from "@/modules/delivery";
import {
  DELIVERY_RECIPIENT_TYPES,
  DELIVERY_TYPES,
  type DeliveryRecipientTarget,
} from "@/modules/delivery";
import type { FirestoreRepositories, WorkOrder } from "@/server/repositories";
import { USER_ROLES } from "@/types/permissions";

export interface DeliveryRecipientService {
  resolveRecipients(input: {
    organizationId: string;
    deliveryType: "escalation.first_response_breach_notification";
    workOrder: Pick<WorkOrder, "id" | "coordinatorUserId" | "managerUserId">;
  }): Promise<readonly DeliveryRecipientTarget[]>;
}

export function createDeliveryRecipientService(
  repositories: Pick<FirestoreRepositories, "userProfiles">,
  policyService: DeliveryPolicyService,
): DeliveryRecipientService {
  return {
    async resolveRecipients(input) {
      const policy = policyService.getPolicy(input.deliveryType);
      if (!policy || input.deliveryType !== DELIVERY_TYPES.EscalationFirstResponseBreachNotification) {
        return [];
      }

      const profiles = await repositories.userProfiles.listByOrganizationId(input.organizationId, {
        limit: 500,
      });
      const activeProfiles = profiles.items.filter(
        (profile) => !profile.isDeleted && profile.status === "active",
      );
      const recipients = new Map<string, DeliveryRecipientTarget>();

      const addRecipient = (
        recipientType: DeliveryRecipientTarget["recipientType"],
        profileId: string | null | undefined,
        supportedRoles: readonly string[],
      ) => {
        if (!profileId) {
          return;
        }
        const profile = activeProfiles.find(
          (candidate) => candidate.id === profileId && supportedRoles.includes(candidate.role),
        );
        if (!profile) {
          return;
        }
        recipients.set(`${recipientType}:${profile.id}`, {
          recipientType,
          recipientId: profile.id,
          recipientAddress: `internal:user:${profile.id}`,
          displayName: profile.displayName ?? profile.email,
        });
      };

      addRecipient(
        DELIVERY_RECIPIENT_TYPES.AssignedCoordinator,
        input.workOrder.coordinatorUserId ?? null,
        [USER_ROLES.Coordinator],
      );
      addRecipient(
        DELIVERY_RECIPIENT_TYPES.AssignedManager,
        input.workOrder.managerUserId ?? null,
        [USER_ROLES.Manager, USER_ROLES.Owner],
      );

      for (const profile of activeProfiles) {
        if (profile.role !== USER_ROLES.Manager && profile.role !== USER_ROLES.Owner) {
          continue;
        }
        recipients.set(`${DELIVERY_RECIPIENT_TYPES.InternalOperationsGroup}:${profile.id}`, {
          recipientType: DELIVERY_RECIPIENT_TYPES.InternalOperationsGroup,
          recipientId: profile.id,
          recipientAddress: `internal:user:${profile.id}`,
          displayName: profile.displayName ?? profile.email,
        });
      }

      return policy.recipientTypes.flatMap((recipientType) =>
        [...recipients.values()].filter((recipient) => recipient.recipientType === recipientType),
      );
    },
  };
}
