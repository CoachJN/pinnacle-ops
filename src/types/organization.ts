import type { ClientOrganization } from "@/types/client-organization";
import type { ContractorOrganization } from "@/types/contractor";
import type { EntityId } from "@/types/entity";
import type { Location } from "@/types/location";

export interface ClientOrganizationSummary {
  id: EntityId;
  name: ClientOrganization["name"];
  displayName?: ClientOrganization["displayName"];
  status: ClientOrganization["status"];
}

export interface LocationSummary {
  id: EntityId;
  clientOrganizationId: Location["clientOrganizationId"];
  name: Location["name"];
  code?: Location["code"];
  status: Location["status"];
}

export interface ContractorOrganizationSummary {
  id: EntityId;
  name: ContractorOrganization["name"];
  displayName?: ContractorOrganization["displayName"];
  status: ContractorOrganization["status"];
}
