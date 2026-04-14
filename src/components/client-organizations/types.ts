export interface ClientOrganizationSummary {
  id: string;
  name: string;
  displayName?: string;
  status: "active" | "inactive";
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  updatedAt: string;
}

export interface ClientOrganizationDetail extends ClientOrganizationSummary {
  billingEmail?: string;
  notes?: string;
  createdAt: string;
  recordStatus: "active" | "archived";
}
