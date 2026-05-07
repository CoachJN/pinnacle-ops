import type { ContactSummary } from "@/types/contact";
import type { WorkOrderFormValues } from "./types";

interface SyncContactSelectionsInput {
  contacts: readonly ContactSummary[];
  values: WorkOrderFormValues;
}

export function syncSelectedContacts({
  contacts,
  values,
}: SyncContactSelectionsInput): WorkOrderFormValues | null {
  const requesterContact = contacts.find(
    (contact) => contact.id === values.requestedByContactId,
  );
  const siteContact = contacts.find((contact) => contact.id === values.siteContactId);

  const nextValues: WorkOrderFormValues = {
    ...values,
    requestedByContactId: requesterContact ? values.requestedByContactId : "",
    siteContactId: siteContact ? values.siteContactId : "",
    requestedByName: requesterContact
      ? requesterContact.displayName
      : values.requestedByName,
    requestedByEmail: requesterContact
      ? requesterContact.email ?? ""
      : values.requestedByEmail,
    requestedByPhone: requesterContact
      ? requesterContact.primaryPhone ?? ""
      : values.requestedByPhone,
  };

  return areFormValuesEqual(values, nextValues) ? null : nextValues;
}

function areFormValuesEqual(
  left: WorkOrderFormValues,
  right: WorkOrderFormValues,
): boolean {
  return (
    left.title === right.title &&
    left.description === right.description &&
    left.clientOrganizationId === right.clientOrganizationId &&
    left.locationId === right.locationId &&
    left.requestedByContactId === right.requestedByContactId &&
    left.siteContactId === right.siteContactId &&
    left.priority === right.priority &&
    left.category === right.category &&
    left.requestedServiceDate === right.requestedServiceDate &&
    left.requiresQuote === right.requiresQuote &&
    left.quoteRequiredThreshold === right.quoteRequiredThreshold &&
    left.requestedByName === right.requestedByName &&
    left.requestedByEmail === right.requestedByEmail &&
    left.requestedByPhone === right.requestedByPhone &&
    left.dueDate === right.dueDate
  );
}
