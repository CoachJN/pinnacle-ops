import "server-only";

import {
  AUTHORITY_CATEGORIES,
  PERMISSION_ENTITIES,
  USER_ROLES,
  type AuthorityCategory,
  type PermissionEntity,
  type UserRole,
} from "@/types/permissions";

export const APPLICATION_ROLES = [
  USER_ROLES.Coordinator,
  USER_ROLES.Manager,
  USER_ROLES.FinanceAdmin,
  USER_ROLES.Owner,
  USER_ROLES.ClientUser,
  USER_ROLES.ContractorUser,
] as const satisfies readonly UserRole[];

export type ApplicationRole = (typeof APPLICATION_ROLES)[number];

export const AUTHORIZATION_RESOURCES = {
  WorkOrders: PERMISSION_ENTITIES.WorkOrders,
  Clients: PERMISSION_ENTITIES.ClientOrganizations,
  Locations: PERMISSION_ENTITIES.Locations,
  Contractors: PERMISSION_ENTITIES.Contractors,
  ContractorQuotes: PERMISSION_ENTITIES.ContractorQuotes,
  ClientQuotes: PERMISSION_ENTITIES.ClientQuotes,
  ContractorInvoices: PERMISSION_ENTITIES.ContractorInvoices,
  ClientInvoices: PERMISSION_ENTITIES.ClientInvoices,
  Invoices: PERMISSION_ENTITIES.Invoices,
  Assignments: PERMISSION_ENTITIES.Assignments,
  ActivityLogs: PERMISSION_ENTITIES.ActivityLogs,
  DashboardAccess: PERMISSION_ENTITIES.DashboardAccess,
  InternalNotes: PERMISSION_ENTITIES.InternalNotes,
  PaymentStatus: PERMISSION_ENTITIES.PaymentStatus,
  BillingData: PERMISSION_ENTITIES.BillingData,
  ProfitabilityData: PERMISSION_ENTITIES.ProfitabilityData,
} as const satisfies Record<string, PermissionEntity>;

export type AuthorizationResource =
  (typeof AUTHORIZATION_RESOURCES)[keyof typeof AUTHORIZATION_RESOURCES];

export const RESOURCE_ACTIONS = {
  WorkOrders: {
    View: AUTHORITY_CATEGORIES.View,
    Create: AUTHORITY_CATEGORIES.Create,
    Edit: AUTHORITY_CATEGORIES.Edit,
    Approve: AUTHORITY_CATEGORIES.Approve,
    Transition: AUTHORITY_CATEGORIES.Transition,
  },
  Clients: {
    View: AUTHORITY_CATEGORIES.View,
    Create: AUTHORITY_CATEGORIES.Create,
    Edit: AUTHORITY_CATEGORIES.Edit,
    Approve: AUTHORITY_CATEGORIES.Approve,
    Transition: AUTHORITY_CATEGORIES.Transition,
  },
  Locations: {
    View: AUTHORITY_CATEGORIES.View,
    Create: AUTHORITY_CATEGORIES.Create,
    Edit: AUTHORITY_CATEGORIES.Edit,
    Approve: AUTHORITY_CATEGORIES.Approve,
    Transition: AUTHORITY_CATEGORIES.Transition,
  },
  Contractors: {
    View: AUTHORITY_CATEGORIES.View,
    Create: AUTHORITY_CATEGORIES.Create,
    Edit: AUTHORITY_CATEGORIES.Edit,
    Approve: AUTHORITY_CATEGORIES.Approve,
    Transition: AUTHORITY_CATEGORIES.Transition,
  },
  Quotes: {
    View: AUTHORITY_CATEGORIES.View,
    Create: AUTHORITY_CATEGORIES.Create,
    Edit: AUTHORITY_CATEGORIES.Edit,
    Submit: "submit",
    Approve: AUTHORITY_CATEGORIES.Approve,
    Reject: "reject",
    Revise: "revise",
    Reopen: "reopen",
    Transition: AUTHORITY_CATEGORIES.Transition,
  },
  Invoices: {
    View: AUTHORITY_CATEGORIES.View,
    Create: AUTHORITY_CATEGORIES.Create,
    Edit: AUTHORITY_CATEGORIES.Edit,
    IssueSend: "issue_send",
    MarkPaid: "mark_paid",
    MarkOverdue: "mark_overdue",
    Dispute: "dispute",
    Resolve: "resolve",
    Reopen: "reopen",
    Transition: AUTHORITY_CATEGORIES.Transition,
  },
  Assignments: {
    View: AUTHORITY_CATEGORIES.View,
    Create: AUTHORITY_CATEGORIES.Create,
    Edit: AUTHORITY_CATEGORIES.Edit,
    Approve: AUTHORITY_CATEGORIES.Approve,
    Transition: AUTHORITY_CATEGORIES.Transition,
  },
  ActivityLogs: {
    View: AUTHORITY_CATEGORIES.View,
  },
  DashboardAccess: {
    View: AUTHORITY_CATEGORIES.View,
  },
} as const;

export type ResourceAuthorityAction = AuthorityCategory;
export type ResourceWorkflowAction =
  | "submit"
  | "reject"
  | "revise"
  | "reopen"
  | "issue_send"
  | "mark_paid"
  | "mark_overdue"
  | "dispute"
  | "resolve";
export type ResourceAction = ResourceAuthorityAction | ResourceWorkflowAction;
