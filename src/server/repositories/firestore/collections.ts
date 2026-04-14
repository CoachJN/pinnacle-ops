import "server-only";

export const FIRESTORE_COLLECTIONS = {
  userProfiles: "userProfiles",
  clientOrganizations: "clientOrganizations",
  locations: "locations",
  contractorOrganizations: "contractorOrganizations",
  workOrders: "workOrders",
  quotes: "quotes",
  invoices: "invoices",
  assignments: "assignments",
  activityLogs: "activityLogs",
} as const;

export type FirestoreCollectionName =
  (typeof FIRESTORE_COLLECTIONS)[keyof typeof FIRESTORE_COLLECTIONS];

export const FIRESTORE_COLLECTION_STRATEGY = {
  userProfiles:
    "Top-level user profile documents keyed by Firebase Auth uid or an explicit app user id.",
  clientOrganizations:
    "Top-level client organization documents for reporting and organization filters.",
  locations:
    "Top-level location documents with clientOrganizationId for cross-client filtering.",
  contractorOrganizations:
    "Top-level contractor organization documents for assignment and vendor reporting.",
  workOrders:
    "Top-level work order documents. Critical workflow entities are not nested.",
  quotes:
    "Top-level quote documents keyed by workOrderId and contractorOrganizationId for queues.",
  invoices:
    "Top-level invoice documents keyed by workOrderId and clientOrganizationId for finance queues.",
  assignments:
    "Top-level assignment documents keyed by workOrderId and contractorOrganizationId.",
  activityLogs:
    "Top-level immutable activity records keyed by workOrderId for audit/reporting.",
} as const satisfies Record<keyof typeof FIRESTORE_COLLECTIONS, string>;

export const FIRESTORE_ID_CONVENTIONS = {
  explicitWhenKnown:
    "Use stable external ids when there is an upstream identity, e.g. userProfiles/{firebaseAuthUid}.",
  generatedForWorkflowRecords:
    "Use Firestore generated ids for workflow records unless a domain number is already allocated.",
  documentIdNotDuplicated:
    "Persisted document shapes do not store id fields; mappers attach the document id to domain models.",
} as const;
