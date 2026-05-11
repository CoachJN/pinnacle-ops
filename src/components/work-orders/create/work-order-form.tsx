"use client";

import {
  startTransition,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import type { ClientOrganizationSummary } from "@/components/client-organizations/types";
import type { LocationSummary } from "@/components/locations/types";
import { ActionFeedback } from "@/components/shared/action-feedback";
import {
  workOrderCategorySchema,
  workOrderPrioritySchema,
} from "@/modules/work-orders";
import type { ContactSummary } from "@/types/contact";
import { CategorySelector } from "./category-selector";
import { ClientSelector } from "./client-selector";
import { syncSelectedContacts } from "./contact-selection";
import { LocationSelector } from "./location-selector";
import { PrioritySelector } from "./priority-selector";
import {
  formatQuoteThresholdInput,
  isValidCurrencyThresholdInput,
  parseQuoteThresholdDollarsToCents,
} from "./quote-threshold";
import type {
  ApiErrorResponse,
  CreateWorkOrderSuccessResponse,
  WorkOrderCreatePayload,
  WorkOrderFormErrors,
  WorkOrderFormValues,
} from "./types";

const workOrderFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters.")
    .max(150, "Title must be 150 characters or less."),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters."),
  clientOrganizationId: z.string().trim().min(1, "Client organization is required."),
  locationId: z.string().trim().min(1, "Location is required."),
  requestedByContactId: z.string().trim(),
  siteContactId: z.string().trim(),
  priority: workOrderPrioritySchema,
  category: workOrderCategorySchema,
  requestedServiceDate: z.union([
    z.literal(""),
    z.iso.date("Enter a valid requested service date."),
  ]),
  requiresQuote: z.boolean(),
  quoteRequiredThreshold: z.string().trim(),
  requestedByName: z.string().trim().min(1, "Requester name is required."),
  requestedByEmail: z.union([
    z.literal(""),
    z.string().trim().email("Enter a valid requester email."),
  ]),
  requestedByPhone: z.string().trim(),
  dueDate: z.union([z.literal(""), z.iso.date("Enter a valid due date.")]),
});

const workOrderCreatePayloadSchema = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(10),
  clientOrganizationId: z.string().trim().min(1),
  locationId: z.string().trim().min(1),
  requestedByContactId: z.string().trim().optional(),
  siteContactId: z.string().trim().optional(),
  priority: workOrderPrioritySchema,
  category: workOrderCategorySchema,
  requestedServiceDate: z
    .string()
    .trim()
    .refine(
      (value) => !Number.isNaN(Date.parse(value)),
      "Enter a valid requested service date.",
    )
    .optional(),
  requiresQuote: z.boolean().optional(),
  quoteRequiredThresholdCents: z.number().int().nonnegative().nullable().optional(),
  requestedByName: z.string().trim().min(1),
  requestedByEmail: z.string().trim().email().optional(),
  requestedByPhone: z.string().trim().min(1).optional(),
  dueDate: z
    .string()
    .trim()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid due date.")
    .optional(),
  source: z.literal("MANUAL"),
});

const EMPTY_ERRORS: WorkOrderFormErrors = {};
const DASHBOARD_WORK_ORDERS_BASE_PATH = "/dashboard/work-orders";

const INITIAL_VALUES: WorkOrderFormValues = {
  title: "",
  description: "",
  clientOrganizationId: "",
  locationId: "",
  requestedByContactId: "",
  siteContactId: "",
  priority: "MEDIUM",
  category: "GENERAL_REPAIR",
  requestedServiceDate: "",
  requiresQuote: false,
  quoteRequiredThreshold: "",
  requestedByName: "",
  requestedByEmail: "",
  requestedByPhone: "",
  dueDate: "",
};

interface WorkOrderFormProps {
  clients: ClientOrganizationSummary[];
  defaultClientOrganizationId?: string;
  locations: LocationSummary[];
}

interface ContactsResponse {
  contacts: ContactSummary[];
}

export function WorkOrderForm({
  clients,
  defaultClientOrganizationId,
  locations,
}: WorkOrderFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<WorkOrderFormValues>(() => ({
    ...INITIAL_VALUES,
    clientOrganizationId: defaultClientOrganizationId ?? "",
  }));
  const [errors, setErrors] = useState<WorkOrderFormErrors>(EMPTY_ERRORS);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contacts, setContacts] = useState<ContactSummary[]>([]);

  const activeClientIds = useMemo(
    () => new Set(clients.map((client) => client.id)),
    [clients],
  );
  const availableLocations = useMemo(
    () =>
      locations.filter(
        (location) =>
          location.clientOrganizationId === values.clientOrganizationId &&
          activeClientIds.has(location.clientOrganizationId),
      ),
    [activeClientIds, locations, values.clientOrganizationId],
  );

  useEffect(() => {
    if (!values.clientOrganizationId) {
      if (values.locationId) {
        setValues((current) => ({ ...current, locationId: "" }));
      }
      return;
    }

    if (
      values.locationId &&
      availableLocations.some((location) => location.id === values.locationId)
    ) {
      return;
    }

    setValues((current) => ({ ...current, locationId: "" }));
  }, [availableLocations, values.clientOrganizationId, values.locationId]);

  useEffect(() => {
    let isCancelled = false;

    const params = new URLSearchParams();
    if (values.locationId) {
      params.set("locationId", values.locationId);
    } else if (values.clientOrganizationId) {
      params.set("clientOrganizationId", values.clientOrganizationId);
    }

    if (!params.size) {
      setContacts([]);
      return;
    }

    void (async () => {
      const response = await fetch(`/api/contacts?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ContactsResponse;
      if (response.ok && !isCancelled) {
        setContacts(payload.contacts);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [values.clientOrganizationId, values.locationId]);

  useEffect(() => {
    const nextValues = syncSelectedContacts({ contacts, values });
    if (!nextValues) {
      return;
    }

    setValues(nextValues);
  }, [contacts, values]);

  useEffect(() => {
    if (values.requiresQuote || !values.quoteRequiredThreshold) {
      return;
    }

    setValues((current) => ({
      ...current,
      quoteRequiredThreshold: "",
    }));
  }, [values.quoteRequiredThreshold, values.requiresQuote]);

  function updateField<Key extends keyof WorkOrderFormValues>(
    key: Key,
    value: WorkOrderFormValues[Key],
  ) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
    setErrors((current) => {
      if (!current[key] && !current.form) {
        return current;
      }

      return {
        ...current,
        [key]: undefined,
        form: undefined,
      };
    });
    setSubmitError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateForm(values, availableLocations);
    setErrors(nextErrors);
    setSubmitError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload = parsePayload(values);
    if (!payload) {
      setErrors({
        form: "Unable to prepare the work order payload. Review the form and try again.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/work-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseBody = (await response.json()) as
        | ApiErrorResponse
        | CreateWorkOrderSuccessResponse;

      if (!response.ok) {
        const message = getApiErrorMessage(
          responseBody,
          "Unable to create the work order.",
        );

        setErrors((current) => ({
          ...current,
          ...mapApiErrorToFieldErrors(message),
          form: message,
        }));
        setSubmitError(message);
        return;
      }

      const successResponse = responseBody as CreateWorkOrderSuccessResponse;
      const workOrderId = successResponse.data?.workOrder?.id;
      if (!workOrderId) {
        setSubmitError("Work order created, but the response was missing the new record id.");
        return;
      }

      startTransition(() => {
        router.push(`${DASHBOARD_WORK_ORDERS_BASE_PATH}/${workOrderId}`);
        router.refresh();
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to create the work order.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasClients = clients.length > 0;
  const hasLocationsForSelectedClient = availableLocations.length > 0;

  return (
    <form
      className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-2 border-b border-neutral-200 pb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Work orders
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">
          Create work order
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-neutral-600">
          Capture the intake details, requester contact, and client location linkage
          before the work order enters the operational workflow.
        </p>
      </div>

      <div className="mt-6 space-y-6">
        {submitError ? <ActionFeedback message={submitError} /> : null}

        {!hasClients ? (
          <ActionFeedback
            message="No active client organizations are currently available for work order creation."
            tone="info"
          />
        ) : null}

        {hasClients && values.clientOrganizationId && !hasLocationsForSelectedClient ? (
          <ActionFeedback
            message="The selected client organization does not currently have any active locations available for new work orders."
            tone="info"
          />
        ) : null}

        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            error={errors.title}
            label="Title"
            name="title"
            onChange={(event) => updateField("title", event.target.value)}
            placeholder="Brief summary of the work needed"
            required
            value={values.title}
          />

          <PrioritySelector
            error={errors.priority}
            onChange={(value) => updateField("priority", value)}
            value={values.priority}
          />

          <div className="md:col-span-2">
            <TextareaField
              error={errors.description}
              label="Description"
              name="description"
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="Describe the issue, site context, and any urgency details."
              required
              rows={5}
              value={values.description}
            />
          </div>

          <ClientSelector
            clients={clients}
            error={errors.clientOrganizationId}
            onChange={(value) => updateField("clientOrganizationId", value)}
            value={values.clientOrganizationId}
          />

          <LocationSelector
            disabled={!values.clientOrganizationId || !hasLocationsForSelectedClient}
            error={errors.locationId}
            locations={availableLocations}
            onChange={(value) => updateField("locationId", value)}
            selectedClientOrganizationId={values.clientOrganizationId}
            value={values.locationId}
          />

          <ContactSelector
            contacts={contacts}
            label="Requester contact"
            onChange={(value) => updateField("requestedByContactId", value)}
            value={values.requestedByContactId}
          />

          <ContactSelector
            contacts={contacts}
            label="Site contact"
            onChange={(value) => updateField("siteContactId", value)}
            value={values.siteContactId}
          />

          <CategorySelector
            error={errors.category}
            onChange={(value) => updateField("category", value)}
            value={values.category}
          />

          <TextField
            error={errors.requestedServiceDate}
            label="Requested service date"
            name="requestedServiceDate"
            onChange={(event) => updateField("requestedServiceDate", event.target.value)}
            type="date"
            value={values.requestedServiceDate}
          />

          <TextField
            error={errors.dueDate}
            label="Due date"
            name="dueDate"
            onChange={(event) => updateField("dueDate", event.target.value)}
            type="date"
            value={values.dueDate}
          />

          <TextField
            error={errors.requestedByName}
            label="Requested by"
            name="requestedByName"
            onChange={(event) => updateField("requestedByName", event.target.value)}
            placeholder="Requester full name"
            required
            value={values.requestedByName}
          />

          <TextField
            error={errors.requestedByEmail}
            label="Requester email"
            name="requestedByEmail"
            onChange={(event) => updateField("requestedByEmail", event.target.value)}
            placeholder="name@company.com"
            type="email"
            value={values.requestedByEmail}
          />

          <TextField
            error={errors.requestedByPhone}
            label="Requester phone"
            name="requestedByPhone"
            onChange={(event) => updateField("requestedByPhone", event.target.value)}
            placeholder="Optional phone number"
            type="tel"
            value={values.requestedByPhone}
          />

          <fieldset className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 md:col-span-2">
            <legend className="px-1 text-sm font-semibold text-neutral-900">
              Quote requirements
            </legend>
            <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
              <label className="flex items-start gap-3 text-sm text-neutral-700">
                <input
                  checked={values.requiresQuote}
                  className="mt-1 size-4 rounded border-neutral-300 text-neutral-950 focus:ring-neutral-500"
                  onChange={(event) => updateField("requiresQuote", event.target.checked)}
                  type="checkbox"
                />
                <span>
                  <span className="font-medium text-neutral-900">
                    Require a quote before work proceeds
                  </span>
                  <span className="mt-1 block text-neutral-600">
                    Keep quote handling referenced to the work order without embedding quote entities.
                  </span>
                </span>
              </label>

              <TextField
                error={errors.quoteRequiredThreshold}
                label="Quote threshold"
                name="quoteRequiredThreshold"
                onChange={(event) => updateField("quoteRequiredThreshold", event.target.value)}
                onBlur={(event) =>
                  updateField(
                    "quoteRequiredThreshold",
                    formatQuoteThresholdInput(event.target.value),
                  )
                }
                placeholder="Optional amount, for example 250.00"
                inputMode="decimal"
                type="text"
                value={values.quoteRequiredThreshold}
              />
            </div>
          </fieldset>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
          <p className="font-medium text-neutral-900">Submission rules</p>
          <p className="mt-1 leading-6">
            The selected location must belong to the selected client organization. The
            UI prevents invalid combinations and the API validates the relationship again
            before creating the record.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            className="inline-flex min-w-40 items-center justify-center rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
            disabled={isSubmitting || !hasClients}
            type="submit"
          >
            {isSubmitting ? "Creating work order..." : "Create work order"}
          </button>
        </div>
      </div>
    </form>
  );
}

function validateForm(
  values: WorkOrderFormValues,
  availableLocations: LocationSummary[],
): WorkOrderFormErrors {
  const parsed = workOrderFormSchema.safeParse(values);
  const errors = parsed.success ? {} : toFieldErrors(parsed.error.issues);

  if (
    values.quoteRequiredThreshold &&
    !isValidCurrencyThresholdInput(values.quoteRequiredThreshold)
  ) {
    errors.quoteRequiredThreshold =
      "Enter the quote threshold as dollars and cents, for example 250.00.";
  }

  if (!values.requiresQuote && values.quoteRequiredThreshold) {
    errors.quoteRequiredThreshold =
      "Enable quote requirements before setting a quote threshold.";
  }

  if (
    values.locationId &&
    !availableLocations.some((location) => location.id === values.locationId)
  ) {
    errors.locationId =
      "Select a location that belongs to the selected client organization.";
  }

  return errors;
}

function parsePayload(values: WorkOrderFormValues): WorkOrderCreatePayload | null {
  const normalized = {
    title: values.title.trim(),
    description: values.description.trim(),
    clientOrganizationId: values.clientOrganizationId.trim(),
    locationId: values.locationId.trim(),
    requestedByContactId: values.requestedByContactId.trim() || undefined,
    siteContactId: values.siteContactId.trim() || undefined,
    priority: values.priority,
    category: values.category,
    requestedServiceDate: values.requestedServiceDate
      ? new Date(`${values.requestedServiceDate}T00:00:00.000Z`).toISOString()
      : undefined,
    requiresQuote: values.requiresQuote || undefined,
    quoteRequiredThresholdCents: parseQuoteThresholdDollarsToCents(
      values.quoteRequiredThreshold,
    ),
    requestedByName: values.requestedByName.trim(),
    requestedByEmail: values.requestedByEmail.trim() || undefined,
    requestedByPhone: values.requestedByPhone.trim() || undefined,
    dueDate: values.dueDate
      ? new Date(`${values.dueDate}T00:00:00.000Z`).toISOString()
      : undefined,
    source: "MANUAL" as const,
  };

  const parsed = workOrderCreatePayloadSchema.safeParse(normalized);

  return parsed.success ? parsed.data : null;
}

function toFieldErrors(issues: z.ZodIssue[]): WorkOrderFormErrors {
  const errors: WorkOrderFormErrors = {};

  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key !== "string" || key in errors) {
      continue;
    }

    errors[key as keyof WorkOrderFormValues] = issue.message;
  }

  return errors;
}

function mapApiErrorToFieldErrors(message: string): WorkOrderFormErrors {
  const normalized = message.toLowerCase();

  if (normalized.includes("location") && normalized.includes("client")) {
    return {
      locationId:
        "Select a location that belongs to the selected client organization.",
    };
  }

  if (normalized.includes("clientorganizationid")) {
    return {
      clientOrganizationId: message,
    };
  }

  if (normalized.includes("locationid")) {
    return {
      locationId: message,
    };
  }

  return {};
}

function getApiErrorMessage(
  payload: ApiErrorResponse | CreateWorkOrderSuccessResponse,
  fallback: string,
): string {
  if ("error" in payload && payload.error?.message) {
    return payload.error.message;
  }

  return fallback;
}

function TextField({
  error,
  label,
  name,
  onChange,
  onBlur,
  placeholder,
  required = false,
  inputMode,
  step,
  type = "text",
  value,
}: {
  error?: string;
  label: string;
  name: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  inputMode?: "decimal" | "email" | "numeric" | "tel" | "text";
  step?: string;
  type?: "date" | "email" | "number" | "tel" | "text";
  value: string;
}) {
  return (
    <label className="block text-sm font-medium text-neutral-700">
      {label}
      {required ? <span className="text-rose-700"> *</span> : null}
      <input
        className="mt-1 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-950 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
        inputMode={inputMode}
        name={name}
        onBlur={onBlur}
        onChange={onChange}
        placeholder={placeholder}
        step={step}
        type={type}
        value={value}
      />
      {error ? (
        <span className="mt-1 block text-xs text-rose-700">{error}</span>
      ) : null}
    </label>
  );
}

function ContactSelector({
  contacts,
  label,
  onChange,
  value,
}: {
  contacts: ContactSummary[];
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block text-sm font-medium text-neutral-700">
      {label}
      <select
        className="mt-1 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-950 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">No linked contact</option>
        {contacts.map((contact) => (
          <option key={contact.id} value={contact.id}>
            {contact.displayName}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextareaField({
  error,
  label,
  name,
  onChange,
  placeholder,
  required = false,
  rows = 4,
  value,
}: {
  error?: string;
  label: string;
  name: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  value: string;
}) {
  return (
    <label className="block text-sm font-medium text-neutral-700">
      {label}
      {required ? <span className="text-rose-700"> *</span> : null}
      <textarea
        className="mt-1 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-950 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
        name={name}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        value={value}
      />
      {error ? (
        <span className="mt-1 block text-xs text-rose-700">{error}</span>
      ) : null}
    </label>
  );
}
