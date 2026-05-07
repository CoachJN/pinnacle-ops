import type { Contact, ContactSummary } from "@/types/contact";

export interface ContactListResponse {
  contacts: ContactSummary[];
}

export interface ContactDetailResponse {
  contact: Contact;
}

export interface ContactApiErrorResponse {
  error?: {
    message?: string;
  };
}

export interface ContactFormValues {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  primaryPhone: string;
  secondaryPhone: string;
  roleTitle: string;
  preferredLanguage: Contact["preferredLanguage"];
  preferredContactMethod: "" | NonNullable<Contact["preferredContactMethod"]>;
  notes: string;
  status: Contact["status"];
}

export interface ContactFormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  primaryPhone?: string;
}
