import type {
  ClientOrganizationStatus,
} from "@/types/client-organization";
import type {
  LocationStatus,
} from "@/types/location";

/**
 * @deprecated Import `ClientOrganizationStatus` or `LocationStatus` from their
 * canonical modules instead.
 */
export type OperationalRecordStatus = ClientOrganizationStatus | LocationStatus;
