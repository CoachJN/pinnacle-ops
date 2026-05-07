"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ActionFeedback } from "@/components/shared/action-feedback";
import { ContactLinkManager } from "@/components/shared/contact-link-manager";
import {
  CONTRACTOR_STATUS_LABELS,
  CONTRACTOR_STATUS_VALUES,
  CONTRACTOR_TRADE_VALUES,
  type Contractor,
  type ContractorTrade,
  type CreateContractorInput,
} from "@/types/contractor";
import type { ContactLinkInput, ContactSummary } from "@/types/contact";
import type {
  ContractorApiErrorResponse,
  ContractorDetailResponse,
  ContractorListResponse,
} from "@/components/contractors/types";
import type { ContactRoleSlotAssignment } from "@/lib/contact-linking";

interface FormState {
  legalName: string;
  displayName: string;
  parentContractorId: string;
  businessEmail: string;
  mainPhone: string;
  altPhone: string;
  fax: string;
  primaryContactId: string;
  billingContactId: string;
  dispatchContactId: string;
  linkedContacts: ContactLinkInput[];
  status: CreateContractorInput["status"];
  trades: ContractorTrade[];
  serviceArea: string;
  isAssignable: boolean;
  notes: string;
}

const emptyFormState: FormState = {
  legalName: "",
  displayName: "",
  parentContractorId: "",
  businessEmail: "",
  mainPhone: "",
  altPhone: "",
  fax: "",
  primaryContactId: "",
  billingContactId: "",
  dispatchContactId: "",
  linkedContacts: [],
  status: "onboarding",
  trades: [],
  serviceArea: "",
  isAssignable: false,
  notes: "",
};

interface ContactsResponse {
  contacts: ContactSummary[];
}

export function ContractorEditorPage({
  mode,
  contractorId,
}: {
  mode: "create" | "edit";
  contractorId?: string;
}) {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>(emptyFormState);
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [isLoading, setIsLoading] = useState(mode === "edit");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadPageData() {
      setIsLoading(mode === "edit");
      setErrorMessage(null);

      try {
        const [contactsResponse, contractorsResponse, contractorResponse] =
          await Promise.all([
            fetch("/api/contacts", { cache: "no-store" }),
            fetch("/api/contractors?limit=100", { cache: "no-store" }),
            mode === "edit" && contractorId
              ? fetch(`/api/contractors/${contractorId}`, {
                  cache: "no-store",
                })
              : Promise.resolve(null),
          ]);

        const contactsPayload = (await contactsResponse.json()) as ContactsResponse;
        if (!contactsResponse.ok) {
          throw new Error("Unable to load contacts.");
        }

        const contractorsPayload = (await contractorsResponse.json()) as
          | ContractorListResponse
          | ContractorApiErrorResponse;
        if (!contractorsResponse.ok) {
          const errorPayload = contractorsPayload as ContractorApiErrorResponse;
          throw new Error(
            errorPayload.error?.message ?? "Unable to load contractors.",
          );
        }

        if (!isCancelled) {
          setContacts(contactsPayload.contacts);
          setContractors((contractorsPayload as ContractorListResponse).contractors);
        }

        if (contractorResponse) {
          const payload = (await contractorResponse.json()) as
            | ContractorDetailResponse
            | ContractorApiErrorResponse;

          if (!contractorResponse.ok) {
            const errorPayload = payload as ContractorApiErrorResponse;
            throw new Error(
              errorPayload.error?.message ?? "Unable to load contractor.",
            );
          }

          if (!isCancelled) {
            setFormState(toFormState((payload as ContractorDetailResponse).contractor));
          }
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load contractor setup.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadPageData();

    return () => {
      isCancelled = true;
    };
  }, [contractorId, mode]);

  const title = useMemo(
    () => (mode === "create" ? "Create contractor" : "Edit contractor"),
    [mode],
  );
  const availableParentContractors = useMemo(
    () => contractors.filter((contractor) => contractor.id !== contractorId),
    [contractorId, contractors],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const payload: CreateContractorInput = {
        legalName: formState.legalName.trim(),
        displayName: formState.displayName.trim() || null,
        parentContractorId: formState.parentContractorId.trim() || null,
        businessEmail: formState.businessEmail.trim() || null,
        mainPhone: formState.mainPhone.trim() || null,
        altPhone: formState.altPhone.trim() || null,
        fax: formState.fax.trim() || null,
        primaryContactId: formState.primaryContactId.trim() || null,
        billingContactId: formState.billingContactId.trim() || null,
        dispatchContactId: formState.dispatchContactId.trim() || null,
        linkedContacts: formState.linkedContacts,
        status: formState.status,
        trades: formState.trades,
        serviceArea: formState.serviceArea.trim() || null,
        isAssignable: formState.isAssignable,
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
            label="Legal name"
            onChange={(value) =>
              setFormState((current) => ({ ...current, legalName: value }))
            }
            required
            value={formState.legalName}
          />
          <Field
            label="Display name"
            onChange={(value) =>
              setFormState((current) => ({ ...current, displayName: value }))
            }
            value={formState.displayName}
          />
          <label className="text-sm font-medium text-neutral-700">
            Parent contractor
            <select
              className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  parentContractorId: event.target.value,
                }))
              }
              value={formState.parentContractorId}
            >
              <option value="">No parent contractor</option>
              {availableParentContractors.map((contractor) => (
                <option key={contractor.id} value={contractor.id}>
                  {formatContractorOptionLabel(contractor, contractors)}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Business email"
            onChange={(value) =>
              setFormState((current) => ({ ...current, businessEmail: value }))
            }
            type="email"
            value={formState.businessEmail}
          />
          <Field
            label="Main phone"
            onChange={(value) =>
              setFormState((current) => ({ ...current, mainPhone: value }))
            }
            required
            value={formState.mainPhone}
          />
          <Field
            label="Alternate phone"
            onChange={(value) =>
              setFormState((current) => ({ ...current, altPhone: value }))
            }
            value={formState.altPhone}
          />
          <Field
            label="Fax"
            onChange={(value) =>
              setFormState((current) => ({ ...current, fax: value }))
            }
            value={formState.fax}
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
            label="Service area"
            onChange={(value) =>
              setFormState((current) => ({ ...current, serviceArea: value }))
            }
            placeholder="Toronto, Mississauga, Remote"
            value={formState.serviceArea}
          />
          <TradeMultiSelect
            onChange={(trades) =>
              setFormState((current) => ({ ...current, trades }))
            }
            required
            value={formState.trades}
          />
          <ToggleField
            checked={formState.isAssignable}
            description="Assignment selectors still require active status and matching trade coverage."
            label="Assignable"
            onChange={(checked) =>
              setFormState((current) => ({ ...current, isAssignable: checked }))
            }
          />
          <TextareaField
            label="Notes"
            onChange={(value) =>
              setFormState((current) => ({ ...current, notes: value }))
            }
            value={formState.notes}
          />
        </div>
        <div className="mt-6">
          <ContactLinkManager
            contacts={contacts}
            description="Keep primary, billing, and dispatch role assignments distinct from the full contractor contact membership list."
            linkedContacts={formState.linkedContacts}
            onLinkedContactsChange={(linkedContacts) =>
              setFormState((current) => ({ ...current, linkedContacts }))
            }
            onRoleSlotsChange={(roleSlots) =>
              setFormState((current) => ({
                ...current,
                ...mapContractorRoleSlotsToFormState(roleSlots),
              }))
            }
            roleSlots={toContractorRoleSlots(formState)}
            title="Linked contacts"
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

function TradeMultiSelect({
  onChange,
  required = false,
  value,
}: {
  onChange: (value: ContractorTrade[]) => void;
  required?: boolean;
  value: ContractorTrade[];
}) {
  return (
    <fieldset className="rounded-2xl border border-neutral-200 p-4 md:col-span-2">
      <legend className="px-2 text-sm font-medium text-neutral-700">
        Trades
        {required ? <span className="text-rose-700"> *</span> : null}
      </legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CONTRACTOR_TRADE_VALUES.map((trade) => (
          <label
            className="flex items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-700"
            key={trade}
          >
            <input
              checked={value.includes(trade)}
              onChange={(event) => {
                const nextValue = event.target.checked
                  ? [...value, trade]
                  : value.filter((selectedTrade) => selectedTrade !== trade);
                onChange(nextValue);
              }}
              type="checkbox"
            />
            <span>{formatTradeLabel(trade)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ToggleField({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="rounded-2xl border border-neutral-200 p-4 text-sm font-medium text-neutral-700 md:col-span-2">
      <span className="flex items-start gap-3">
        <input
          checked={checked}
          className="mt-1"
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span>
          <span className="block text-neutral-950">{label}</span>
          <span className="mt-1 block font-normal text-neutral-600">
            {description}
          </span>
        </span>
      </span>
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

function toFormState(contractor: Contractor): FormState {
  return {
    legalName: contractor.legalName,
    displayName: contractor.displayName ?? "",
    parentContractorId: contractor.parentContractorId ?? "",
    businessEmail: contractor.businessEmail ?? "",
    mainPhone: contractor.mainPhone ?? "",
    altPhone: contractor.altPhone ?? "",
    fax: contractor.fax ?? "",
    primaryContactId: contractor.primaryContactId ?? "",
    billingContactId: contractor.billingContactId ?? "",
    dispatchContactId: contractor.dispatchContactId ?? "",
    linkedContacts:
      contractor.linkedContacts?.map((link) => ({
        contactId: link.contactId,
        relationshipType: link.relationshipType,
        notes: link.notes ?? null,
      })) ?? [],
    status: contractor.status,
    trades: contractor.trades,
    serviceArea: contractor.serviceArea ?? "",
    isAssignable: contractor.isAssignable,
    notes: contractor.notes ?? "",
  };
}

function formatTradeLabel(value: ContractorTrade): string {
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatContractorOptionLabel(
  contractor: Contractor,
  contractors: Contractor[],
): string {
  const parent = contractor.parentContractorId
    ? contractors.find((candidate) => candidate.id === contractor.parentContractorId)
    : null;

  if (!parent) {
    return contractor.displayName ?? contractor.legalName;
  }

  return `${parent.displayName ?? parent.legalName} - ${contractor.displayName ?? contractor.legalName}`;
}

function toContractorRoleSlots(
  formState: Pick<
    FormState,
    "primaryContactId" | "billingContactId" | "dispatchContactId"
  >,
): ContactRoleSlotAssignment<
  "primaryContactId" | "billingContactId" | "dispatchContactId"
>[] {
  return [
    {
      key: "primaryContactId",
      label: "Primary",
      relationshipType: "primary",
      contactId: formState.primaryContactId || null,
      isPrimary: true,
    },
    {
      key: "billingContactId",
      label: "Billing",
      relationshipType: "billing",
      contactId: formState.billingContactId || null,
    },
    {
      key: "dispatchContactId",
      label: "Dispatch",
      relationshipType: "dispatch",
      contactId: formState.dispatchContactId || null,
    },
  ];
}

function mapContractorRoleSlotsToFormState(
  roleSlots: ContactRoleSlotAssignment<
    "primaryContactId" | "billingContactId" | "dispatchContactId"
  >[],
): Pick<FormState, "primaryContactId" | "billingContactId" | "dispatchContactId"> {
  return {
    primaryContactId:
      roleSlots.find((slot) => slot.key === "primaryContactId")?.contactId ?? "",
    billingContactId:
      roleSlots.find((slot) => slot.key === "billingContactId")?.contactId ?? "",
    dispatchContactId:
      roleSlots.find((slot) => slot.key === "dispatchContactId")?.contactId ?? "",
  };
}
