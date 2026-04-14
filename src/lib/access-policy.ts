import type {
  AccessActor,
  ClientAccessActor,
  ContractorAccessActor,
  InternalAccessActor,
} from "@/types/auth";
import type { EntityId } from "@/types/entity";
import type {
  ClientQuote,
  ContractorQuote,
  ClientQuoteOwnershipReference,
  ContractorQuoteOwnershipReference,
  Invoice,
  InvoiceOwnershipReference,
} from "@/types/financial";
import {
  INVOICE_CONTROL_ACTIONS,
  QUOTE_CONTROL_ACTIONS,
  roleCanControlClientQuote,
  roleCanControlContractorQuote,
  roleCanControlInvoice,
} from "@/types/financial-controls";
import type {
  ClientOrganization,
  ContractorOrganization,
  Location,
} from "@/types/organization";
import type {
  Assignment,
  AssignmentOwnershipReference,
  WorkOrder,
  WorkOrderOwnershipReference,
} from "@/types/work-order";
import {
  AUTHORITY_CATEGORIES,
  PERMISSION_ENTITIES,
  type AuthorityCategory,
  type PermissionEntity,
  roleCanAccessEntity,
} from "@/types/permissions";
import {
  canEditStatusControlledEntityDetails,
  canTransitionEntityStatus,
} from "@/lib/status-transitions";

export type TenantScopedTarget = {
  organizationId: EntityId;
};

export type ClientOwnedTarget = TenantScopedTarget & {
  clientOrganizationId: EntityId;
  locationId: EntityId;
};

export type WorkOrderAccessTarget = TenantScopedTarget &
  WorkOrderOwnershipReference &
  Pick<WorkOrder, "id"> &
  Partial<Pick<WorkOrder, "status">>;

export type AssignmentAccessTarget = TenantScopedTarget &
  AssignmentOwnershipReference &
  Partial<Pick<Assignment, "status">>;

export type ContractorQuoteAccessTarget = TenantScopedTarget &
  ContractorQuoteOwnershipReference &
  Partial<Pick<ContractorQuote, "status">>;

export type ClientQuoteAccessTarget = TenantScopedTarget &
  ClientQuoteOwnershipReference &
  Partial<Pick<ClientQuote, "status">>;

export type ClientQuoteTransformTarget = ClientQuoteAccessTarget &
  Required<Pick<ClientQuote, "contractorQuoteId">>;

export type InvoiceAccessTarget = TenantScopedTarget &
  InvoiceOwnershipReference &
  Pick<Invoice, "contractorOrganizationId"> &
  Partial<Pick<Invoice, "status">>;

export type ClientOrganizationAccessTarget = TenantScopedTarget &
  Pick<ClientOrganization, "id">;

export type LocationAccessTarget = TenantScopedTarget &
  Pick<Location, "id" | "clientOrganizationId">;

export type ContractorOrganizationAccessTarget = TenantScopedTarget &
  Pick<ContractorOrganization, "id">;

export type InternalOnlyTarget = TenantScopedTarget;

export type PaymentStatusAccessTarget = TenantScopedTarget &
  InvoiceOwnershipReference;

export type BillingDataAccessTarget = TenantScopedTarget;

export interface AssignmentRelationshipContext {
  assignments?: Array<
    TenantScopedTarget &
      Pick<Assignment, "workOrderId" | "contractorOrganizationId">
  >;
}

export const workOrderPolicy = {
  canCreate(
    actor: AccessActor,
    target: WorkOrderOwnershipReference & TenantScopedTarget,
  ): boolean {
    if (
      isInternalActorWithEntityPermissionForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.WorkOrders,
        AUTHORITY_CATEGORIES.Create,
      )
    ) {
      return true;
    }

    return isClientActorForLocation(
      actor,
      target,
      PERMISSION_ENTITIES.WorkOrders,
      AUTHORITY_CATEGORIES.Create,
    );
  },

  canRead(
    actor: AccessActor,
    target: WorkOrderAccessTarget,
    context: AssignmentRelationshipContext = {},
  ): boolean {
    if (
      isInternalActorWithAuthorityForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.WorkOrders,
        AUTHORITY_CATEGORIES.View,
      )
    ) {
      return true;
    }

    if (
      isClientActorForLocation(
        actor,
        target,
        PERMISSION_ENTITIES.WorkOrders,
        AUTHORITY_CATEGORIES.View,
      )
    ) {
      return true;
    }

    return isContractorAssignedToWorkOrderId(
      actor,
      target.organizationId,
      target.id,
      context,
      PERMISSION_ENTITIES.WorkOrders,
      AUTHORITY_CATEGORIES.View,
    );
  },

  canEdit(actor: AccessActor, target: WorkOrderAccessTarget): boolean {
    return isInternalActorWithAuthorityForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.WorkOrders,
      AUTHORITY_CATEGORIES.Edit,
    );
  },

  canUpdate(actor: AccessActor, target: WorkOrderAccessTarget): boolean {
    return this.canEdit(actor, target);
  },

  canApprove(actor: AccessActor, target: WorkOrderAccessTarget): boolean {
    return isInternalActorWithAuthorityForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.WorkOrders,
      AUTHORITY_CATEGORIES.Approve,
    );
  },

  canTransition(actor: AccessActor, target: WorkOrderAccessTarget): boolean {
    return isInternalActorWithAuthorityForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.WorkOrders,
      AUTHORITY_CATEGORIES.Transition,
    );
  },

  canTransitionTo(
    actor: AccessActor,
    target: WorkOrderAccessTarget & Pick<WorkOrder, "status">,
    nextStatus: WorkOrder["status"],
  ): boolean {
    return (
      this.canTransition(actor, target) &&
      canTransitionEntityStatus(
        "work_order",
        target.status,
        nextStatus,
        actor.role,
      )
    );
  },
};

export const assignmentPolicy = {
  canCreate(actor: AccessActor, target: AssignmentAccessTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.Assignments,
      AUTHORITY_CATEGORIES.Create,
    );
  },

  canRead(actor: AccessActor, target: AssignmentAccessTarget): boolean {
    if (
      isInternalActorWithAuthorityForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.Assignments,
        AUTHORITY_CATEGORIES.View,
      )
    ) {
      return true;
    }

    return isContractorActorForOrganization(
      actor,
      target,
      PERMISSION_ENTITIES.Assignments,
      AUTHORITY_CATEGORIES.View,
    );
  },

  canEdit(actor: AccessActor, target: AssignmentAccessTarget): boolean {
    if (
      isInternalActorWithAuthorityForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.Assignments,
        AUTHORITY_CATEGORIES.Edit,
      )
    ) {
      return true;
    }

    return isContractorActorForOrganization(
      actor,
      target,
      PERMISSION_ENTITIES.Assignments,
      AUTHORITY_CATEGORIES.Edit,
    );
  },

  canUpdate(actor: AccessActor, target: AssignmentAccessTarget): boolean {
    return this.canEdit(actor, target);
  },

  canApprove(actor: AccessActor, target: AssignmentAccessTarget): boolean {
    return isInternalActorWithAuthorityForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.Assignments,
      AUTHORITY_CATEGORIES.Approve,
    );
  },

  canTransition(actor: AccessActor, target: AssignmentAccessTarget): boolean {
    if (
      isInternalActorWithAuthorityForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.Assignments,
        AUTHORITY_CATEGORIES.Transition,
      )
    ) {
      return true;
    }

    return isContractorActorForOrganization(
      actor,
      target,
      PERMISSION_ENTITIES.Assignments,
      AUTHORITY_CATEGORIES.Transition,
    );
  },

  canTransitionTo(
    actor: AccessActor,
    target: AssignmentAccessTarget & Pick<Assignment, "status">,
    nextStatus: Assignment["status"],
  ): boolean {
    return (
      this.canTransition(actor, target) &&
      canTransitionEntityStatus(
        "assignment",
        target.status,
        nextStatus,
        actor.role,
      )
    );
  },
};

export const contractorQuotePolicy = {
  canCreate(
    actor: AccessActor,
    target: ContractorQuoteAccessTarget,
    context: AssignmentRelationshipContext = {},
  ): boolean {
    if (
      isInternalActorWithEntityPermissionForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.ContractorQuotes,
        AUTHORITY_CATEGORIES.Create,
      )
    ) {
      return true;
    }

    return isContractorAssignedToWorkOrder(
      actor,
      target,
      context,
      PERMISSION_ENTITIES.ContractorQuotes,
      AUTHORITY_CATEGORIES.Create,
    );
  },

  canRead(
    actor: AccessActor,
    target: ContractorQuoteAccessTarget,
    context: AssignmentRelationshipContext = {},
  ): boolean {
    if (
      isInternalActorWithAuthorityForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.ContractorQuotes,
        AUTHORITY_CATEGORIES.View,
      )
    ) {
      return true;
    }

    return isContractorAssignedToWorkOrder(
      actor,
      target,
      context,
      PERMISSION_ENTITIES.ContractorQuotes,
      AUTHORITY_CATEGORIES.View,
    );
  },

  canEdit(
    actor: AccessActor,
    target: ContractorQuoteAccessTarget,
    context: AssignmentRelationshipContext = {},
  ): boolean {
    if (
      isInternalActorWithAuthorityForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.ContractorQuotes,
        AUTHORITY_CATEGORIES.Edit,
      ) &&
      canEditTargetDetails("contractor_quote", target, actor.role)
    ) {
      return true;
    }

    return (
      canEditTargetDetails("contractor_quote", target, actor.role) &&
      isContractorAssignedToWorkOrder(
        actor,
        {
          organizationId: target.organizationId,
          workOrderId: target.workOrderId,
          contractorOrganizationId: target.contractorOrganizationId,
        },
        context,
        PERMISSION_ENTITIES.ContractorQuotes,
        AUTHORITY_CATEGORIES.Edit,
      )
    );
  },

  canUpdate(
    actor: AccessActor,
    target: ContractorQuoteAccessTarget,
    context: AssignmentRelationshipContext = {},
  ): boolean {
    return this.canEdit(actor, target, context);
  },

  canApprove(actor: AccessActor, target: ContractorQuoteAccessTarget): boolean {
    return (
      actorHasTenantScopedRole(actor, target.organizationId) &&
      roleCanControlContractorQuote(actor.role, QUOTE_CONTROL_ACTIONS.Approve)
    );
  },

  canSubmit(
    actor: AccessActor,
    target: ContractorQuoteAccessTarget,
    context: AssignmentRelationshipContext = {},
  ): boolean {
    return (
      this.canTransition(actor, target, context) &&
      roleCanControlContractorQuote(actor.role, QUOTE_CONTROL_ACTIONS.Submit)
    );
  },

  canReject(actor: AccessActor, target: ContractorQuoteAccessTarget): boolean {
    return (
      actorHasTenantScopedRole(actor, target.organizationId) &&
      roleCanControlContractorQuote(actor.role, QUOTE_CONTROL_ACTIONS.Reject)
    );
  },

  canRevise(
    actor: AccessActor,
    target: ContractorQuoteAccessTarget,
    context: AssignmentRelationshipContext = {},
  ): boolean {
    return (
      this.canEdit(actor, target, context) &&
      roleCanControlContractorQuote(actor.role, QUOTE_CONTROL_ACTIONS.Revise)
    );
  },

  canReopen(actor: AccessActor, target: ContractorQuoteAccessTarget): boolean {
    return (
      actorHasTenantScopedRole(actor, target.organizationId) &&
      roleCanControlContractorQuote(actor.role, QUOTE_CONTROL_ACTIONS.Reopen)
    );
  },

  canTransition(
    actor: AccessActor,
    target: ContractorQuoteAccessTarget,
    context: AssignmentRelationshipContext = {},
  ): boolean {
    if (
      isInternalActorWithAuthorityForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.ContractorQuotes,
        AUTHORITY_CATEGORIES.Transition,
      )
    ) {
      return true;
    }

    return isContractorAssignedToWorkOrder(
      actor,
      target,
      context,
      PERMISSION_ENTITIES.ContractorQuotes,
      AUTHORITY_CATEGORIES.Transition,
    );
  },

  canTransitionTo(
    actor: AccessActor,
    target: ContractorQuoteAccessTarget & Pick<ContractorQuote, "status">,
    nextStatus: ContractorQuote["status"],
    context: AssignmentRelationshipContext = {},
  ): boolean {
    return (
      this.canTransition(actor, target, context) &&
      canTransitionEntityStatus(
        "contractor_quote",
        target.status,
        nextStatus,
        actor.role,
      )
    );
  },
};

export const clientQuotePolicy = {
  canCreate(actor: AccessActor, target: ClientQuoteAccessTarget): boolean {
    return (
      isInternalActorWithEntityPermissionForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.ClientFacingQuotes,
        AUTHORITY_CATEGORIES.Create,
      ) &&
      roleCanControlClientQuote(actor.role, QUOTE_CONTROL_ACTIONS.Create)
    );
  },

  canCreateFromContractorQuote(
    actor: AccessActor,
    target: ClientQuoteTransformTarget,
    contractorQuote: ContractorQuoteAccessTarget & Pick<ContractorQuote, "id">,
  ): boolean {
    return (
      this.canCreate(actor, target) &&
      contractorQuotePolicy.canRead(actor, contractorQuote) &&
      roleCanControlClientQuote(actor.role, QUOTE_CONTROL_ACTIONS.Create) &&
      contractorQuote.status === "accepted" &&
      target.organizationId === contractorQuote.organizationId &&
      target.workOrderId === contractorQuote.workOrderId &&
      target.contractorQuoteId === contractorQuote.id
    );
  },

  canRead(actor: AccessActor, target: ClientQuoteAccessTarget): boolean {
    if (
      isInternalActorWithAuthorityForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.ClientFacingQuotes,
        AUTHORITY_CATEGORIES.View,
      )
    ) {
      return true;
    }

    return isClientActorForLocation(
      actor,
      target,
      PERMISSION_ENTITIES.ClientFacingQuotes,
      AUTHORITY_CATEGORIES.View,
    );
  },

  canEdit(actor: AccessActor, target: ClientQuoteAccessTarget): boolean {
    if (
      isInternalActorWithAuthorityForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.ClientFacingQuotes,
        AUTHORITY_CATEGORIES.Edit,
      ) &&
      canEditTargetDetails("client_quote", target, actor.role)
    ) {
      return true;
    }

    return false;
  },

  canUpdate(actor: AccessActor, target: ClientQuoteAccessTarget): boolean {
    return this.canEdit(actor, target);
  },

  canApprove(actor: AccessActor, target: ClientQuoteAccessTarget): boolean {
    if (
      isInternalActorWithAuthorityForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.ClientFacingQuotes,
        AUTHORITY_CATEGORIES.Approve,
      ) &&
      roleCanControlClientQuote(actor.role, QUOTE_CONTROL_ACTIONS.Approve)
    ) {
      return true;
    }

    return (
      roleCanControlClientQuote(actor.role, QUOTE_CONTROL_ACTIONS.Approve) &&
      isClientActorForLocation(
        actor,
        target,
        PERMISSION_ENTITIES.ClientFacingQuotes,
        AUTHORITY_CATEGORIES.Approve,
      )
    );
  },

  canSubmit(actor: AccessActor, target: ClientQuoteAccessTarget): boolean {
    return (
      this.canTransition(actor, target) &&
      roleCanControlClientQuote(actor.role, QUOTE_CONTROL_ACTIONS.Submit)
    );
  },

  canReject(actor: AccessActor, target: ClientQuoteAccessTarget): boolean {
    return (
      this.canTransition(actor, target) &&
      roleCanControlClientQuote(actor.role, QUOTE_CONTROL_ACTIONS.Reject)
    );
  },

  canRevise(actor: AccessActor, target: ClientQuoteAccessTarget): boolean {
    return (
      this.canEdit(actor, target) &&
      roleCanControlClientQuote(actor.role, QUOTE_CONTROL_ACTIONS.Revise)
    );
  },

  canReopen(actor: AccessActor, target: ClientQuoteAccessTarget): boolean {
    return (
      this.canTransition(actor, target) &&
      roleCanControlClientQuote(actor.role, QUOTE_CONTROL_ACTIONS.Reopen)
    );
  },

  canTransition(actor: AccessActor, target: ClientQuoteAccessTarget): boolean {
    if (
      isInternalActorWithAuthorityForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.ClientFacingQuotes,
        AUTHORITY_CATEGORIES.Transition,
      )
    ) {
      return true;
    }

    return isClientActorForLocation(
      actor,
      target,
      PERMISSION_ENTITIES.ClientFacingQuotes,
      AUTHORITY_CATEGORIES.Transition,
    );
  },

  canTransitionTo(
    actor: AccessActor,
    target: ClientQuoteAccessTarget & Pick<ClientQuote, "status">,
    nextStatus: ClientQuote["status"],
  ): boolean {
    return (
      this.canTransition(actor, target) &&
      canTransitionEntityStatus(
        "client_quote",
        target.status,
        nextStatus,
        actor.role,
      )
    );
  },
};

export const invoicePolicy = {
  canCreate(actor: AccessActor, target: InvoiceAccessTarget): boolean {
    return (
      isInternalActorWithAuthorityForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.Invoices,
        AUTHORITY_CATEGORIES.Create,
      ) &&
      roleCanControlInvoice(actor.role, INVOICE_CONTROL_ACTIONS.Draft)
    );
  },

  canRead(actor: AccessActor, target: InvoiceAccessTarget): boolean {
    if (
      isInternalActorWithAuthorityForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.Invoices,
        AUTHORITY_CATEGORIES.View,
      )
    ) {
      return true;
    }

    if (
      isClientActorForLocation(
        actor,
        target,
        PERMISSION_ENTITIES.Invoices,
        AUTHORITY_CATEGORIES.View,
      )
    ) {
      return true;
    }

    return false;
  },

  canEdit(actor: AccessActor, target: InvoiceAccessTarget): boolean {
    return (
      canEditTargetDetails("invoice", target, actor.role) &&
      isInternalActorWithAuthorityForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.Invoices,
        AUTHORITY_CATEGORIES.Edit,
      ) &&
      roleCanControlInvoice(actor.role, INVOICE_CONTROL_ACTIONS.Edit)
    );
  },

  canUpdate(actor: AccessActor, target: InvoiceAccessTarget): boolean {
    return this.canEdit(actor, target);
  },

  canApprove(actor: AccessActor, target: InvoiceAccessTarget): boolean {
    return (
      isInternalActorWithAuthorityForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.Invoices,
        AUTHORITY_CATEGORIES.Approve,
      ) &&
      roleCanControlInvoice(actor.role, INVOICE_CONTROL_ACTIONS.IssueSend)
    );
  },

  canTransition(actor: AccessActor, target: InvoiceAccessTarget): boolean {
    if (
      isInternalActorWithAuthorityForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.Invoices,
        AUTHORITY_CATEGORIES.Transition,
      ) &&
      (roleCanControlInvoice(actor.role, INVOICE_CONTROL_ACTIONS.IssueSend) ||
        roleCanControlInvoice(actor.role, INVOICE_CONTROL_ACTIONS.Dispute))
    ) {
      return true;
    }

    return (
      roleCanControlInvoice(actor.role, INVOICE_CONTROL_ACTIONS.Dispute) &&
      isClientActorForLocation(
        actor,
        target,
        PERMISSION_ENTITIES.Invoices,
        AUTHORITY_CATEGORIES.Transition,
      )
    );
  },

  canIssueSend(actor: AccessActor, target: InvoiceAccessTarget): boolean {
    return (
      this.canTransition(actor, target) &&
      roleCanControlInvoice(actor.role, INVOICE_CONTROL_ACTIONS.IssueSend)
    );
  },

  canMarkPaid(actor: AccessActor, target: InvoiceAccessTarget): boolean {
    return (
      this.canTransition(actor, target) &&
      roleCanControlInvoice(actor.role, INVOICE_CONTROL_ACTIONS.MarkPaid)
    );
  },

  canMarkOverdue(actor: AccessActor, target: InvoiceAccessTarget): boolean {
    return (
      this.canTransition(actor, target) &&
      roleCanControlInvoice(actor.role, INVOICE_CONTROL_ACTIONS.MarkOverdue)
    );
  },

  canDispute(actor: AccessActor, target: InvoiceAccessTarget): boolean {
    if (
      roleCanControlInvoice(actor.role, INVOICE_CONTROL_ACTIONS.Dispute) &&
      isClientActorForLocation(
        actor,
        target,
        PERMISSION_ENTITIES.Invoices,
        AUTHORITY_CATEGORIES.View,
      )
    ) {
      return true;
    }

    return (
      this.canTransition(actor, target) &&
      roleCanControlInvoice(actor.role, INVOICE_CONTROL_ACTIONS.Dispute)
    );
  },

  canResolve(actor: AccessActor, target: InvoiceAccessTarget): boolean {
    return (
      this.canTransition(actor, target) &&
      roleCanControlInvoice(actor.role, INVOICE_CONTROL_ACTIONS.Resolve)
    );
  },

  canReopen(actor: AccessActor, target: InvoiceAccessTarget): boolean {
    return (
      actorHasTenantScopedRole(actor, target.organizationId) &&
      roleCanControlInvoice(actor.role, INVOICE_CONTROL_ACTIONS.Reopen)
    );
  },

  canTransitionTo(
    actor: AccessActor,
    target: InvoiceAccessTarget & Pick<Invoice, "status">,
    nextStatus: Invoice["status"],
  ): boolean {
    return (
      this.canTransition(actor, target) &&
      canTransitionEntityStatus("invoice", target.status, nextStatus, actor.role)
    );
  },
};

export const clientOrganizationPolicy = {
  canCreate(actor: AccessActor, target: TenantScopedTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.ClientOrganizations,
      AUTHORITY_CATEGORIES.Create,
    );
  },

  canRead(actor: AccessActor, target: ClientOrganizationAccessTarget): boolean {
    if (
      isInternalActorWithEntityPermissionForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.ClientOrganizations,
        AUTHORITY_CATEGORIES.View,
      )
    ) {
      return true;
    }

    return isClientActorForOrganization(
      actor,
      {
        organizationId: target.organizationId,
        clientOrganizationId: target.id,
      },
      PERMISSION_ENTITIES.ClientOrganizations,
      AUTHORITY_CATEGORIES.View,
    );
  },

  canEdit(actor: AccessActor, target: ClientOrganizationAccessTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.ClientOrganizations,
      AUTHORITY_CATEGORIES.Edit,
    );
  },

  canUpdate(actor: AccessActor, target: ClientOrganizationAccessTarget): boolean {
    return this.canEdit(actor, target);
  },

  canApprove(actor: AccessActor, target: ClientOrganizationAccessTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.ClientOrganizations,
      AUTHORITY_CATEGORIES.Approve,
    );
  },

  canTransition(
    actor: AccessActor,
    target: ClientOrganizationAccessTarget,
  ): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.ClientOrganizations,
      AUTHORITY_CATEGORIES.Transition,
    );
  },
};

export const locationPolicy = {
  canCreate(
    actor: AccessActor,
    target: TenantScopedTarget &
      Partial<Pick<LocationAccessTarget, "clientOrganizationId">>,
  ): boolean {
    if (
      isInternalActorWithEntityPermissionForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.Locations,
        AUTHORITY_CATEGORIES.Create,
      )
    ) {
      return true;
    }

    return Boolean(
      target.clientOrganizationId &&
        isClientActorForOrganization(
          actor,
          {
            organizationId: target.organizationId,
            clientOrganizationId: target.clientOrganizationId,
          },
          PERMISSION_ENTITIES.Locations,
          AUTHORITY_CATEGORIES.Create,
        ),
    );
  },

  canRead(actor: AccessActor, target: LocationAccessTarget): boolean {
    if (
      isInternalActorWithEntityPermissionForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.Locations,
        AUTHORITY_CATEGORIES.View,
      )
    ) {
      return true;
    }

    return isClientActorForLocation(
      actor,
      {
        organizationId: target.organizationId,
        clientOrganizationId: target.clientOrganizationId,
        locationId: target.id,
      },
      PERMISSION_ENTITIES.Locations,
      AUTHORITY_CATEGORIES.View,
    );
  },

  canEdit(actor: AccessActor, target: LocationAccessTarget): boolean {
    if (
      isInternalActorWithEntityPermissionForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.Locations,
        AUTHORITY_CATEGORIES.Edit,
      )
    ) {
      return true;
    }

    return isClientActorForLocation(
      actor,
      {
        organizationId: target.organizationId,
        clientOrganizationId: target.clientOrganizationId,
        locationId: target.id,
      },
      PERMISSION_ENTITIES.Locations,
      AUTHORITY_CATEGORIES.Edit,
    );
  },

  canUpdate(actor: AccessActor, target: LocationAccessTarget): boolean {
    return this.canEdit(actor, target);
  },

  canApprove(actor: AccessActor, target: LocationAccessTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.Locations,
      AUTHORITY_CATEGORIES.Approve,
    );
  },

  canTransition(actor: AccessActor, target: LocationAccessTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.Locations,
      AUTHORITY_CATEGORIES.Transition,
    );
  },
};

export const contractorOrganizationPolicy = {
  canCreate(actor: AccessActor, target: TenantScopedTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.Contractors,
      AUTHORITY_CATEGORIES.Create,
    );
  },

  canRead(actor: AccessActor, target: ContractorOrganizationAccessTarget): boolean {
    if (
      isInternalActorWithEntityPermissionForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.Contractors,
        AUTHORITY_CATEGORIES.View,
      )
    ) {
      return true;
    }

    return isContractorActorForOrganization(
      actor,
      {
        organizationId: target.organizationId,
        contractorOrganizationId: target.id,
      },
      PERMISSION_ENTITIES.Contractors,
      AUTHORITY_CATEGORIES.View,
    );
  },

  canEdit(actor: AccessActor, target: ContractorOrganizationAccessTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.Contractors,
      AUTHORITY_CATEGORIES.Edit,
    );
  },

  canUpdate(
    actor: AccessActor,
    target: ContractorOrganizationAccessTarget,
  ): boolean {
    return this.canEdit(actor, target);
  },

  canApprove(
    actor: AccessActor,
    target: ContractorOrganizationAccessTarget,
  ): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.Contractors,
      AUTHORITY_CATEGORIES.Approve,
    );
  },

  canTransition(
    actor: AccessActor,
    target: ContractorOrganizationAccessTarget,
  ): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.Contractors,
      AUTHORITY_CATEGORIES.Transition,
    );
  },
};

export const activityLogPolicy = {
  canCreate(actor: AccessActor, target: InternalOnlyTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.ActivityLogs,
      AUTHORITY_CATEGORIES.Create,
    );
  },

  canRead(actor: AccessActor, target: InternalOnlyTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.ActivityLogs,
      AUTHORITY_CATEGORIES.View,
    );
  },

  canEdit(actor: AccessActor, target: InternalOnlyTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.ActivityLogs,
      AUTHORITY_CATEGORIES.Edit,
    );
  },

  canUpdate(actor: AccessActor, target: InternalOnlyTarget): boolean {
    return this.canEdit(actor, target);
  },

  canApprove(actor: AccessActor, target: InternalOnlyTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.ActivityLogs,
      AUTHORITY_CATEGORIES.Approve,
    );
  },

  canTransition(actor: AccessActor, target: InternalOnlyTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.ActivityLogs,
      AUTHORITY_CATEGORIES.Transition,
    );
  },
};

export const dashboardPolicy = {
  canRead(actor: AccessActor, target: InternalOnlyTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.DashboardAccess,
      AUTHORITY_CATEGORIES.View,
    );
  },
};

export const internalNotePolicy = {
  canCreate(actor: AccessActor, target: InternalOnlyTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.InternalNotes,
      AUTHORITY_CATEGORIES.Create,
    );
  },

  canRead(actor: AccessActor, target: InternalOnlyTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.InternalNotes,
      AUTHORITY_CATEGORIES.View,
    );
  },

  canEdit(actor: AccessActor, target: InternalOnlyTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.InternalNotes,
      AUTHORITY_CATEGORIES.Edit,
    );
  },

  canUpdate(actor: AccessActor, target: InternalOnlyTarget): boolean {
    return this.canEdit(actor, target);
  },

  canApprove(actor: AccessActor, target: InternalOnlyTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.InternalNotes,
      AUTHORITY_CATEGORIES.Approve,
    );
  },

  canTransition(actor: AccessActor, target: InternalOnlyTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.InternalNotes,
      AUTHORITY_CATEGORIES.Transition,
    );
  },
};

export const paymentStatusPolicy = {
  canCreate(actor: AccessActor, target: PaymentStatusAccessTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.PaymentStatus,
      AUTHORITY_CATEGORIES.Create,
    );
  },

  canRead(actor: AccessActor, target: PaymentStatusAccessTarget): boolean {
    if (
      isInternalActorWithEntityPermissionForTenant(
        actor,
        target.organizationId,
        PERMISSION_ENTITIES.PaymentStatus,
        AUTHORITY_CATEGORIES.View,
      )
    ) {
      return true;
    }

    return isClientActorForLocation(
      actor,
      target,
      PERMISSION_ENTITIES.PaymentStatus,
      AUTHORITY_CATEGORIES.View,
    );
  },

  canEdit(actor: AccessActor, target: PaymentStatusAccessTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.PaymentStatus,
      AUTHORITY_CATEGORIES.Edit,
    );
  },

  canUpdate(actor: AccessActor, target: PaymentStatusAccessTarget): boolean {
    return this.canEdit(actor, target);
  },

  canApprove(actor: AccessActor, target: PaymentStatusAccessTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.PaymentStatus,
      AUTHORITY_CATEGORIES.Approve,
    );
  },

  canTransition(actor: AccessActor, target: PaymentStatusAccessTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.PaymentStatus,
      AUTHORITY_CATEGORIES.Transition,
    );
  },
};

export const billingDataPolicy = {
  canCreate(actor: AccessActor, target: BillingDataAccessTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.BillingData,
      AUTHORITY_CATEGORIES.Create,
    );
  },

  canRead(actor: AccessActor, target: BillingDataAccessTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.BillingData,
      AUTHORITY_CATEGORIES.View,
    );
  },

  canEdit(actor: AccessActor, target: BillingDataAccessTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.BillingData,
      AUTHORITY_CATEGORIES.Edit,
    );
  },

  canUpdate(actor: AccessActor, target: BillingDataAccessTarget): boolean {
    return this.canEdit(actor, target);
  },

  canApprove(actor: AccessActor, target: BillingDataAccessTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.BillingData,
      AUTHORITY_CATEGORIES.Approve,
    );
  },

  canTransition(actor: AccessActor, target: BillingDataAccessTarget): boolean {
    return isInternalActorWithEntityPermissionForTenant(
      actor,
      target.organizationId,
      PERMISSION_ENTITIES.BillingData,
      AUTHORITY_CATEGORIES.Transition,
    );
  },
};

function isInternalActorWithEntityPermissionForTenant(
  actor: AccessActor,
  organizationId: EntityId,
  entity: PermissionEntity,
  authority: AuthorityCategory,
): actor is InternalAccessActor {
  return (
    actor.actorType === "internal" &&
    actor.scope.organizationId === organizationId &&
    roleCanAccessEntity(actor.role, entity, authority)
  );
}

function isInternalActorWithAuthorityForTenant(
  actor: AccessActor,
  organizationId: EntityId,
  entity: PermissionEntity,
  authority: AuthorityCategory,
): actor is InternalAccessActor {
  return isInternalActorWithEntityPermissionForTenant(
    actor,
    organizationId,
    entity,
    authority,
  );
}

function actorHasTenantScopedRole(
  actor: AccessActor,
  organizationId: EntityId,
): boolean {
  return actor.scope.organizationId === organizationId;
}

function isClientActorForOrganization(
  actor: AccessActor,
  target: TenantScopedTarget & Pick<ClientOwnedTarget, "clientOrganizationId">,
  entity: PermissionEntity,
  authority: AuthorityCategory,
): actor is ClientAccessActor {
  return (
    actor.actorType === "client" &&
    actor.scope.organizationId === target.organizationId &&
    actor.scope.clientOrganizationId === target.clientOrganizationId &&
    roleCanAccessEntity(actor.role, entity, authority)
  );
}

function isClientActorForLocation(
  actor: AccessActor,
  target: ClientOwnedTarget,
  entity: PermissionEntity,
  authority: AuthorityCategory,
): actor is ClientAccessActor {
  if (!isClientActorForOrganization(actor, target, entity, authority)) {
    return false;
  }

  if (actor.scope.locationAccess.kind === "all_client_locations") {
    return true;
  }

  return actor.scope.locationAccess.locationIds.includes(target.locationId);
}

function isContractorActorForOrganization(
  actor: AccessActor,
  target: TenantScopedTarget & Pick<Assignment, "contractorOrganizationId">,
  entity: PermissionEntity,
  authority: AuthorityCategory,
): actor is ContractorAccessActor {
  return (
    actor.actorType === "contractor" &&
    actor.scope.organizationId === target.organizationId &&
    actor.scope.contractorOrganizationId === target.contractorOrganizationId &&
    roleCanAccessEntity(actor.role, entity, authority)
  );
}

function isContractorAssignedToWorkOrder(
  actor: AccessActor,
  target: TenantScopedTarget &
    Pick<Assignment, "workOrderId" | "contractorOrganizationId">,
  context: AssignmentRelationshipContext,
  entity: PermissionEntity,
  authority: AuthorityCategory,
): actor is ContractorAccessActor {
  if (!isContractorActorForOrganization(actor, target, entity, authority)) {
    return false;
  }

  return isContractorAssignedToWorkOrderId(
    actor,
    target.organizationId,
    target.workOrderId,
    context,
    entity,
    authority,
  );
}

function isContractorAssignedToWorkOrderId(
  actor: AccessActor,
  organizationId: EntityId,
  workOrderId: EntityId,
  context: AssignmentRelationshipContext,
  entity: PermissionEntity,
  authority: AuthorityCategory,
): actor is ContractorAccessActor {
  if (
    actor.actorType !== "contractor" ||
    actor.scope.organizationId !== organizationId ||
    !roleCanAccessEntity(actor.role, entity, authority)
  ) {
    return false;
  }

  if (actor.scope.assignedWorkOrderIds?.includes(workOrderId)) {
    return true;
  }

  return (context.assignments ?? []).some(
    (assignment) =>
      assignment.organizationId === organizationId &&
      assignment.workOrderId === workOrderId &&
      assignment.contractorOrganizationId === actor.scope.contractorOrganizationId,
  );
}

function canEditTargetDetails(
  entity: "contractor_quote",
  target: ContractorQuoteAccessTarget,
  role: AccessActor["role"],
): boolean;
function canEditTargetDetails(
  entity: "client_quote",
  target: ClientQuoteAccessTarget,
  role: AccessActor["role"],
): boolean;
function canEditTargetDetails(
  entity: "invoice",
  target: InvoiceAccessTarget,
  role: AccessActor["role"],
): boolean;
function canEditTargetDetails(
  entity: "contractor_quote" | "client_quote" | "invoice",
  target:
    | ContractorQuoteAccessTarget
    | ClientQuoteAccessTarget
    | InvoiceAccessTarget,
  role: AccessActor["role"],
): boolean {
  if (!target.status) {
    return true;
  }

  if (entity === "contractor_quote") {
    return canEditStatusControlledEntityDetails(
      entity,
      target.status as ContractorQuote["status"],
      role,
    );
  }

  if (entity === "client_quote") {
    return canEditStatusControlledEntityDetails(
      entity,
      target.status as ClientQuote["status"],
      role,
    );
  }

  return canEditStatusControlledEntityDetails(
    entity,
    target.status as Invoice["status"],
    role,
  );
}
