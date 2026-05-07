"use client";

import Link from "next/link";
import {
  startTransition,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { ActionFeedback } from "@/components/shared/action-feedback";
import { ContactLinkManager } from "@/components/shared/contact-link-manager";
import type { ClientOrganizationSummary } from "@/components/client-organizations/types";
import type {
  LocationDetail,
  LocationFormErrors,
  LocationFormValues,
} from "@/components/locations/types";
import type { ContactSummary } from "@/types/contact";
import type { ContactRoleSlotAssignment } from "@/lib/contact-linking";

interface LocationEditorPageProps {
  mode: "create" | "edit";
  locationId?: string;
  defaultClientOrganizationId?: string;
  portalMode?: boolean;
}

interface ClientOrganizationsResponse {
  clientOrganizations: ClientOrganizationSummary[];
}

interface LocationResponse {
  location: LocationDetail;
}

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

interface ContactsResponse {
  contacts: ContactSummary[];
}

const EMPTY_FORM: LocationFormValues = {
  clientOrganizationId: "",
  name: "",
  locationCode: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  province: "",
  postalCode: "",
  country: "",
  primaryContactId: "",
  siteContactId: "",
  linkedContacts: [],
  accessInstructions: "",
  serviceNotes: "",
  notes: "",
  isActive: true,
};

export function LocationEditorPage({
  mode,
  locationId,
  defaultClientOrganizationId,
  portalMode = false,
}: LocationEditorPageProps) {
  const router = useRouter();
  const [clientOrganizations, setClientOrganizations] = useState<
    ClientOrganizationSummary[]
  >([]);
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [formValues, setFormValues] = useState<LocationFormValues>({
    ...EMPTY_FORM,
    clientOrganizationId: defaultClientOrganizationId ?? "",
  });
  const [initialLocation, setInitialLocation] = useState<LocationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<LocationFormErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadDependencies() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const requests: Promise<Response>[] = [];

        requests.push(fetch("/api/contacts", { cache: "no-store" }));

        if (!portalMode) {
          requests.push(fetch("/api/client-organizations?limit=100", { cache: "no-store" }));
        }

        if (mode === "edit" && locationId) {
          requests.push(fetch(`/api/locations/${locationId}`, { cache: "no-store" }));
        }

        const responses = await Promise.all(requests);
        const contactsPayload = (await responses[0].json()) as
          | ContactsResponse
          | ApiErrorResponse;
        if (!responses[0]?.ok) {
          throw new Error(
            getApiErrorMessage(
              contactsPayload as ApiErrorResponse,
              "Unable to load contacts.",
            ),
          );
        }

        let organizationsSuccessPayload: ClientOrganizationsResponse | null = null;

        if (!portalMode) {
          const organizationsPayload = (await responses[1].json()) as
            | ClientOrganizationsResponse
            | ApiErrorResponse;

          if (!responses[1]?.ok) {
            const errorPayload = organizationsPayload as ApiErrorResponse;
            throw new Error(
              getApiErrorMessage(
                errorPayload,
                "Unable to load client organizations.",
              ),
            );
          }

          organizationsSuccessPayload =
            organizationsPayload as ClientOrganizationsResponse;
        }

        let nextLocation: LocationDetail | null = null;
        const locationResponse = portalMode ? responses[1] : responses[2];
        if (locationResponse) {
          const locationPayload = (await locationResponse.json()) as
            | LocationResponse
            | ApiErrorResponse;

          if (!locationResponse.ok) {
            const errorPayload = locationPayload as ApiErrorResponse;
            throw new Error(
              getApiErrorMessage(errorPayload, "Unable to load location."),
            );
          }

          const successPayload = locationPayload as LocationResponse;
          nextLocation = successPayload.location;
        }

        if (!isCancelled) {
          setContacts((contactsPayload as ContactsResponse).contacts);
          if (organizationsSuccessPayload) {
            setClientOrganizations(organizationsSuccessPayload.clientOrganizations);
          }
          if (defaultClientOrganizationId) {
            setFormValues((current) => ({
              ...current,
              clientOrganizationId:
                current.clientOrganizationId || defaultClientOrganizationId,
            }));
          }
          if (nextLocation) {
            setInitialLocation(nextLocation);
            setFormValues(mapLocationToFormValues(nextLocation));
          } else if (
            !portalMode &&
            !defaultClientOrganizationId &&
            organizationsSuccessPayload &&
            organizationsSuccessPayload.clientOrganizations.length > 0
          ) {
            setFormValues((current) => ({
              ...current,
              clientOrganizationId:
                current.clientOrganizationId ||
                organizationsSuccessPayload.clientOrganizations[0]?.id ||
                "",
            }));
          }
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load location editor.",
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
  }, [defaultClientOrganizationId, locationId, mode, portalMode]);

  const pageTitle = mode === "create" ? "Create location" : "Edit location";
  const basePath = portalMode ? "/portal/locations" : "/locations";
  const backHref = mode === "edit" && locationId ? `${basePath}/${locationId}` : basePath;
  const helperText = useMemo(() => {
    if (portalMode) {
      return mode === "create"
        ? "Create a location for your organization. Ownership is applied automatically from your authenticated client scope."
        : "Update location details for your organization. Cross-organization reassignment is still blocked by the backend.";
    }

    if (mode !== "edit") {
      return "Create a new location under a client organization.";
    }

    return "Update operational site details. If you change the organization, the backend will reject cross-organization reassignment.";
  }, [mode, portalMode]);

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
        mode === "create" ? "/api/locations" : `/api/locations/${locationId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(toApiPayload(formValues)),
        },
      );

      const payload = (await response.json()) as
        | LocationResponse
        | ApiErrorResponse;

      if (!response.ok) {
        const errorPayload = payload as ApiErrorResponse;
        throw new Error(getApiErrorMessage(errorPayload, "Unable to save location."));
      }

      const successPayload = payload as LocationResponse;
      startTransition(() => {
        router.push(`${basePath}/${successPayload.location.id}`);
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

  if (isLoading) {
    return (
      <section className="space-y-4">
        <div className="h-32 animate-pulse rounded-3xl bg-neutral-100" />
        <div className="h-[32rem] animate-pulse rounded-3xl bg-neutral-100" />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <Link
        className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
        href={backHref}
      >
        {mode === "edit" ? "Back to location" : "Back to locations"}
      </Link>

      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Locations
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
          {pageTitle}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
          {helperText}
        </p>
        {initialLocation?.recordStatus === "archived" ? (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This location record is archived. Editing may be restricted by backend
            rules.
          </p>
        ) : null}
        {portalMode ? (
          <p className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            This form is scoped to your authenticated client organization. The
            organization owner cannot be changed here.
          </p>
        ) : null}
      </section>

      {errorMessage ? <ActionFeedback message={errorMessage} /> : null}

      <form
        className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="grid gap-5 md:grid-cols-2">
          {portalMode ? null : (
            <SelectField
              error={errors.clientOrganizationId}
              label="Client organization"
              name="clientOrganizationId"
              onChange={(value) =>
                setFormValues((current) => ({
                  ...current,
                  clientOrganizationId: value,
                }))
              }
              options={clientOrganizations.map((organization) => ({
                label: organization.displayName ?? organization.name,
                value: organization.id,
              }))}
              value={formValues.clientOrganizationId}
            />
          )}

          <CheckboxField
            checked={formValues.isActive}
            description="Inactive locations remain visible but are marked unavailable for new operational use."
            label="Active location"
            onChange={(checked) =>
              setFormValues((current) => ({ ...current, isActive: checked }))
            }
          />

          <TextField
            error={errors.name}
            label="Name"
            onChange={(value) =>
              setFormValues((current) => ({ ...current, name: value }))
            }
            required
            value={formValues.name}
          />

          <TextField
            label="Location code"
            onChange={(value) =>
              setFormValues((current) => ({ ...current, locationCode: value }))
            }
            value={formValues.locationCode}
          />

          <TextField
            label="Address line 1"
            onChange={(value) =>
              setFormValues((current) => ({ ...current, addressLine1: value }))
            }
            value={formValues.addressLine1}
          />

          <TextField
            label="Address line 2"
            onChange={(value) =>
              setFormValues((current) => ({ ...current, addressLine2: value }))
            }
            value={formValues.addressLine2}
          />

          <TextField
            label="City"
            onChange={(value) =>
              setFormValues((current) => ({ ...current, city: value }))
            }
            value={formValues.city}
          />

          <TextField
            label="Province"
            onChange={(value) =>
              setFormValues((current) => ({ ...current, province: value }))
            }
            value={formValues.province}
          />

          <TextField
            label="Postal code"
            onChange={(value) =>
              setFormValues((current) => ({ ...current, postalCode: value }))
            }
            value={formValues.postalCode}
          />

          <TextField
            label="Country"
            onChange={(value) =>
              setFormValues((current) => ({ ...current, country: value }))
            }
            value={formValues.country}
          />

          <TextareaField
            className="md:col-span-2"
            label="Access instructions"
            onChange={(value) =>
              setFormValues((current) => ({
                ...current,
                accessInstructions: value,
              }))
            }
            value={formValues.accessInstructions}
          />

          <TextareaField
            className="md:col-span-2"
            label="Service notes"
            onChange={(value) =>
              setFormValues((current) => ({ ...current, serviceNotes: value }))
            }
            value={formValues.serviceNotes}
          />

          {portalMode ? null : (
            <TextareaField
              className="md:col-span-2"
              label="Notes"
              onChange={(value) =>
                setFormValues((current) => ({ ...current, notes: value }))
              }
              value={formValues.notes}
            />
          )}
        </div>

        <div className="mt-6">
          <ContactLinkManager
            contacts={contacts}
            description="Keep site role assignments and linked membership in sync while still allowing additional operational contacts."
            linkedContacts={formValues.linkedContacts}
            onLinkedContactsChange={(linkedContacts) =>
              setFormValues((current) => ({ ...current, linkedContacts }))
            }
            onRoleSlotsChange={(roleSlots) =>
              setFormValues((current) => ({
                ...current,
                ...mapLocationRoleSlotsToFormValues(roleSlots),
              }))
            }
            roleSlots={toLocationRoleSlots(formValues)}
            title="Linked contacts"
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="inline-flex rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            type="submit"
          >
            {isSaving
              ? mode === "create"
                ? "Creating..."
                : "Saving..."
              : pageTitle}
          </button>
          <Link
            className="inline-flex rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950"
            href={backHref}
          >
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  error,
  required = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="text-sm font-medium text-neutral-700">
      {label}
      {required ? <span className="text-rose-700"> *</span> : null}
      <input
        className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
      {error ? <span className="mt-1 block text-xs text-rose-700">{error}</span> : null}
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`text-sm font-medium text-neutral-700 ${className ?? ""}`}>
      {label}
      <textarea
        className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        value={value}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  error?: string;
}) {
  return (
    <label className="text-sm font-medium text-neutral-700">
      {label}
      <select
        className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500"
        name={name}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">Select an organization</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="mt-1 block text-xs text-rose-700">{error}</span> : null}
    </label>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description: string;
}) {
  return (
    <label className="flex rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <input
        checked={checked}
        className="mt-1 h-4 w-4 rounded border-neutral-300"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span className="ml-3 block">
        <span className="text-sm font-medium text-neutral-900">{label}</span>
        <span className="mt-1 block text-sm text-neutral-600">{description}</span>
      </span>
    </label>
  );
}

function mapLocationToFormValues(location: LocationDetail): LocationFormValues {
  return {
    clientOrganizationId: location.clientOrganizationId,
    name: location.name,
    locationCode: location.code ?? "",
    addressLine1: location.addressLine1 ?? "",
    addressLine2: location.addressLine2 ?? "",
    city: location.city ?? "",
    province: location.region ?? "",
    postalCode: location.postalCode ?? "",
    country: location.countryCode ?? "",
    primaryContactId: location.primaryContactId ?? "",
    siteContactId: location.siteContactId ?? "",
    linkedContacts:
      location.linkedContacts?.map((link) => ({
        contactId: link.contactId,
        relationshipType: link.relationshipType,
        notes: link.notes ?? null,
      })) ?? [],
    accessInstructions: location.accessNotes ?? "",
    serviceNotes: location.serviceNotes ?? "",
    notes: location.notes ?? "",
    isActive: location.status === "active",
  };
}

function toApiPayload(values: LocationFormValues) {
  return {
    clientOrganizationId: values.clientOrganizationId,
    name: values.name,
    code: values.locationCode || null,
    status: values.isActive ? "active" : "inactive",
    primaryContactId: values.primaryContactId || null,
    siteContactId: values.siteContactId || null,
    linkedContacts: values.linkedContacts,
    addressLine1: values.addressLine1 || null,
    addressLine2: values.addressLine2 || null,
    city: values.city || null,
    region: values.province || null,
    postalCode: values.postalCode || null,
    countryCode: values.country || null,
    accessNotes: values.accessInstructions || null,
    serviceNotes: values.serviceNotes || null,
    notes: values.notes || null,
  };
}

function validateForm(values: LocationFormValues): LocationFormErrors {
  const errors: LocationFormErrors = {};

  if (!values.clientOrganizationId.trim()) {
    errors.clientOrganizationId = "Client organization scope is required.";
  }

  if (!values.name.trim()) {
    errors.name = "Location name is required.";
  }

  return errors;
}

function getApiErrorMessage(
  payload: ApiErrorResponse,
  fallback: string,
): string {
  return payload.error?.message ?? fallback;
}

function toLocationRoleSlots(
  values: Pick<LocationFormValues, "primaryContactId" | "siteContactId">,
): ContactRoleSlotAssignment<"primaryContactId" | "siteContactId">[] {
  return [
    {
      key: "primaryContactId",
      label: "Primary",
      relationshipType: "primary",
      contactId: values.primaryContactId || null,
      isPrimary: true,
    },
    {
      key: "siteContactId",
      label: "Site",
      relationshipType: "site",
      contactId: values.siteContactId || null,
    },
  ];
}

function mapLocationRoleSlotsToFormValues(
  roleSlots: ContactRoleSlotAssignment<"primaryContactId" | "siteContactId">[],
): Pick<LocationFormValues, "primaryContactId" | "siteContactId"> {
  return {
    primaryContactId:
      roleSlots.find((slot) => slot.key === "primaryContactId")?.contactId ?? "",
    siteContactId:
      roleSlots.find((slot) => slot.key === "siteContactId")?.contactId ?? "",
  };
}
