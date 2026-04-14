"use client";

import { startTransition, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type {
  ClientPortalLocationDetail,
  ClientPortalLocationUpdateInput,
} from "@/types/location";

interface LocationEditFormProps {
  location: ClientPortalLocationDetail;
}

export function LocationEditForm({ location }: LocationEditFormProps) {
  const router = useRouter();
  const [formValues, setFormValues] = useState<ClientPortalLocationUpdateInput>({
    name: location.name,
    code: location.code ?? "",
    status: location.status,
    addressLine1: location.addressLine1 ?? "",
    addressLine2: location.addressLine2 ?? "",
    city: location.city ?? "",
    region: location.region ?? "",
    postalCode: location.postalCode ?? "",
    countryCode: location.countryCode ?? "",
    locationContactName: location.locationContactName ?? "",
    locationContactEmail: location.locationContactEmail ?? "",
    locationContactPhone: location.locationContactPhone ?? "",
    accessNotes: location.accessNotes ?? "",
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/locations/${location.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formValues),
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Unable to save location.");
      }

      startTransition(() => {
        router.push(`/portal/locations/${location.id}`);
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to save location.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {errorMessage ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <Field
          label="Location name"
          onChange={(value) => setFormValues((current) => ({ ...current, name: value }))}
          required
          value={formValues.name}
        />
        <Field
          label="Location code"
          onChange={(value) => setFormValues((current) => ({ ...current, code: value }))}
          value={formValues.code ?? ""}
        />
        <SelectField
          label="Status"
          onChange={(value) =>
            setFormValues((current) => ({
              ...current,
              status: value as ClientPortalLocationUpdateInput["status"],
            }))
          }
          options={[
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
          ]}
          value={formValues.status}
        />
        <Field
          label="Address line 1"
          onChange={(value) =>
            setFormValues((current) => ({ ...current, addressLine1: value }))
          }
          value={formValues.addressLine1 ?? ""}
        />
        <Field
          label="Address line 2"
          onChange={(value) =>
            setFormValues((current) => ({ ...current, addressLine2: value }))
          }
          value={formValues.addressLine2 ?? ""}
        />
        <Field
          label="City"
          onChange={(value) => setFormValues((current) => ({ ...current, city: value }))}
          value={formValues.city ?? ""}
        />
        <Field
          label="Province / State"
          onChange={(value) =>
            setFormValues((current) => ({ ...current, region: value }))
          }
          value={formValues.region ?? ""}
        />
        <Field
          label="Postal code"
          onChange={(value) =>
            setFormValues((current) => ({ ...current, postalCode: value }))
          }
          value={formValues.postalCode ?? ""}
        />
        <Field
          label="Country code"
          onChange={(value) =>
            setFormValues((current) => ({ ...current, countryCode: value }))
          }
          value={formValues.countryCode ?? ""}
        />
        <Field
          label="Contact name"
          onChange={(value) =>
            setFormValues((current) => ({ ...current, locationContactName: value }))
          }
          value={formValues.locationContactName ?? ""}
        />
        <Field
          label="Contact email"
          onChange={(value) =>
            setFormValues((current) => ({ ...current, locationContactEmail: value }))
          }
          type="email"
          value={formValues.locationContactEmail ?? ""}
        />
        <Field
          label="Contact phone"
          onChange={(value) =>
            setFormValues((current) => ({ ...current, locationContactPhone: value }))
          }
          value={formValues.locationContactPhone ?? ""}
        />
        <TextareaField
          className="md:col-span-2"
          label="Access instructions"
          onChange={(value) =>
            setFormValues((current) => ({ ...current, accessNotes: value }))
          }
          value={formValues.accessNotes ?? ""}
        />
      </section>

      <div className="flex items-center justify-end gap-3">
        <button
          className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? "Saving..." : "Save location"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  onChange,
  required = false,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input
        className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-emerald-500"
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
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
  options: { label: string; value: string }[];
  value: string;
}) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <select
        className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-emerald-500"
        onChange={(event) => onChange(event.target.value)}
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

function TextareaField({
  className,
  label,
  onChange,
  value,
}: {
  className?: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className={`text-sm font-medium text-slate-700 ${className ?? ""}`}>
      {label}
      <textarea
        className="mt-1 min-h-32 w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-emerald-500"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}
