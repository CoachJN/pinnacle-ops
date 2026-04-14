import type { ClientOrganizationSummary } from "@/components/client-organizations/types";
import type { LocationSummary } from "@/components/locations/types";
import type {
  WorkOrderCategory,
  WorkOrderPriority,
} from "@/modules/work-orders";

export interface WorkOrderFormValues {
  title: string;
  description: string;
  clientOrganizationId: string;
  locationId: string;
  priority: WorkOrderPriority;
  category: WorkOrderCategory;
  requestedByName: string;
  requestedByEmail: string;
  requestedByPhone: string;
  dueDate: string;
}

export interface WorkOrderFormErrors
  extends Partial<Record<keyof WorkOrderFormValues, string>> {
  form?: string;
}

export interface WorkOrderCreatePayload {
  title: string;
  description: string;
  clientOrganizationId: string;
  locationId: string;
  priority: WorkOrderPriority;
  category: WorkOrderCategory;
  requestedByName: string;
  requestedByEmail?: string;
  requestedByPhone?: string;
  dueDate?: string;
  source: "MANUAL";
}

export interface ClientOrganizationsResponse {
  clientOrganizations: ClientOrganizationSummary[];
}

export interface LocationsResponse {
  locations: LocationSummary[];
}

export interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

export interface CreateWorkOrderSuccessResponse {
  data?: {
    workOrder?: {
      id: string;
    };
  };
}
