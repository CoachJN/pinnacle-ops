import type { Contact, ContactSummary } from "@/types/contact";
import type { ContactFormErrors, ContactFormValues } from "@/components/contacts/types";

export const EMPTY_CONTACT_FORM: ContactFormValues = {
  firstName: "",
  lastName: "",
  displayName: "",
  email: "",
  primaryPhone: "",
  secondaryPhone: "",
  roleTitle: "",
  preferredLanguage: "unknown",
  preferredContactMethod: "",
  notes: "",
  status: "active",
};

export function mapContactToFormValues(contact: Contact): ContactFormValues {
  const derivedDisplayName = `${contact.firstName} ${contact.lastName}`.trim();

  return {
    firstName: contact.firstName,
    lastName: contact.lastName,
    displayName:
      contact.displayName === derivedDisplayName ? "" : contact.displayName,
    email: contact.email ?? "",
    primaryPhone: contact.primaryPhone ?? "",
    secondaryPhone: contact.secondaryPhone ?? "",
    roleTitle: contact.roleTitle ?? "",
    preferredLanguage: contact.preferredLanguage,
    preferredContactMethod: contact.preferredContactMethod ?? "",
    notes: contact.notes ?? "",
    status: contact.status,
  };
}

export function validateContactFormValues(
  values: ContactFormValues,
): ContactFormErrors {
  const errors: ContactFormErrors = {};

  if (!values.firstName.trim()) {
    errors.firstName = "First name is required.";
  }

  if (!values.lastName.trim()) {
    errors.lastName = "Last name is required.";
  }

  if (values.email.trim()) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(values.email.trim())) {
      errors.email = "Enter a valid email address.";
    }
  }

  return errors;
}

export function toContactPayload(values: ContactFormValues) {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    displayName: values.displayName.trim() || null,
    email: values.email.trim() || null,
    primaryPhone: values.primaryPhone.trim() || null,
    secondaryPhone: values.secondaryPhone.trim() || null,
    roleTitle: values.roleTitle.trim() || null,
    preferredLanguage: values.preferredLanguage,
    preferredContactMethod: values.preferredContactMethod || null,
    notes: values.notes.trim() || null,
    status: values.status,
  };
}

export function filterContacts(
  contacts: ContactSummary[],
  input: {
    search: string;
    status: "" | ContactSummary["status"];
  },
): ContactSummary[] {
  const normalizedSearch = input.search.trim().toLowerCase();

  return contacts.filter((contact) => {
    if (input.status && contact.status !== input.status) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return [
      contact.displayName,
      contact.email,
      contact.primaryPhone,
      contact.roleTitle,
      contact.preferredLanguage,
      contact.status,
    ]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(normalizedSearch));
  });
}

export function formatContactDate(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
  }).format(new Date(value));
}
