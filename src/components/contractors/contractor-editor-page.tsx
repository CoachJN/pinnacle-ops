"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ActionFeedback } from "@/components/shared/action-feedback";
import {
  CONTRACTOR_STATUS_LABELS,
  CONTRACTOR_STATUS_VALUES,
  type Contractor,
  type CreateContractorInput,
} from "@/types/contractor";
import type {
  ContractorApiErrorResponse,
  ContractorDetailResponse,
} from "@/components/contractors/types";

interface FormState {
  name: string;
  company: string;
  email: string;
  phone: string;
  status: CreateContractorInput["status"];
  serviceCategories: string;
  serviceAreas: string;
  notes: string;
}

const emptyFormState: FormState = {
  name: "",
  company: "",
  email: "",
  phone: "",
  status: "onboarding",
  serviceCategories: "",
  serviceAreas: "",
  notes: "",
};

export function ContractorEditorPage({
  mode,
  contractorId,
}: {
  mode: "create" | "edit";
  contractorId?: string;
}) {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>(emptyFormState);
  const [isLoading, setIsLoading] = useState(mode === "edit");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "edit" || !contractorId) {
      return;
    }

    let isCancelled = false;

    async function loadContractor() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/contractors/${contractorId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as
          | ContractorDetailResponse
          | ContractorApiErrorResponse;

        if (!response.ok) {
          const errorPayload = payload as ContractorApiErrorResponse;
          throw new Error(
            errorPayload.error?.message ?? "Unable to load contractor.",
          );
        }

        if (!isCancelled) {
          const contractor = (payload as ContractorDetailResponse).contractor;
          setFormState(toFormState(contractor));
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load contractor.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadContractor();

    return () => {
      isCancelled = true;
    };
  }, [contractorId, mode]);

  const title = useMemo(
    () => (mode === "create" ? "Create contractor" : "Edit contractor"),
    [mode],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const payload: CreateContractorInput = {
        name: formState.name.trim(),
        company: formState.company.trim() || null,
        email: formState.email.trim(),
        phone: formState.phone.trim(),
        status: formState.status,
        serviceCategories: splitList(formState.serviceCategories),
        serviceAreas: splitList(formState.serviceAreas),
        notes: formState.notes.trim() || null,
      };

      const response = await fetch(
        mode === "create" ? "/api/contractors" : `/api/contractors/${contractorId}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const result = (await response.json()) as
        | ContractorDetailResponse
        | ContractorApiErrorResponse;

      if (!response.ok) {
        const errorResult = result as ContractorApiErrorResponse;
        throw new Error(
          errorResult.error?.message ??
            `Unable to ${mode === "create" ? "create" : "update"} contractor.`,
        );
      }

      const contractor = (result as ContractorDetailResponse).contractor;
      router.push(`/contractors/${contractor.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : `Unable to ${mode === "create" ? "create" : "update"} contractor.`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-neutral-600">Loading contractor...</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <Link
          className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
          href={mode === "create" ? "/contractors" : `/contractors/${contractorId}`}
        >
          {mode === "create" ? "Back to contractors" : "Back to contractor"}
        </Link>
        <div className="mt-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Contractor setup
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
            {title}
          </h1>
        </div>
      </section>

      {errorMessage ? <ActionFeedback message={errorMessage} /> : null}

      <form
        className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Name"
            onChange={(value) => setFormState((current) => ({ ...current, name: value }))}
            required
            value={formState.name}
          />
          <Field
            label="Company"
            onChange={(value) => setFormState((current) => ({ ...current, company: value }))}
            value={formState.company}
          />
          <Field
            label="Email"
            onChange={(value) => setFormState((current) => ({ ...current, email: value }))}
            required
            type="email"
            value={formState.email}
          />
          <Field
            label="Phone"
            onChange={(value) => setFormState((current) => ({ ...current, phone: value }))}
            required
            value={formState.phone}
          />
          <label className="text-sm font-medium text-neutral-700">
            Status
            <select
              className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  status: event.target.value as CreateContractorInput["status"],
                }))
              }
              value={formState.status}
            >
              {CONTRACTOR_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {CONTRACTOR_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Service categories"
            onChange={(value) =>
              setFormState((current) => ({ ...current, serviceCategories: value }))
            }
            placeholder="HVAC, Plumbing, Electrical"
            required
            value={formState.serviceCategories}
          />
          <Field
            label="Service areas"
            onChange={(value) => setFormState((current) => ({ ...current, serviceAreas: value }))}
            placeholder="Toronto, Mississauga, Remote"
            value={formState.serviceAreas}
          />
          <TextareaField
            label="Notes"
            onChange={(value) => setFormState((current) => ({ ...current, notes: value }))}
            value={formState.notes}
          />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="inline-flex items-center justify-center rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
            disabled={isSaving}
            type="submit"
          >
            {isSaving
              ? mode === "create"
                ? "Creating..."
                : "Saving..."
              : title}
          </button>
          <Link
            className="inline-flex items-center justify-center rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950"
            href={mode === "create" ? "/contractors" : `/contractors/${contractorId}`}
          >
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}

function Field({
  label,
  onChange,
  placeholder,
  required = false,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
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
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function TextareaField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="text-sm font-medium text-neutral-700 md:col-span-2">
      {label}
      <textarea
        className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        value={value}
      />
    </label>
  );
}

function splitList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function toFormState(contractor: Contractor): FormState {
  return {
    name: contractor.name,
    company: contractor.company ?? "",
    email: contractor.email,
    phone: contractor.phone,
    status: contractor.status,
    serviceCategories: contractor.serviceCategories.join(", "),
    serviceAreas: contractor.serviceAreas.join(", "),
    notes: contractor.notes ?? "",
  };
}
