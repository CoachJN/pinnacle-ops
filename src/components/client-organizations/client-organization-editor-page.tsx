"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { ActionFeedback } from "@/components/shared/action-feedback";
import type {
  ClientOrganizationDetail,
  ClientOrganizationFormErrors,
  ClientOrganizationFormValues,
} from "@/components/client-organizations/types";

interface ClientOrganizationResponse {
  clientOrganization: ClientOrganizationDetail;
}

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

const EMPTY_FORM: ClientOrganizationFormValues = {
  name: "",
  displayName: "",
  primaryContactName: "",
  primaryContactEmail: "",
  primaryContactPhone: "",
  billingEmail: "",
  notes: "",
  isActive: true,
};

export function ClientOrganizationEditorPage() {
  const router = useRouter();
  const [formValues, setFormValues] =
    useState<ClientOrganizationFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<ClientOrganizationFormErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
      const response = await fetch("/api/client-organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(toApiPayload(formValues)),
      });

      const payload = (await response.json()) as
        | ClientOrganizationResponse
        | ApiErrorResponse;

      if (!response.ok) {
        const errorPayload = payload as ApiErrorResponse;
        throw new Error(
          errorPayload.error?.message ?? "Unable to create client organization.",
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
          : "Unable to create client organization.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <Link
        className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
        href="/client-organizations"
      >
        Back to client organizations
      </Link>

      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Client Organizations
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
          Create client
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
          Add a client organization so teams can attach locations and work orders
          to the correct account.
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
          <TextField
            label="Primary contact"
            name="primaryContactName"
            onChange={(value) =>
              updateField(setFormValues, "primaryContactName", value)
            }
            value={formValues.primaryContactName}
          />
          <TextField
            error={errors.primaryContactEmail}
            label="Primary email"
            name="primaryContactEmail"
            onChange={(value) =>
              updateField(setFormValues, "primaryContactEmail", value)
            }
            type="email"
            value={formValues.primaryContactEmail}
          />
          <TextField
            label="Primary phone"
            name="primaryContactPhone"
            onChange={(value) =>
              updateField(setFormValues, "primaryContactPhone", value)
            }
            value={formValues.primaryContactPhone}
          />
          <TextField
            error={errors.billingEmail}
            label="Billing email"
            name="billingEmail"
            onChange={(value) =>
              updateField(setFormValues, "billingEmail", value)
            }
            type="email"
            value={formValues.billingEmail}
          />
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
            {isSaving ? "Creating..." : "Create client"}
          </button>
          <Link
            className="inline-flex items-center justify-center rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950"
            href="/client-organizations"
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

function updateField<TKey extends keyof ClientOrganizationFormValues>(
  setFormValues: Dispatch<SetStateAction<ClientOrganizationFormValues>>,
  field: TKey,
  value: ClientOrganizationFormValues[TKey],
) {
  setFormValues((current) => ({
    ...current,
    [field]: value,
  }));
}

function toApiPayload(formValues: ClientOrganizationFormValues) {
  return {
    name: formValues.name.trim(),
    displayName: normalizeOptionalString(formValues.displayName),
    status: formValues.isActive ? "active" : "inactive",
    primaryContactName: normalizeOptionalString(formValues.primaryContactName),
    primaryContactEmail: normalizeOptionalString(formValues.primaryContactEmail),
    primaryContactPhone: normalizeOptionalString(formValues.primaryContactPhone),
    billingEmail: normalizeOptionalString(formValues.billingEmail),
    notes: normalizeOptionalString(formValues.notes),
  };
}

function validateForm(
  formValues: ClientOrganizationFormValues,
): ClientOrganizationFormErrors {
  const errors: ClientOrganizationFormErrors = {};

  if (!formValues.name.trim()) {
    errors.name = "Legal name is required.";
  }

  if (
    formValues.primaryContactEmail.trim() &&
    !isValidEmail(formValues.primaryContactEmail)
  ) {
    errors.primaryContactEmail = "Primary email must be a valid email address.";
  }

  if (formValues.billingEmail.trim() && !isValidEmail(formValues.billingEmail)) {
    errors.billingEmail = "Billing email must be a valid email address.";
  }

  return errors;
}

function normalizeOptionalString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
