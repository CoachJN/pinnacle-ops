import "server-only";

import {
  ensureRoleSlotContactsAreLinked,
  isContactAssignedToPrimaryRole,
  type ContactRoleSlotAssignment,
} from "@/lib/contact-linking";
import type {
  ContractorContactLink,
  ContractorOrganization,
  FirestoreContractorOrganizationStatus,
  FirestoreRepositories,
} from "@/server/repositories";
import { filterContractors } from "@/modules/contractors";
import type { ContactLinkInput } from "@/types/contact";
import type { EntityId } from "@/types/entity";
import { conflictError, notFoundError, validationError } from "./errors";
import {
  createAuditFields,
  serviceFail,
  serviceOk,
  touchAuditFields,
  type ServiceAuditContext,
  type ServiceResult,
} from "./types";

export interface ContractorService {
  listContractorOrganizations(
    input: ListContractorOrganizationsInput,
  ): Promise<ServiceResult<ContractorOrganization[]>>;
  getContractorOrganization(
    contractorOrganizationId: EntityId,
  ): Promise<ServiceResult<ContractorOrganization>>;
  createContractorOrganization(
    input: CreateContractorOrganizationInput,
  ): Promise<ServiceResult<ContractorOrganization>>;
  updateContractorOrganization(
    input: UpdateContractorOrganizationInput,
  ): Promise<ServiceResult<ContractorOrganization>>;
  archiveContractorOrganization(
    input: ArchiveContractorOrganizationInput,
  ): Promise<ServiceResult<ContractorOrganization>>;
}

export function createContractorService(
  repositories: Pick<
    FirestoreRepositories,
    | "contacts"
    | "contractorContactLinks"
    | "contractorOrganizations"
    | "workOrders"
  >,
): ContractorService {
  return new FirestoreContractorService(repositories);
}

export interface ListContractorOrganizationsInput {
  organizationId: EntityId;
  status?: FirestoreContractorOrganizationStatus;
  search?: string;
  limit?: number;
}

export interface CreateContractorOrganizationInput extends ServiceAuditContext {
  name: string;
  displayName?: string | null;
  parentContractorId?: EntityId | null;
  status?: FirestoreContractorOrganizationStatus;
  isAssignable?: boolean;
  businessEmail?: string | null;
  mainPhone?: string | null;
  altPhone?: string | null;
  fax?: string | null;
  primaryContactId?: EntityId | null;
  billingContactId?: EntityId | null;
  dispatchContactId?: EntityId | null;
  linkedContacts?: ContactLinkInput[];
  trades?: string[];
  serviceArea?: string | null;
  notes?: string | null;
}

export interface UpdateContractorOrganizationInput extends ServiceAuditContext {
  contractorOrganizationId: EntityId;
  name?: string;
  displayName?: string | null;
  parentContractorId?: EntityId | null;
  status?: FirestoreContractorOrganizationStatus;
  isAssignable?: boolean;
  businessEmail?: string | null;
  mainPhone?: string | null;
  altPhone?: string | null;
  fax?: string | null;
  primaryContactId?: EntityId | null;
  billingContactId?: EntityId | null;
  dispatchContactId?: EntityId | null;
  linkedContacts?: ContactLinkInput[];
  trades?: string[];
  serviceArea?: string | null;
  notes?: string | null;
}

export interface ArchiveContractorOrganizationInput extends ServiceAuditContext {
  contractorOrganizationId: EntityId;
}

class FirestoreContractorService implements ContractorService {
  private readonly repositories: Pick<
    FirestoreRepositories,
    | "contacts"
    | "contractorContactLinks"
    | "contractorOrganizations"
    | "workOrders"
  >;

  constructor(
    repositories: Pick<
      FirestoreRepositories,
      | "contacts"
      | "contractorContactLinks"
      | "contractorOrganizations"
      | "workOrders"
    >,
  ) {
    this.repositories = repositories;
  }

  async listContractorOrganizations(
    input: ListContractorOrganizationsInput,
  ): Promise<ServiceResult<ContractorOrganization[]>> {
    const contractors =
      await this.repositories.contractorOrganizations.listByOrganizationId(
        input.organizationId,
        { limit: input.limit },
      );
    return serviceOk(
      filterContractors(
        contractors.items.map((contractor) => ({
          ...contractor,
          legalName: contractor.name,
          displayName: contractor.displayName,
          businessEmail: contractor.businessEmail,
          mainPhone: contractor.mainPhone,
          status: contractor.status,
          trades: contractor.trades ?? [],
          serviceArea: contractor.serviceArea,
        })),
        {
          status: input.status,
          search: input.search,
        },
      ),
    );
  }

  async getContractorOrganization(
    contractorOrganizationId: EntityId,
  ): Promise<ServiceResult<ContractorOrganization>> {
    if (!contractorOrganizationId.trim()) {
      return serviceFail(validationError("Contractor organization is required."));
    }

    const contractor =
      await this.repositories.contractorOrganizations.getById(
        contractorOrganizationId,
      );
    if (!contractor || contractor.isDeleted) {
      return serviceFail(
        notFoundError("Contractor organization could not be found."),
      );
    }

    return serviceOk(contractor);
  }

  async createContractorOrganization(
    input: CreateContractorOrganizationInput,
  ): Promise<ServiceResult<ContractorOrganization>> {
    const name = normalizeRequiredText(input.name, "Contractor name");
    if (!name.ok) {
      return name;
    }

    const parentValidation = await this.validateParentContractor(
      input.parentContractorId,
      null,
    );
    if (!parentValidation.ok) {
      return parentValidation;
    }

    const primaryContactId = normalizeNullableText(input.primaryContactId);
    const billingContactId = normalizeNullableText(input.billingContactId);
    const dispatchContactId = normalizeNullableText(input.dispatchContactId);
    const roleSlots = toContractorRoleSlots({
      primaryContactId: primaryContactId ?? null,
      billingContactId: billingContactId ?? null,
      dispatchContactId: dispatchContactId ?? null,
    });
    const linkedContacts = ensureRoleSlotContactsAreLinked(
      input.linkedContacts ?? [],
      roleSlots,
    );
    const contactValidation = await validateContactsExist(
      this.repositories,
      linkedContacts.map((link) => link.contactId),
    );
    if (!contactValidation.ok) {
      return contactValidation;
    }

    const contractor: ContractorOrganization = {
      id: this.repositories.contractorOrganizations.newId(),
      ...createAuditFields(input),
      name: name.value,
      displayName: normalizeNullableText(input.displayName),
      parentContractorId: parentValidation.value,
      status: input.status ?? "active",
      isAssignable: input.isAssignable ?? undefined,
      businessEmail: normalizeNullableText(input.businessEmail),
      mainPhone: normalizeNullableText(input.mainPhone),
      altPhone: normalizeNullableText(input.altPhone),
      fax: normalizeNullableText(input.fax),
      primaryContactId,
      billingContactId,
      dispatchContactId,
      trades: normalizeStringList(input.trades),
      serviceArea: normalizeNullableText(input.serviceArea),
      notes: normalizeNullableText(input.notes),
    };

    await this.repositories.contractorOrganizations.create(contractor);
    await this.repositories.contractorContactLinks.replaceForContractorId(
      contractor.id,
      buildContractorContactLinks({
        contractor,
        linkedContacts,
        roleSlots,
        audit: input,
      }),
    );
    return serviceOk(contractor);
  }

  async updateContractorOrganization(
    input: UpdateContractorOrganizationInput,
  ): Promise<ServiceResult<ContractorOrganization>> {
    const existing =
      await this.repositories.contractorOrganizations.getById(
        input.contractorOrganizationId,
      );
    if (!existing || existing.isDeleted) {
      return serviceFail(
        notFoundError("Contractor organization could not be found."),
      );
    }

    const name =
      input.name === undefined
        ? serviceOk(existing.name)
        : normalizeRequiredText(input.name, "Contractor name");
    if (!name.ok) {
      return name;
    }

    const parentValidation = await this.validateParentContractor(
      input.parentContractorId,
      existing.id,
    );
    if (!parentValidation.ok) {
      return parentValidation;
    }

    const primaryContactId =
      input.primaryContactId === undefined
        ? existing.primaryContactId ?? null
        : normalizeNullableText(input.primaryContactId);
    const billingContactId =
      input.billingContactId === undefined
        ? existing.billingContactId ?? null
        : normalizeNullableText(input.billingContactId);
    const dispatchContactId =
      input.dispatchContactId === undefined
        ? existing.dispatchContactId ?? null
        : normalizeNullableText(input.dispatchContactId);
    const existingLinks = await this.repositories.contractorContactLinks.listByContractorId(
      existing.id,
      { limit: 100 },
    );
    const roleSlots = toContractorRoleSlots({
      primaryContactId,
      billingContactId,
      dispatchContactId,
    });
    const linkedContacts = ensureRoleSlotContactsAreLinked(
      input.linkedContacts ??
        existingLinks.items.map((link) => ({
          contactId: link.contactId,
          relationshipType: link.relationshipType,
          notes: link.notes,
        })),
      roleSlots,
    );
    const contactValidation = await validateContactsExist(
      this.repositories,
      linkedContacts.map((link) => link.contactId),
    );
    if (!contactValidation.ok) {
      return contactValidation;
    }

    const updated = touchAuditFields(
      {
        ...existing,
        name: name.value,
        displayName:
          input.displayName === undefined
            ? existing.displayName
            : normalizeNullableText(input.displayName),
        parentContractorId:
          input.parentContractorId === undefined
            ? existing.parentContractorId
            : parentValidation.value,
        status: input.status ?? existing.status,
        isAssignable:
          input.isAssignable === undefined
            ? existing.isAssignable
            : input.isAssignable,
        businessEmail:
          input.businessEmail === undefined
            ? existing.businessEmail
            : normalizeNullableText(input.businessEmail),
        mainPhone:
          input.mainPhone === undefined
            ? existing.mainPhone
            : normalizeNullableText(input.mainPhone),
        altPhone:
          input.altPhone === undefined
            ? existing.altPhone
            : normalizeNullableText(input.altPhone),
        fax:
          input.fax === undefined ? existing.fax : normalizeNullableText(input.fax),
        primaryContactId,
        billingContactId,
        dispatchContactId,
        trades:
          input.trades === undefined
            ? existing.trades
            : normalizeStringList(input.trades),
        serviceArea:
          input.serviceArea === undefined
            ? existing.serviceArea
            : normalizeNullableText(input.serviceArea),
        notes:
          input.notes === undefined
            ? existing.notes
            : normalizeNullableText(input.notes),
      },
      input,
    );

    await this.repositories.contractorOrganizations.save(updated);
    await this.repositories.contractorContactLinks.replaceForContractorId(
      updated.id,
      buildContractorContactLinks({
        contractor: updated,
        linkedContacts,
        roleSlots,
        audit: input,
      }),
    );
    return serviceOk(updated);
  }

  async archiveContractorOrganization(
    input: ArchiveContractorOrganizationInput,
  ): Promise<ServiceResult<ContractorOrganization>> {
    const existing =
      await this.repositories.contractorOrganizations.getById(
        input.contractorOrganizationId,
      );
    if (!existing || existing.isDeleted) {
      return serviceFail(
        notFoundError("Contractor organization could not be found."),
      );
    }

    const workOrders =
      await this.repositories.workOrders.listByContractorOrganizationId(
        existing.id,
        { limit: 1 },
      );
    if (workOrders.items.length > 0) {
      return serviceFail(
        conflictError(
          "Contractor organizations with assigned work orders cannot be archived.",
        ),
      );
    }

    const archivedAt = input.now ?? new Date().toISOString();
    const archived = touchAuditFields(
      {
        ...existing,
        recordStatus: "archived" as const,
        isDeleted: true,
        deletedAt: archivedAt,
        deletedByUserId: input.actor.userId,
      },
      { ...input, now: archivedAt },
    );

    await this.repositories.contractorOrganizations.save(archived);
    return serviceOk(archived);
  }

  private async validateParentContractor(
    parentContractorId: EntityId | null | undefined,
    contractorOrganizationId: EntityId | null,
  ): Promise<ServiceResult<EntityId | null>> {
    if (parentContractorId === undefined) {
      return serviceOk(null);
    }

    const normalizedParentId = normalizeNullableText(parentContractorId);
    if (!normalizedParentId) {
      return serviceOk(null);
    }

    if (contractorOrganizationId && normalizedParentId === contractorOrganizationId) {
      return serviceFail(
        validationError("Contractor cannot be its own parent organization."),
      );
    }

    const parent = await this.repositories.contractorOrganizations.getById(
      normalizedParentId,
    );
    if (!parent || parent.isDeleted) {
      return serviceFail(
        validationError("Parent contractor organization could not be found."),
      );
    }

    return serviceOk(normalizedParentId);
  }
}

function normalizeRequiredText(
  value: string,
  label: string,
): ServiceResult<string> {
  const normalized = value.trim();
  if (!normalized) {
    return serviceFail(validationError(`${label} is required.`));
  }

  return serviceOk(normalized);
}

function normalizeNullableText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeStringList(values: string[] | undefined): string[] {
  return Array.from(
    new Set(
      (values ?? []).map((value) => value.trim()).filter(Boolean),
    ),
  );
}

async function validateContactsExist(
  repositories: Pick<FirestoreRepositories, "contacts">,
  contactIds: Array<EntityId | null | undefined>,
): Promise<ServiceResult<void>> {
  const normalizedIds = [...new Set(contactIds.filter(Boolean).map((contactId) => contactId!.trim()))];
  if (normalizedIds.length === 0) {
    return serviceOk(undefined);
  }

  const contacts = await repositories.contacts.listByIds(normalizedIds);
  const foundIds = new Set(contacts.items.map((contact) => contact.id));
  const missingId = normalizedIds.find((contactId) => !foundIds.has(contactId));
  if (missingId) {
    return serviceFail(validationError(`Contact ${missingId} could not be found.`));
  }

  return serviceOk(undefined);
}

function buildContractorContactLinks(input: {
  contractor: ContractorOrganization;
  linkedContacts: ContactLinkInput[];
  roleSlots: ContactRoleSlotAssignment<
    "primaryContactId" | "billingContactId" | "dispatchContactId"
  >[];
  audit: ServiceAuditContext;
}): ContractorContactLink[] {
  return input.linkedContacts.map((link) => ({
    id: `${input.contractor.id}:${link.contactId}`,
    ...createAuditFields({
      ...input.audit,
      organizationId: input.contractor.organizationId,
    }),
    contractorId: input.contractor.id,
    contactId: link.contactId,
    relationshipType: link.relationshipType,
    isPrimary: isContactAssignedToPrimaryRole(link.contactId, input.roleSlots),
    notes: normalizeNullableText(link.notes),
  }));
}

function toContractorRoleSlots(input: {
  primaryContactId: EntityId | null;
  billingContactId: EntityId | null;
  dispatchContactId: EntityId | null;
}): ContactRoleSlotAssignment<
  "primaryContactId" | "billingContactId" | "dispatchContactId"
>[] {
  return [
    {
      key: "primaryContactId",
      label: "Primary",
      relationshipType: "primary",
      contactId: input.primaryContactId,
      isPrimary: true,
    },
    {
      key: "billingContactId",
      label: "Billing",
      relationshipType: "billing",
      contactId: input.billingContactId,
    },
    {
      key: "dispatchContactId",
      label: "Dispatch",
      relationshipType: "dispatch",
      contactId: input.dispatchContactId,
    },
  ];
}
