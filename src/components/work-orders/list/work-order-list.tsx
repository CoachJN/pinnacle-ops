"use client";

import Link from "next/link";
import {
  usePathname,
  useRouter,
  useSearchParams,
  type ReadonlyURLSearchParams,
} from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { ActionFeedback } from "@/components/shared/action-feedback";
import type { ClientOrganizationSummary } from "@/components/client-organizations/types";
import type { LocationSummary } from "@/components/locations/types";
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from "@/modules/work-orders";
import { WorkOrderFilters } from "./work-order-filters";
import { WorkOrderTable, type WorkOrderTableRow } from "./work-order-table";

interface WorkOrderListItemResponse {
  id: string;
  workOrderNumber: string;
  title: string;
  clientOrganizationId: string;
  locationId: string;
  requestedServiceDate: string | null;
  requiresQuote: boolean;
  quoteRequiredThresholdCents: number | null;
  related?: {
    clientOrganization?: {
      id: string;
      name?: string;
      displayName?: string;
    };
    location?: {
      id: string;
      name?: string;
      code?: string;
    };
  };
  internalAssignees?: {
    coordinator: {
      id: string;
      label: string;
      role: string;
    } | null;
    manager: {
      id: string;
      label: string;
      role: string;
    } | null;
  };
  assignedContractor?: {
    id: string;
    label: string;
  } | null;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  createdAt: string;
  updatedAt: string;
}

interface WorkOrdersResponse {
  data?: {
    workOrders?: WorkOrderListItemResponse[];
  };
  error?: {
    message?: string;
  };
}

interface ClientOrganizationsResponse {
  clientOrganizations: ClientOrganizationSummary[];
  error?: {
    message?: string;
  };
}

interface LocationsResponse {
  locations: LocationSummary[];
  error?: {
    message?: string;
  };
}

interface QueryState {
  clientOrganizationId: string;
  locationId: string;
  priority: "" | WorkOrderPriority;
  search: string;
  status: "" | WorkOrderStatus;
}

const VALID_STATUSES = new Set<string>(WORK_ORDER_STATUSES);
const VALID_PRIORITIES = new Set<string>(WORK_ORDER_PRIORITIES);
const DASHBOARD_WORK_ORDERS_BASE_PATH = "/dashboard/work-orders";

export function WorkOrderList() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState("");
  const deferredSearchInput = useDeferredValue(searchInput);

  const [workOrders, setWorkOrders] = useState<WorkOrderListItemResponse[]>([]);
  const [clientOrganizations, setClientOrganizations] = useState<
    ClientOrganizationSummary[]
  >([]);
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [isLoadingWorkOrders, setIsLoadingWorkOrders] = useState(true);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [workOrderError, setWorkOrderError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);

  const queryState = readQueryState(searchParams);

  useEffect(() => {
    setSearchInput(queryState.search);
  }, [queryState.search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (deferredSearchInput === queryState.search) {
        return;
      }

      updateQueryState({
        nextState: { search: deferredSearchInput },
        pathname,
        router,
        searchParams,
        startTransition,
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [
    deferredSearchInput,
    pathname,
    queryState.search,
    router,
    searchParams,
    startTransition,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadFilterOptions() {
      setIsLoadingFilters(true);
      setFilterError(null);

      try {
        const clientPromise = fetch("/api/client-organizations?limit=100", {
          cache: "no-store",
        });

        const locationParams = new URLSearchParams({
          isActive: "true",
          limit: "100",
        });
        if (queryState.clientOrganizationId) {
          locationParams.set(
            "clientOrganizationId",
            queryState.clientOrganizationId,
          );
        }

        const locationPromise = fetch(`/api/locations?${locationParams.toString()}`, {
          cache: "no-store",
        });

        const [clientResponse, locationResponse] = await Promise.all([
          clientPromise,
          locationPromise,
        ]);
        const [clientPayload, locationPayload] = (await Promise.all([
          clientResponse.json(),
          locationResponse.json(),
        ])) as [ClientOrganizationsResponse, LocationsResponse];

        if (!clientResponse.ok) {
          throw new Error(
            clientPayload.error?.message ??
              "Unable to load client organization filters.",
          );
        }

        if (!locationResponse.ok) {
          throw new Error(
            locationPayload.error?.message ?? "Unable to load location filters.",
          );
        }

        if (cancelled) {
          return;
        }

        setClientOrganizations(clientPayload.clientOrganizations);
        setLocations(locationPayload.locations);
      } catch (error) {
        if (!cancelled) {
          setFilterError(
            error instanceof Error
              ? error.message
              : "Unable to load filter options.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingFilters(false);
        }
      }
    }

    void loadFilterOptions();

    return () => {
      cancelled = true;
    };
  }, [queryState.clientOrganizationId]);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkOrders() {
      setIsLoadingWorkOrders(true);
      setWorkOrderError(null);

      try {
        const params = new URLSearchParams({ limit: "100" });
        if (queryState.search) {
          params.set("search", queryState.search);
        }
        if (queryState.status) {
          params.set("status", queryState.status);
        }
        if (queryState.priority) {
          params.set("priority", queryState.priority);
        }
        if (queryState.clientOrganizationId) {
          params.set("clientOrganizationId", queryState.clientOrganizationId);
        }
        if (queryState.locationId) {
          params.set("locationId", queryState.locationId);
        }

        const response = await fetch(`/api/work-orders?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as WorkOrdersResponse;

        if (!response.ok) {
          throw new Error(
            payload.error?.message ?? "Unable to load work orders.",
          );
        }

        if (cancelled) {
          return;
        }

        setWorkOrders(payload.data?.workOrders ?? []);
      } catch (error) {
        if (!cancelled) {
          setWorkOrderError(
            error instanceof Error ? error.message : "Unable to load work orders.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingWorkOrders(false);
        }
      }
    }

    void loadWorkOrders();

    return () => {
      cancelled = true;
    };
  }, [
    queryState.clientOrganizationId,
    queryState.locationId,
    queryState.priority,
    queryState.search,
    queryState.status,
  ]);

  const clientOptions = useMemo(() => {
    return clientOrganizations
      .filter((clientOrganization) => clientOrganization.status === "active")
      .map((clientOrganization) => ({
        id: clientOrganization.id,
        label: clientOrganization.displayName ?? clientOrganization.name,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [clientOrganizations]);

  const locationOptions = useMemo(() => {
    return locations
      .filter((location) => location.status === "active")
      .map((location) => ({
        id: location.id,
        label: location.name,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [locations]);

  const clientOrganizationNameById = useMemo(() => {
    return new Map(
      clientOrganizations.map((clientOrganization) => [
        clientOrganization.id,
        clientOrganization.displayName ?? clientOrganization.name,
      ]),
    );
  }, [clientOrganizations]);

  const locationNameById = useMemo(() => {
    return new Map(locations.map((location) => [location.id, location.name]));
  }, [locations]);

  const rows = useMemo<WorkOrderTableRow[]>(() => {
    return workOrders.map((workOrder) => ({
      id: workOrder.id,
      workOrderNumber: workOrder.workOrderNumber,
      title: workOrder.title,
      clientName:
        workOrder.related?.clientOrganization?.displayName ??
        workOrder.related?.clientOrganization?.name ??
        clientOrganizationNameById.get(workOrder.clientOrganizationId) ??
        workOrder.clientOrganizationId,
      locationName:
        workOrder.related?.location?.name ??
        locationNameById.get(workOrder.locationId) ?? workOrder.locationId,
      requestedServiceDate: workOrder.requestedServiceDate,
      requiresQuote: workOrder.requiresQuote,
      quoteRequiredThresholdCents: workOrder.quoteRequiredThresholdCents,
      coordinatorLabel: `Coordinator: ${
        workOrder.internalAssignees?.coordinator?.label ?? "Unassigned"
      }`,
      managerLabel: `Manager: ${
        workOrder.internalAssignees?.manager?.label ?? "Unassigned"
      }`,
      assignedContractorLabel:
        workOrder.assignedContractor?.label ?? "Unassigned",
      status: workOrder.status,
      priority: workOrder.priority,
      createdAt: workOrder.createdAt,
      updatedAt: workOrder.updatedAt,
    }));
  }, [clientOrganizationNameById, locationNameById, workOrders]);

  const hasActiveFilters = Boolean(
    queryState.clientOrganizationId ||
      queryState.locationId ||
      queryState.priority ||
      queryState.search ||
      queryState.status,
  );

  return (
    <section className="space-y-6">
      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Work Orders
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
              Monitor active work
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">
              Browse live Phase 3 work orders, apply backend-supported filters,
              and keep your current list state in the URL.
            </p>
          </div>

          <Link
            className="inline-flex rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
            href="/dashboard/work-orders/new"
          >
            Create work order
          </Link>
        </div>
      </section>

      <WorkOrderFilters
        clientOrganizations={clientOptions}
        isLoading={isLoadingFilters}
        locations={locationOptions}
        onClientOrganizationChange={(value) => {
          updateQueryState({
            nextState: {
              clientOrganizationId: value,
              locationId: "",
            },
            pathname,
            router,
            searchParams,
            startTransition,
          });
        }}
        onLocationChange={(value) => {
          updateQueryState({
            nextState: { locationId: value },
            pathname,
            router,
            searchParams,
            startTransition,
          });
        }}
        onPriorityChange={(value) => {
          updateQueryState({
            nextState: { priority: value },
            pathname,
            router,
            searchParams,
            startTransition,
          });
        }}
        onReset={() => {
          startTransition(() => {
            router.replace(pathname);
          });
        }}
        onSearchChange={setSearchInput}
        onStatusChange={(value) => {
          updateQueryState({
            nextState: { status: value },
            pathname,
            router,
            searchParams,
            startTransition,
          });
        }}
        search={searchInput}
        selectedClientOrganizationId={queryState.clientOrganizationId}
        selectedLocationId={queryState.locationId}
        selectedPriority={queryState.priority}
        selectedStatus={queryState.status}
      />

      {filterError ? <ActionFeedback message={filterError} /> : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-neutral-500">
            {isLoadingWorkOrders
              ? "Loading work orders..."
              : `${rows.length} work order${rows.length === 1 ? "" : "s"}`}
          </p>
          {isPending ? (
            <p className="text-sm text-neutral-500">Updating filters...</p>
          ) : null}
        </div>

        {isLoadingWorkOrders ? (
          <LoadingState />
        ) : workOrderError ? (
          <ErrorState
            message={workOrderError}
            onRetry={() => router.refresh()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            hasActiveFilters={hasActiveFilters}
            onClearFilters={() => {
              startTransition(() => {
                router.replace(pathname);
              });
            }}
          />
        ) : (
          <WorkOrderTable
            onRowClick={(workOrderId) => {
              router.push(`${DASHBOARD_WORK_ORDERS_BASE_PATH}/${workOrderId}`);
            }}
            rows={rows}
          />
        )}
      </section>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="h-12 animate-pulse rounded-2xl bg-neutral-100" />
      <div className="h-12 animate-pulse rounded-2xl bg-neutral-100" />
      <div className="h-12 animate-pulse rounded-2xl bg-neutral-100" />
      <div className="h-12 animate-pulse rounded-2xl bg-neutral-100" />
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-rose-900">
        Unable to load work orders
      </h2>
      <p className="mt-2 text-sm text-rose-800">
        {message}
      </p>
      <button
        className="mt-4 inline-flex rounded-full border border-rose-300 px-4 py-2 text-sm font-medium text-rose-900 transition hover:border-rose-400"
        onClick={onRetry}
        type="button"
      >
        Retry
      </button>
    </div>
  );
}

function EmptyState({
  hasActiveFilters,
  onClearFilters,
}: {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-neutral-300 bg-white p-8 text-center shadow-sm">
      <h2 className="text-xl font-semibold text-neutral-950">
        No work orders found
      </h2>
      <p className="mt-2 text-sm text-neutral-600">
        {hasActiveFilters
          ? "Try a broader search or clear one of the active filters."
          : "Create a work order to start populating this queue."}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Link
          className="inline-flex rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
          href="/dashboard/work-orders/new"
        >
          Create work order
        </Link>
        {hasActiveFilters ? (
          <button
            className="inline-flex rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950"
            onClick={onClearFilters}
            type="button"
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}

function readQueryState(
  searchParams: ReadonlyURLSearchParams,
): QueryState {
  const status = searchParams.get("status") ?? "";
  const priority = searchParams.get("priority") ?? "";

  return {
    clientOrganizationId: searchParams.get("clientOrganizationId")?.trim() ?? "",
    locationId: searchParams.get("locationId")?.trim() ?? "",
    priority: VALID_PRIORITIES.has(priority)
      ? (priority as WorkOrderPriority)
      : "",
    search: searchParams.get("search")?.trim() ?? "",
    status: VALID_STATUSES.has(status) ? (status as WorkOrderStatus) : "",
  };
}

function updateQueryState({
  nextState,
  pathname,
  router,
  searchParams,
  startTransition,
}: {
  nextState: Partial<QueryState>;
  pathname: string;
  router: {
    replace: (href: string) => void;
  };
  searchParams: ReadonlyURLSearchParams;
  startTransition: (callback: () => void) => void;
}) {
  const params = new URLSearchParams(searchParams.toString());

  for (const [key, value] of Object.entries(nextState)) {
    if (!value) {
      params.delete(key);
      continue;
    }

    params.set(key, value);
  }

  const query = params.toString();
  startTransition(() => {
    router.replace(query ? `${pathname}?${query}` : pathname);
  });
}
