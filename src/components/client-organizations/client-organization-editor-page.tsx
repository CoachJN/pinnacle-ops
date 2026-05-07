"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { ActionFeedback } from "@/components/shared/action-feedback";
import { ContactLinkManager } from "@/components/shared/contact-link-manager";
import type {
  ClientOrganizationDetail,
  ClientOrganizationFormErrors,
  ClientOrganizationFormValues,
} from "@/components/client-organizations/types";
import type { ContactLinkInput, ContactSummary } from "@/types/contact";
import type { ContactRoleSlotAssignment } from "@/lib/contact-linking";

interface ClientOrganizationEditorPageProps {
  mode: "create" | "edit";
  clientOrganizationId?: string;
}

interface ClientOrganizationResponse {
  clientOrganization: ClientOrganizationDetail;
}

interface ContactsResponse {
  contacts: ContactSummary[];
}

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

const EMPTY_FORM: ClientOrganizationFormValues = {
  name: "",
  displayName: "",
  primaryContactId: "",
  billingContactId: "",
  linkedContacts: [],
  notes: "",
  isActive: true,
};

export function ClientOrganizationEditorPage({
  mode,
  clientOrganizationId,
}: ClientOrganizationEditorPageProps) {
  const router = useRouter();
  const [formValues, setFormValues] =
    useState<ClientOrganizationFormValues>(EMPTY_FORM);
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [errors, setErrors] = useState<ClientOrganizationFormErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(mode === "edit");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadDependencies() {
      setIsLoading(mode === "edit");
      setErrorMessage(null);

      try {
        const requests: Promise<Response>[] = [
          fetch("/api/contacts", { cache: "no-store" }),
        ];

        if (mode === "edit" && clientOrganizationId) {
          requests.push(
            fetch(`/api/client-organizations/${clientOrganizationId}`, {
              cache: "no-store",
            }),
          );
        }

        const responses = await Promise.all(requests);
        const contactsPayload = (await responses[0].json()) as
          | ContactsResponse
          | ApiErrorResponse;

        if (!responses[0]?.ok) {
          throw new Error(
            (contactsPayload as ApiErrorResponse).error?.message ??
              "Unable to load contacts.",
          );
        }

        if (!isCancelled) {
          setContacts((contactsPayload as ContactsResponse).contacts);
        }

        if (mode === "edit" && responses[1]) {
          const organizationPayload = (await responses[1].json()) as
            | ClientOrganizationResponse
            | ApiErrorResponse;

          if (!responses[1].ok) {
            throw new Error(
              (organizationPayload as ApiErrorResponse).error?.message ??
                "Unable to load client organization.",
            );
          }

          if (!isCancelled) {
            setFormValues(
              mapOrganizationToFormValues(
                (organizationPayload as ClientOrganizationResponse)
                  .clientOrganization,
              ),
            );
          }
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load client organization editor.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDependencies();

    return () => {
      isCancelled = true;
    };
  }, [clientOrganizationId, mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateForm(formValues);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        mode === "create"
          ? "/api/client-organizations"
          : `/api/client-organizations/${clientOrganizationId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(toApiPayload(formValues)),
        },
      );

      const payload = (await response.json()) as
        | ClientOrganizationResponse
        | ApiErrorResponse;

      if (!response.ok) {
        throw new Error(
          (payload as ApiErrorResponse).error?.message ??
            `Unable to ${mode === "create" ? "create" : "save"} client organization.`,
        );
      }

      const successPayload = payload as ClientOrganizationResponse;
      startTransition(() => {
        router.push(
          `/client-organizations/${successPayload.clientOrganization.id}`,
        );
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : `Unable to ${mode === "create" ? "create" : "save"} client organization.`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section className="space-y-4">
        <div className="h-32 animate-pulse rounded-3xl bg-neutral-100" />
        <div className="h-80 animate-pulse rounded-3xl bg-neutral-100" />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <Link
        className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
        href={
          mode === "edit" && clientOrganizationId
            ? `/client-organizations/${clientOrganizationId}`
            : "/client-organizations"
        }
      >
        {mode === "edit" ? "Back to client organization" : "Back to client organizations"}
      </Link>

      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Client Organizations
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
          {mode === "create" ? "Create client" : "Edit client"}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
          Attach normalized contacts for primary and billing ownership using
          canonical contact references only.
        </p>
      </section>

      {errorMessage ? <ActionFeedback message={errorMessage} /> : null}

      <form
        className="space-y-6 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            error={errors.name}
            label="Legal name"
            name="name"
            onChange={(value) => updateField(setFormValues, "name", value)}
            required
            value={formValues.name}
          />
          <TextField
            label="Display name"
            name="displayName"
            onChange={(value) =>
              updateField(setFormValues, "displayName", value)
            }
            value={formValues.displayName}
          />
        </div>

        <ContactLinkManager
          contacts={contacts}
          description="Assign client role slots and manage additional linked contacts without leaving this workflow."
          linkedContacts={formValues.linkedContacts}
          onLinkedContactsChange={(linkedContacts) =>
            setFormValues((current) => ({ ...current, linkedContacts }))
          }
          onRoleSlotsChange={(roleSlots) =>
            setFormValues((current) => ({
              ...current,
              ...mapClientRoleSlotsToFormValues(roleSlots),
            }))
          }
          roleSlots={toClientRoleSlots(formValues)}
          title="Linked contacts"
        />

        <div className="grid gap-5 md:grid-cols-2">
          <label className="text-sm font-medium text-neutral-700">
            Status
            <select
              className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
              name="status"
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  isActive: event.target.value === "active",
                }))
              }
              value={formValues.isActive ? "active" : "inactive"}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>

        <label className="block text-sm font-medium text-neutral-700">
          Notes
          <textarea
            className="mt-1 min-h-32 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
            name="notes"
            onChange={(event) =>
              updateField(setFormValues, "notes", event.target.value)
            }
            value={formValues.notes}
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            className="inline-flex items-center justify-center rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
            disabled={isSaving}
            type="submit"
          >
            {isSaving
              ? mode === "create"
                ? "Creating..."
                : "Saving..."
              : mode === "create"
                ? "Create client"
                : "Save client"}
          </button>
          <Link
            className="inline-flex items-center justify-center rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950"
            href={
              mode === "edit" && clientOrganizationId
                ? `/client-organizations/${clientOrganizationId}`
                : "/client-organizations"
            }
          >
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}

function TextField({
  error,
  label,
  name,
  onChange,
  required = false,
  type = "text",
  value,
}: {
  error?: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="text-sm font-medium text-neutral-700">
      {label}
      {required ? <span className="text-rose-700"> *</span> : null}
      <input
        className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
        name={name}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
      {error ? <span className="mt-1 block text-xs text-rose-700">{error}</span> : null}
    </label>
  );
}

function updateField<Key extends keyof ClientOrganizationFormValues>(
  setFormValues: Dispatch<SetStateAction<ClientOrganizationFormValues>>,
  key: Key,
  value: ClientOrganizationFormValues[Key],
) {
  setFormValues((current) => ({ ...current, [key]: value }));
}

function mapOrganizationToFormValues(
  organization: ClientOrganizationDetail,
): ClientOrganizationFormValues {
  return {
    name: organization.name,
    displayName: organization.displayName ?? "",
    primaryContactId: organization.primaryContactId ?? "",
    billingContactId: organization.billingContactId ?? "",
    linkedContacts:
      organization.linkedContacts?.map((link) => ({
        contactId: link.contactId,
        relationshipType: link.relationshipType,
        notes: link.notes ?? null,
      })) ?? [],
    notes: organization.notes ?? "",
    isActive: organization.status === "active",
  };
}

function toApiPayload(values: ClientOrganizationFormValues) {
  return {
    name: values.name.trim(),
    displayName: normalizeOptionalString(values.displayName),
    status: values.isActive ? "active" : "inactive",
    primaryContactId: normalizeOptionalString(values.primaryContactId),
    billingContactId: normalizeOptionalString(values.billingContactId),
    linkedContacts: values.linkedContacts,
    notes: normalizeOptionalString(values.notes),
  };
}

function normalizeOptionalString(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function validateForm(values: ClientOrganizationFormValues): ClientOrganizationFormErrors {
  const errors: ClientOrganizationFormErrors = {};

  if (!values.name.trim()) {
    errors.name = "Legal name is required.";
  }

  return errors;
}

function toClientRoleSlots(
  values: Pick<
    ClientOrganizationFormValues,
    "primaryContactId" | "billingContactId"
  >,
): ContactRoleSlotAssignment<"primaryContactId" | "billingContactId">[] {
  return [
    {
      key: "primaryContactId",
      label: "Primary",
      relationshipType: "primary",
      contactId: normalizeOptionalString(values.primaryContactId),
      isPrimary: true,
    },
    {
      key: "billingContactId",
      label: "Billing",
      relationshipType: "billing",
      contactId: normalizeOptionalString(values.billingContactId),
    },
  ];
}

function mapClientRoleSlotsToFormValues(
  roleSlots: ContactRoleSlotAssignment<"primaryContactId" | "billingContactId">[],
): Pick<ClientOrganizationFormValues, "primaryContactId" | "billingContactId"> {
  return {
    primaryContactId:
      roleSlots.find((slot) => slot.key === "primaryContactId")?.contactId ?? "",
    billingContactId:
      roleSlots.find((slot) => slot.key === "billingContactId")?.contactId ?? "",
  };
}
