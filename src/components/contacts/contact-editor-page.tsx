"use client";

import Link from "next/link";
import { startTransition, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ActionFeedback } from "@/components/shared/action-feedback";
import {
  EMPTY_CONTACT_FORM,
  mapContactToFormValues,
  toContactPayload,
  validateContactFormValues,
} from "@/components/contacts/contact-form";
import type {
  ContactApiErrorResponse,
  ContactDetailResponse,
  ContactFormErrors,
  ContactFormValues,
} from "@/components/contacts/types";
import type { Contact } from "@/types/contact";

interface ContactEditorPageProps {
  mode: "create" | "edit";
  contactId?: string;
}

export function ContactEditorPage({
  mode,
  contactId,
}: ContactEditorPageProps) {
  const router = useRouter();
  const [formValues, setFormValues] = useState<ContactFormValues>(EMPTY_CONTACT_FORM);
  const [isLoading, setIsLoading] = useState(mode === "edit");
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<ContactFormErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadedContact, setLoadedContact] = useState<Contact | null>(null);

  useEffect(() => {
    if (mode !== "edit" || !contactId) {
      return;
    }

    let isCancelled = false;

    async function loadContact() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/contacts/${contactId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as
          | ContactDetailResponse
          | ContactApiErrorResponse;

        if (!response.ok) {
          const errorPayload = payload as ContactApiErrorResponse;
          throw new Error(
            errorPayload.error?.message ?? "Unable to load contact.",
          );
        }

        if (!isCancelled) {
          const nextContact = (payload as ContactDetailResponse).contact;
          setLoadedContact(nextContact);
          setFormValues(mapContactToFormValues(nextContact));
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Unable to load contact.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadContact();

    return () => {
      isCancelled = true;
    };
  }, [contactId, mode]);

  function updateField<K extends keyof ContactFormValues>(
    field: K,
    value: ContactFormValues[K],
  ) {
    setFormValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateContactFormValues(formValues);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        mode === "create" ? "/api/contacts" : `/api/contacts/${contactId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(toContactPayload(formValues)),
        },
      );
      const payload = (await response.json()) as
        | ContactDetailResponse
        | ContactApiErrorResponse;

      if (!response.ok) {
        const errorPayload = payload as ContactApiErrorResponse;
        throw new Error(
          errorPayload.error?.message ?? "Unable to save contact.",
        );
      }

      startTransition(() => {
        router.push("/contacts");
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to save contact.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section className="space-y-4">
        <div className="h-32 animate-pulse rounded-3xl bg-neutral-100" />
        <div className="h-[42rem] animate-pulse rounded-3xl bg-neutral-100" />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <Link
        className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
        href="/contacts"
      >
        Back to contacts
      </Link>

      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Contacts
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
          {mode === "create" ? "Create contact" : "Edit contact"}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
          {mode === "create"
            ? "Create a normalized contact record that can be reused across clients, locations, contractors, and work orders."
            : "Update the shared contact record used throughout operational workflows."}
        </p>
        {loadedContact?.recordStatus === "archived" ? (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This contact record is archived. Updates remain subject to backend rules.
          </p>
        ) : null}
      </section>

      {errorMessage ? <ActionFeedback message={errorMessage} /> : null}

      <form
        className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <TextField
            error={errors.firstName}
            label="First name"
            onChange={(value) => updateField("firstName", value)}
            required
            value={formValues.firstName}
          />
          <TextField
            error={errors.lastName}
            label="Last name"
            onChange={(value) => updateField("lastName", value)}
            required
            value={formValues.lastName}
          />
          <TextField
            helperText="Leave blank to derive it from first and last name."
            label="Display name"
            onChange={(value) => updateField("displayName", value)}
            value={formValues.displayName}
          />
          <TextField
            error={errors.email}
            label="Email"
            onChange={(value) => updateField("email", value)}
            type="email"
            value={formValues.email}
          />
          <TextField
            label="Primary phone"
            onChange={(value) => updateField("primaryPhone", value)}
            value={formValues.primaryPhone}
          />
          <TextField
            label="Secondary phone"
            onChange={(value) => updateField("secondaryPhone", value)}
            value={formValues.secondaryPhone}
          />
          <TextField
            label="Role / title"
            onChange={(value) => updateField("roleTitle", value)}
            value={formValues.roleTitle}
          />
          <SelectField
            label="Preferred language"
            onChange={(value) =>
              updateField("preferredLanguage", value as Contact["preferredLanguage"])
            }
            options={[
              { label: "Unknown", value: "unknown" },
              { label: "English", value: "en" },
              { label: "French", value: "fr" },
              { label: "Other", value: "other" },
            ]}
            value={formValues.preferredLanguage}
          />
          <SelectField
            label="Preferred contact method"
            onChange={(value) =>
              updateField(
                "preferredContactMethod",
                value as ContactFormValues["preferredContactMethod"],
              )
            }
            options={[
              { label: "Not set", value: "" },
              { label: "Email", value: "email" },
              { label: "Phone", value: "phone" },
              { label: "SMS", value: "sms" },
              { label: "Other", value: "other" },
              { label: "Unknown", value: "unknown" },
            ]}
            value={formValues.preferredContactMethod}
          />
          <SelectField
            label="Status"
            onChange={(value) => updateField("status", value as Contact["status"])}
            options={[
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
              { label: "Archived", value: "archived" },
            ]}
            value={formValues.status}
          />
        </div>

        <label className="mt-6 block text-sm font-medium text-neutral-700">
          Notes
          <textarea
            className="mt-1 min-h-32 w-full rounded-2xl border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
            onChange={(event) => updateField("notes", event.target.value)}
            value={formValues.notes}
          />
        </label>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Link
            className="inline-flex items-center justify-center rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950"
            href="/contacts"
          >
            Cancel
          </Link>
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
                ? "Create contact"
                : "Save changes"}
          </button>
        </div>
      </form>
    </section>
  );
}

function TextField({
  error,
  helperText,
  label,
  onChange,
  required = false,
  type = "text",
  value,
}: {
  error?: string;
  helperText?: string;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: "email" | "text";
  value: string;
}) {
  return (
    <label className="text-sm font-medium text-neutral-700">
      {label}
      <input
        className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
      {helperText ? (
        <span className="mt-1 block text-xs text-neutral-500">{helperText}</span>
      ) : null}
      {error ? (
        <span className="mt-1 block text-xs text-rose-700">{error}</span>
      ) : null}
    </label>
  );
}

function SelectField({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="text-sm font-medium text-neutral-700">
      {label}
      <select
        className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange(event.target.value)
        }
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
