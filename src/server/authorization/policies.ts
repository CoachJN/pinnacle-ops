import "server-only";

import {
  activityLogPolicy,
  assignmentPolicy,
  billingDataPolicy,
  clientOrganizationPolicy,
  clientQuotePolicy,
  contractorOrganizationPolicy,
  contractorQuotePolicy,
  dashboardPolicy,
  internalNotePolicy,
  invoicePolicy,
  locationPolicy,
  paymentStatusPolicy,
  workOrderPolicy,
} from "@/lib/access-policy";

export const quotePolicy = {
  client: clientQuotePolicy,
  contractor: contractorQuotePolicy,
} as const;

export const clientLocationVisibilityPolicy = {
  client: clientOrganizationPolicy,
  location: locationPolicy,
} as const;

export const contractorVisibilityPolicy = contractorOrganizationPolicy;

export {
  activityLogPolicy,
  assignmentPolicy,
  billingDataPolicy,
  clientOrganizationPolicy,
  clientQuotePolicy,
  contractorOrganizationPolicy,
  contractorQuotePolicy,
  dashboardPolicy,
  internalNotePolicy,
  invoicePolicy,
  locationPolicy,
  paymentStatusPolicy,
  workOrderPolicy,
};
