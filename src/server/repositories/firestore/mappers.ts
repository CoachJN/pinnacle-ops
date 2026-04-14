import "server-only";

import type { EntityId } from "@/types/entity";
import {
  toFirestoreTimestamp,
  toIsoDateTime,
  toNullableFirestoreTimestamp,
  toNullableIsoDateTime,
} from "@/server/repositories/firestore/timestamps";
import type {
  ActivityLog,
  ActivityLogDocument,
  Assignment,
  AssignmentDocument,
  ClientOrganization,
  ClientOrganizationDocument,
  ClientQuote,
  ClientQuoteDocument,
  ContractorQuote,
  ContractorQuoteDocument,
  ContractorOrganization,
  ContractorOrganizationDocument,
  DomainAuditFields,
  FirestoreAuditFields,
  Invoice,
  InvoiceDocument,
  InternalNotification,
  InternalNotificationDocument,
  Location,
  LocationDocument,
  Quote,
  QuoteDocument,
  UserProfile,
  UserProfileDocument,
  WorkOrder,
  WorkOrderDocument,
} from "@/server/repositories/firestore/models";

export interface FirestoreEntityMapper<TDomain, TDocument> {
  toDomain(id: EntityId, document: TDocument): TDomain;
  toDocument(domain: TDomain): TDocument;
}

export const userProfileMapper: FirestoreEntityMapper<
  UserProfile,
  UserProfileDocument
> = {
  toDomain: (id, document) => ({
    id,
    ...fromAuditFields(document),
    email: document.email,
    displayName: document.displayName,
    role: document.role,
    status: document.status,
    clientOrganizationId: document.clientOrganizationId,
    contractorOrganizationId: document.contractorOrganizationId,
    locationIds: document.locationIds,
    lastLoginAt: toNullableIsoDateTime(document.lastLoginAt, "lastLoginAt"),
  }),
  toDocument: (entity) => {
    const { lastLoginAt, ...domain } = omitDocumentId(entity);
    return {
      ...toAuditFields(domain),
      email: domain.email,
      displayName: domain.displayName,
      role: domain.role,
      status: domain.status,
      clientOrganizationId: domain.clientOrganizationId,
      contractorOrganizationId: domain.contractorOrganizationId,
      locationIds: domain.locationIds,
      lastLoginAt: toNullableFirestoreTimestamp(lastLoginAt),
    };
  },
};

export const clientOrganizationMapper: FirestoreEntityMapper<
  ClientOrganization,
  ClientOrganizationDocument
> = {
  toDomain: (id, document) => ({
    id,
    ...fromAuditFields(document),
    name: document.name,
    displayName: document.displayName,
    status: document.status,
    primaryContactName: document.primaryContactName,
    primaryContactEmail: document.primaryContactEmail,
    primaryContactPhone: document.primaryContactPhone,
    billingEmail: document.billingEmail,
    notes: document.notes,
  }),
  toDocument: (entity) => {
    const domain = omitDocumentId(entity);
    return {
      ...toAuditFields(domain),
      name: domain.name,
      displayName: domain.displayName,
      status: domain.status,
      primaryContactName: domain.primaryContactName,
      primaryContactEmail: domain.primaryContactEmail,
      primaryContactPhone: domain.primaryContactPhone,
      billingEmail: domain.billingEmail,
      notes: domain.notes,
    };
  },
};

export const locationMapper: FirestoreEntityMapper<Location, LocationDocument> = {
  toDomain: (id, document) => ({
    id,
    ...fromAuditFields(document),
    clientOrganizationId: document.clientOrganizationId,
    clientSnapshot: document.clientSnapshot,
    name: document.name,
    code: document.code,
    status: document.status,
    addressLine1: document.addressLine1,
    addressLine2: document.addressLine2,
    city: document.city,
    region: document.region,
    postalCode: document.postalCode,
    countryCode: document.countryCode,
    locationContactName: document.locationContactName,
    locationContactEmail: document.locationContactEmail,
    locationContactPhone: document.locationContactPhone,
    accessNotes: document.accessNotes,
    notes: document.notes,
  }),
  toDocument: (entity) => {
    const domain = omitDocumentId(entity);
    return {
      ...toAuditFields(domain),
      clientOrganizationId: domain.clientOrganizationId,
      clientSnapshot: domain.clientSnapshot,
      name: domain.name,
      code: domain.code,
      status: domain.status,
      addressLine1: domain.addressLine1,
      addressLine2: domain.addressLine2,
      city: domain.city,
      region: domain.region,
      postalCode: domain.postalCode,
      countryCode: domain.countryCode,
      locationContactName: domain.locationContactName,
      locationContactEmail: domain.locationContactEmail,
      locationContactPhone: domain.locationContactPhone,
      accessNotes: domain.accessNotes,
      notes: domain.notes,
    };
  },
};

export const contractorOrganizationMapper: FirestoreEntityMapper<
  ContractorOrganization,
  ContractorOrganizationDocument
> = {
  toDomain: (id, document) => ({
    id,
    ...fromAuditFields(document),
    name: document.name,
    displayName: document.displayName,
    status: document.status,
    primaryContactName: document.primaryContactName,
    primaryContactEmail: document.primaryContactEmail,
    primaryContactPhone: document.primaryContactPhone,
    serviceCategories: document.serviceCategories,
    serviceAreas: document.serviceAreas ?? [],
    notes: document.notes,
  }),
  toDocument: (entity) => {
    const domain = omitDocumentId(entity);
    return {
      ...toAuditFields(domain),
      name: domain.name,
      displayName: domain.displayName,
      status: domain.status,
      primaryContactName: domain.primaryContactName,
      primaryContactEmail: domain.primaryContactEmail,
      primaryContactPhone: domain.primaryContactPhone,
      serviceCategories: domain.serviceCategories,
      serviceAreas: domain.serviceAreas,
      notes: domain.notes,
    };
  },
};

export const workOrderMapper: FirestoreEntityMapper<WorkOrder, WorkOrderDocument> = {
  toDomain: (id, document) => ({
    id,
    ...fromAuditFields(document),
    workOrderNumber: document.workOrderNumber,
    title: document.title,
    description: document.description,
    status: document.status,
    priority: document.priority,
    clientOrganizationId: document.clientOrganizationId,
    locationId: document.locationId,
    requestedByUserId: document.requestedByUserId,
    assignedCoordinatorUserId: document.assignedCoordinatorUserId,
    assignedManagerUserId: document.assignedManagerUserId,
    assignedContractorOrganizationId: document.assignedContractorOrganizationId,
    currentQuoteId: document.currentQuoteId,
    currentInvoiceId: document.currentInvoiceId,
    clientSnapshot: document.clientSnapshot,
    locationSnapshot: document.locationSnapshot,
    contractorSnapshot: document.contractorSnapshot,
    category: document.category,
    requestedServiceDate: toNullableIsoDateTime(
      document.requestedServiceDate,
      "requestedServiceDate",
    ),
    submittedAt: toNullableIsoDateTime(document.submittedAt, "submittedAt"),
    approvedAt: toNullableIsoDateTime(document.approvedAt, "approvedAt"),
    completedAt: toNullableIsoDateTime(document.completedAt, "completedAt"),
    closedAt: toNullableIsoDateTime(document.closedAt, "closedAt"),
  }),
  toDocument: (entity) => {
    const domain = omitDocumentId(entity);
    return {
      ...toAuditFields(domain),
      workOrderNumber: domain.workOrderNumber,
      title: domain.title,
      description: domain.description,
      status: domain.status,
      priority: domain.priority,
      clientOrganizationId: domain.clientOrganizationId,
      locationId: domain.locationId,
      requestedByUserId: domain.requestedByUserId,
      assignedCoordinatorUserId: domain.assignedCoordinatorUserId,
      assignedManagerUserId: domain.assignedManagerUserId,
      assignedContractorOrganizationId: domain.assignedContractorOrganizationId,
      currentQuoteId: domain.currentQuoteId,
      currentInvoiceId: domain.currentInvoiceId,
      clientSnapshot: domain.clientSnapshot,
      locationSnapshot: domain.locationSnapshot,
      contractorSnapshot: domain.contractorSnapshot,
      category: domain.category,
      requestedServiceDate: toNullableFirestoreTimestamp(
        domain.requestedServiceDate,
      ),
      submittedAt: toNullableFirestoreTimestamp(domain.submittedAt),
      approvedAt: toNullableFirestoreTimestamp(domain.approvedAt),
      completedAt: toNullableFirestoreTimestamp(domain.completedAt),
      closedAt: toNullableFirestoreTimestamp(domain.closedAt),
    };
  },
};

export const quoteMapper: FirestoreEntityMapper<Quote, QuoteDocument> = {
  toDomain: (id, document) => ({
    id,
    ...fromAuditFields(document),
    workOrderId: document.workOrderId,
    clientOrganizationId: document.clientOrganizationId,
    locationId: document.locationId,
    contractorOrganizationId: document.contractorOrganizationId,
    versionNumber: document.versionNumber,
    status: document.status,
    laborAmount: document.laborAmount,
    materialAmount: document.materialAmount,
    otherAmount: document.otherAmount,
    totalAmount: document.totalAmount,
    currency: document.currency,
    scopeSummary: document.scopeSummary,
    contractorNotes: document.contractorNotes,
    internalReviewNotes: document.internalReviewNotes,
    clientResponseNotes: document.clientResponseNotes,
    submittedByUserId: document.submittedByUserId,
    submittedAt: toNullableIsoDateTime(document.submittedAt, "submittedAt"),
    reviewedAt: toNullableIsoDateTime(document.reviewedAt, "reviewedAt"),
    clientDecisionAt: toNullableIsoDateTime(
      document.clientDecisionAt,
      "clientDecisionAt",
    ),
    workOrderSnapshot: document.workOrderSnapshot,
    contractorSnapshot: document.contractorSnapshot,
  }),
  toDocument: (entity) => {
    const domain = omitDocumentId(entity);
    return {
      ...toAuditFields(domain),
      workOrderId: domain.workOrderId,
      clientOrganizationId: domain.clientOrganizationId ?? "",
      locationId: domain.locationId ?? "",
      contractorOrganizationId: domain.contractorOrganizationId,
      versionNumber: domain.versionNumber,
      status: domain.status,
      laborAmount: domain.laborAmount,
      materialAmount: domain.materialAmount,
      otherAmount: domain.otherAmount,
      totalAmount: domain.totalAmount,
      currency: domain.currency,
      scopeSummary: domain.scopeSummary,
      contractorNotes: domain.contractorNotes,
      internalReviewNotes: domain.internalReviewNotes,
      clientResponseNotes: domain.clientResponseNotes,
      submittedByUserId: domain.submittedByUserId,
      submittedAt: toNullableFirestoreTimestamp(domain.submittedAt),
      reviewedAt: toNullableFirestoreTimestamp(domain.reviewedAt),
      clientDecisionAt: toNullableFirestoreTimestamp(domain.clientDecisionAt),
      workOrderSnapshot: domain.workOrderSnapshot,
      contractorSnapshot: domain.contractorSnapshot,
    };
  },
};

export const invoiceMapper: FirestoreEntityMapper<Invoice, InvoiceDocument> = {
  toDomain: (id, document) => ({
    id,
    ...fromAuditFields(document),
    workOrderId: document.workOrderId,
    clientOrganizationId: document.clientOrganizationId,
    locationId: document.locationId,
    invoiceNumber: document.invoiceNumber,
    lineItems: document.lineItems,
    subtotal: document.subtotal,
    taxAmount: document.taxAmount,
    totalAmount: document.totalAmount,
    currency: document.currency,
    status: document.status,
    issuedDate: toNullableIsoDateTime(document.issuedDate, "issuedDate"),
    dueDate: toIsoDateTime(document.dueDate, "dueDate"),
    sentAt: toNullableIsoDateTime(document.sentAt, "sentAt"),
    viewedAt: toNullableIsoDateTime(document.viewedAt, "viewedAt"),
    paidAt: toNullableIsoDateTime(document.paidAt, "paidAt"),
    voidedAt: toNullableIsoDateTime(document.voidedAt, "voidedAt"),
    paymentReference: document.paymentReference,
    notes: document.notes,
    qboInvoiceId: document.qboInvoiceId,
    qboSyncStatus: document.qboSyncStatus,
    workOrderSnapshot: document.workOrderSnapshot,
    clientSnapshot: document.clientSnapshot,
    locationSnapshot: document.locationSnapshot,
  }),
  toDocument: (entity) => {
    const domain = omitDocumentId(entity);
    return {
      ...toAuditFields(domain),
      workOrderId: domain.workOrderId,
      clientOrganizationId: domain.clientOrganizationId,
      locationId: domain.locationId,
      invoiceNumber: domain.invoiceNumber,
      lineItems: domain.lineItems,
      subtotal: domain.subtotal ?? 0,
      taxAmount: domain.taxAmount,
      totalAmount: domain.totalAmount,
      currency: domain.currency,
      status: domain.status,
      issuedDate: toNullableFirestoreTimestamp(domain.issuedDate),
      dueDate: toFirestoreTimestamp(domain.dueDate),
      sentAt: toNullableFirestoreTimestamp(domain.sentAt),
      viewedAt: toNullableFirestoreTimestamp(domain.viewedAt),
      paidAt: toNullableFirestoreTimestamp(domain.paidAt),
      voidedAt: toNullableFirestoreTimestamp(domain.voidedAt),
      paymentReference: domain.paymentReference,
      notes: domain.notes,
      qboInvoiceId: domain.qboInvoiceId,
      qboSyncStatus: domain.qboSyncStatus,
      workOrderSnapshot: domain.workOrderSnapshot,
      clientSnapshot: domain.clientSnapshot,
      locationSnapshot: domain.locationSnapshot,
    };
  },
};

export const contractorQuoteMapper: FirestoreEntityMapper<
  ContractorQuote,
  ContractorQuoteDocument
> = {
  toDomain: (id, document) => ({
    id,
    ...fromAuditFields(document),
    workOrderId: document.workOrderId,
    contractorUserId: document.contractorUserId,
    contractorOrganizationId: document.contractorOrganizationId,
    clientOrganizationId: document.clientOrganizationId,
    locationId: document.locationId,
    lineItems: document.lineItems,
    subtotal: document.subtotal,
    taxAmount: document.taxAmount,
    totalAmount: document.totalAmount,
    notes: document.notes,
    status: document.status,
    submittedAt: toNullableIsoDateTime(document.submittedAt, "submittedAt"),
    reviewedAt: toNullableIsoDateTime(document.reviewedAt, "reviewedAt"),
    reviewedByUserId: document.reviewedByUserId,
    rejectionReason: document.rejectionReason,
    workOrderSnapshot: document.workOrderSnapshot,
    contractorSnapshot: document.contractorSnapshot,
  }),
  toDocument: (entity) => {
    const domain = omitDocumentId(entity);
    return {
      ...toAuditFields(domain),
      workOrderId: domain.workOrderId,
      contractorUserId: domain.contractorUserId,
      contractorOrganizationId: domain.contractorOrganizationId,
      clientOrganizationId: domain.clientOrganizationId,
      locationId: domain.locationId,
      lineItems: domain.lineItems,
      subtotal: domain.subtotal ?? 0,
      taxAmount: domain.taxAmount,
      totalAmount: domain.totalAmount,
      notes: domain.notes,
      status: domain.status,
      submittedAt: toNullableFirestoreTimestamp(domain.submittedAt),
      reviewedAt: toNullableFirestoreTimestamp(domain.reviewedAt),
      reviewedByUserId: domain.reviewedByUserId,
      rejectionReason: domain.rejectionReason,
      workOrderSnapshot: domain.workOrderSnapshot,
      contractorSnapshot: domain.contractorSnapshot,
    };
  },
};

export const clientQuoteMapper: FirestoreEntityMapper<
  ClientQuote,
  ClientQuoteDocument
> = {
  toDomain: (id, document) => ({
    id,
    ...fromAuditFields(document),
    workOrderId: document.workOrderId,
    sourceContractorQuoteId: document.sourceContractorQuoteId,
    clientOrganizationId: document.clientOrganizationId,
    locationId: document.locationId,
    lineItems: document.lineItems,
    subtotal: document.subtotal,
    taxAmount: document.taxAmount,
    totalAmount: document.totalAmount,
    notes: document.notes,
    status: document.status,
    sentAt: toNullableIsoDateTime(document.sentAt, "sentAt"),
    respondedAt: toNullableIsoDateTime(document.respondedAt, "respondedAt"),
    approvedAt: toNullableIsoDateTime(document.approvedAt, "approvedAt"),
    rejectedAt: toNullableIsoDateTime(document.rejectedAt, "rejectedAt"),
    rejectionReason: document.rejectionReason,
    createdByUserId: document.createdByUserId,
    workOrderSnapshot: document.workOrderSnapshot,
  }),
  toDocument: (entity) => {
    const domain = omitDocumentId(entity);
    return {
      ...toAuditFields(domain),
      workOrderId: domain.workOrderId,
      sourceContractorQuoteId: domain.sourceContractorQuoteId,
      clientOrganizationId: domain.clientOrganizationId,
      locationId: domain.locationId,
      lineItems: domain.lineItems,
      subtotal: domain.subtotal,
      taxAmount: domain.taxAmount,
      totalAmount: domain.totalAmount,
      notes: domain.notes,
      status: domain.status,
      sentAt: toNullableFirestoreTimestamp(domain.sentAt),
      respondedAt: toNullableFirestoreTimestamp(domain.respondedAt),
      approvedAt: toNullableFirestoreTimestamp(domain.approvedAt),
      rejectedAt: toNullableFirestoreTimestamp(domain.rejectedAt),
      rejectionReason: domain.rejectionReason,
      createdByUserId: domain.createdByUserId,
      workOrderSnapshot: domain.workOrderSnapshot,
    };
  },
};

export const assignmentMapper: FirestoreEntityMapper<
  Assignment,
  AssignmentDocument
> = {
  toDomain: (id, document) => ({
    id,
    ...fromAuditFields(document),
    workOrderId: document.workOrderId,
    contractorOrganizationId: document.contractorOrganizationId,
    assigneeType: document.assigneeType,
    assigneeUserId: document.assigneeUserId,
    assigneeOrganizationId: document.assigneeOrganizationId,
    assignedByUserId: document.assignedByUserId,
    status: document.status,
    scheduledDate: toNullableIsoDateTime(document.scheduledDate, "scheduledDate"),
    timeWindowStart: toNullableIsoDateTime(
      document.timeWindowStart,
      "timeWindowStart",
    ),
    timeWindowEnd: toNullableIsoDateTime(document.timeWindowEnd, "timeWindowEnd"),
    assignedAt: toIsoDateTime(document.assignedAt, "assignedAt"),
    acceptedAt: toNullableIsoDateTime(document.acceptedAt, "acceptedAt"),
    declinedAt: toNullableIsoDateTime(document.declinedAt, "declinedAt"),
    completedAt: toNullableIsoDateTime(document.completedAt, "completedAt"),
    notes: document.notes,
    workOrderSnapshot: document.workOrderSnapshot,
    contractorSnapshot: document.contractorSnapshot,
  }),
  toDocument: (entity) => {
    const domain = omitDocumentId(entity);
    return {
      ...toAuditFields(domain),
      workOrderId: domain.workOrderId,
      contractorOrganizationId: domain.contractorOrganizationId,
      assigneeType: domain.assigneeType,
      assigneeUserId: domain.assigneeUserId,
      assigneeOrganizationId: domain.assigneeOrganizationId,
      assignedByUserId: domain.assignedByUserId,
      status: domain.status,
      scheduledDate: toNullableFirestoreTimestamp(domain.scheduledDate),
      timeWindowStart: toNullableFirestoreTimestamp(domain.timeWindowStart),
      timeWindowEnd: toNullableFirestoreTimestamp(domain.timeWindowEnd),
      assignedAt: toFirestoreTimestamp(domain.assignedAt),
      acceptedAt: toNullableFirestoreTimestamp(domain.acceptedAt),
      declinedAt: toNullableFirestoreTimestamp(domain.declinedAt),
      completedAt: toNullableFirestoreTimestamp(domain.completedAt),
      notes: domain.notes,
      workOrderSnapshot: domain.workOrderSnapshot,
      contractorSnapshot: domain.contractorSnapshot,
    };
  },
};

export const activityLogMapper: FirestoreEntityMapper<
  ActivityLog,
  ActivityLogDocument
> = {
  toDomain: (id, document) => ({
    id,
    ...fromAuditFields(document),
    workOrderId: document.workOrderId,
    action: document.action,
    eventType: document.eventType,
    message: document.message,
    actorType: document.actorType,
    actorUserId: document.actorUserId,
    actorRole: document.actorRole,
    actor: document.actor,
    resourceType: document.resourceType,
    resourceId: document.resourceId,
    resourceLabel: document.resourceLabel,
    resource: document.resource,
    entityType: document.entityType,
    entityId: document.entityId,
    occurredAt: toIsoDateTime(document.occurredAt, "occurredAt"),
    requestId: document.requestId,
    visibility: document.visibility,
    changes: document.changes,
    metadata: document.metadata,
  }),
  toDocument: (entity) => {
    const domain = omitDocumentId(entity);
    return {
      ...toAuditFields(domain),
      workOrderId: domain.workOrderId,
      action: domain.action,
      eventType: domain.eventType,
      message: domain.message,
      actorType: domain.actorType,
      actorUserId: domain.actorUserId,
      actorRole: domain.actorRole,
      actor: domain.actor,
      resourceType: domain.resourceType,
      resourceId: domain.resourceId,
      resourceLabel: domain.resourceLabel,
      resource: domain.resource,
      entityType: domain.entityType,
      entityId: domain.entityId,
      occurredAt: toFirestoreTimestamp(domain.occurredAt),
      requestId: domain.requestId,
      visibility: domain.visibility,
      changes: domain.changes,
      metadata: domain.metadata,
    };
  },
};

export const internalNotificationMapper: FirestoreEntityMapper<
  InternalNotification,
  InternalNotificationDocument
> = {
  toDomain: (id, document) => ({
    id,
    ...fromAuditFields(document),
    recipientUserId: document.recipientUserId,
    recipientRole: document.recipientRole,
    eventType: document.eventType,
    title: document.title,
    message: document.message,
    severity: document.severity,
    status: document.status,
    actor: document.actor,
    entityType: document.entityType,
    entityId: document.entityId,
    workOrderId: document.workOrderId,
    invoiceId: document.invoiceId,
    quoteId: document.quoteId,
    assignmentId: document.assignmentId,
    targetPath: document.targetPath,
    readAt: toNullableIsoDateTime(document.readAt, "readAt"),
    acknowledgedAt: toNullableIsoDateTime(
      document.acknowledgedAt,
      "acknowledgedAt",
    ),
    resolvedAt: toNullableIsoDateTime(document.resolvedAt, "resolvedAt"),
    dueAt: toNullableIsoDateTime(document.dueAt, "dueAt"),
    metadata: document.metadata,
  }),
  toDocument: (entity) => {
    const domain = omitDocumentId(entity);
    return {
      ...toAuditFields(domain),
      recipientUserId: domain.recipientUserId,
      recipientRole: domain.recipientRole,
      eventType: domain.eventType,
      title: domain.title,
      message: domain.message,
      severity: domain.severity,
      status: domain.status,
      actor: domain.actor,
      entityType: domain.entityType,
      entityId: domain.entityId,
      workOrderId: domain.workOrderId,
      invoiceId: domain.invoiceId,
      quoteId: domain.quoteId,
      assignmentId: domain.assignmentId,
      targetPath: domain.targetPath,
      readAt: toNullableFirestoreTimestamp(domain.readAt),
      acknowledgedAt: toNullableFirestoreTimestamp(domain.acknowledgedAt),
      resolvedAt: toNullableFirestoreTimestamp(domain.resolvedAt),
      dueAt: toNullableFirestoreTimestamp(domain.dueAt),
      metadata: domain.metadata,
    };
  },
};

function omitDocumentId<TDomain extends { id: EntityId }>(
  domain: TDomain,
): Omit<TDomain, "id"> {
  const { id, ...document } = domain;
  void id;
  return document;
}

function fromAuditFields(document: FirestoreAuditFields): DomainAuditFields {
  return {
    organizationId: document.organizationId,
    recordStatus: document.recordStatus,
    isDeleted: document.isDeleted,
    createdAt: toIsoDateTime(document.createdAt, "createdAt"),
    updatedAt: toIsoDateTime(document.updatedAt, "updatedAt"),
    createdByUserId: document.createdByUserId,
    updatedByUserId: document.updatedByUserId,
    deletedAt: toNullableIsoDateTime(document.deletedAt, "deletedAt"),
    deletedByUserId: document.deletedByUserId ?? null,
  };
}

function toAuditFields(domain: DomainAuditFields): FirestoreAuditFields {
  return {
    organizationId: domain.organizationId,
    recordStatus: domain.recordStatus,
    isDeleted: domain.isDeleted,
    createdAt: toFirestoreTimestamp(domain.createdAt),
    updatedAt: toFirestoreTimestamp(domain.updatedAt),
    createdByUserId: domain.createdByUserId,
    updatedByUserId: domain.updatedByUserId,
    deletedAt: toNullableFirestoreTimestamp(domain.deletedAt),
    deletedByUserId: domain.deletedByUserId ?? null,
  };
}
