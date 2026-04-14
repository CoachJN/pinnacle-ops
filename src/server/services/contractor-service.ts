import "server-only";

import type {
  ContractorOrganization,
  FirestoreContractorOrganizationStatus,
  FirestoreRepositories,
} from "@/server/repositories";
import { filterContractors } from "@/modules/contractors";
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
    "contractorOrganizations" | "workOrders"
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
  status?: FirestoreContractorOrganizationStatus;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  serviceCategories?: string[];
  serviceAreas?: string[];
  notes?: string | null;
}

export interface UpdateContractorOrganizationInput extends ServiceAuditContext {
  contractorOrganizationId: EntityId;
  name?: string;
  displayName?: string | null;
  status?: FirestoreContractorOrganizationStatus;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  serviceCategories?: string[];
  serviceAreas?: string[];
  notes?: string | null;
}

export interface ArchiveContractorOrganizationInput extends ServiceAuditContext {
  contractorOrganizationId: EntityId;
}

class FirestoreContractorService implements ContractorService {
  private readonly repositories: Pick<
    FirestoreRepositories,
    "contractorOrganizations" | "workOrders"
  >;

  constructor(
    repositories: Pick<
      FirestoreRepositories,
      "contractorOrganizations" | "workOrders"
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
          company: contractor.displayName,
          email: contractor.primaryContactEmail,
          phone: contractor.primaryContactPhone,
        })),
        {
          status: input.status,
          search: input.search,
        },
      ).map(({ company: _company, email: _email, phone: _phone, ...contractor }) => contractor),
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

    const contractor: ContractorOrganization = {
      id: this.repositories.contractorOrganizations.newId(),
      ...createAuditFields(input),
      name: name.value,
      displayName: normalizeNullableText(input.displayName),
      status: input.status ?? "active",
      primaryContactName: normalizeNullableText(input.primaryContactName),
      primaryContactEmail: normalizeNullableText(input.primaryContactEmail),
      primaryContactPhone: normalizeNullableText(input.primaryContactPhone),
      serviceCategories: normalizeServiceCategories(input.serviceCategories),
      serviceAreas: normalizeStringList(input.serviceAreas),
      notes: normalizeNullableText(input.notes),
    };

    await this.repositories.contractorOrganizations.create(contractor);
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

    const updated = touchAuditFields(
      {
        ...existing,
        name: name.value,
        displayName:
          input.displayName === undefined
            ? existing.displayName
            : normalizeNullableText(input.displayName),
        status: input.status ?? existing.status,
        primaryContactName:
          input.primaryContactName === undefined
            ? existing.primaryContactName
            : normalizeNullableText(input.primaryContactName),
        primaryContactEmail:
          input.primaryContactEmail === undefined
            ? existing.primaryContactEmail
            : normalizeNullableText(input.primaryContactEmail),
        primaryContactPhone:
          input.primaryContactPhone === undefined
            ? existing.primaryContactPhone
            : normalizeNullableText(input.primaryContactPhone),
        serviceCategories:
          input.serviceCategories === undefined
            ? existing.serviceCategories
            : normalizeServiceCategories(input.serviceCategories),
        serviceAreas:
          input.serviceAreas === undefined
            ? existing.serviceAreas
            : normalizeStringList(input.serviceAreas),
        notes:
          input.notes === undefined
            ? existing.notes
            : normalizeNullableText(input.notes),
      },
      input,
    );

    await this.repositories.contractorOrganizations.save(updated);
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

function normalizeServiceCategories(serviceCategories: string[] | undefined): string[] {
  return normalizeStringList(serviceCategories);
}

function normalizeStringList(values: string[] | undefined): string[] {
  return Array.from(
    new Set(
      (values ?? []).map((value) => value.trim()).filter(Boolean),
    ),
  );
}
