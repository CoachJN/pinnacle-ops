import type { EntityId, IsoDateTimeString, RecordStatus } from "./entity.ts";
import type {
  ContactLinkDetail,
  ContactLinkInput,
  ContactSummary,
} from "./contact.ts";

export {
  CONTRACTOR_STATUSES,
  CONTRACTOR_STATUS_LABELS,
  CONTRACTOR_STATUS_VALUES,
  type ContractorStatus,
} from "../modules/contractors/domain/constants.ts";
import type { ContractorStatus } from "../modules/contractors/domain/constants.ts";

export type ContractorOrganizationStatus = ContractorStatus;

export const CONTRACTOR_TRADE_VALUES = [
  "general_contracting",
  "hvac",
  "plumbing",
  "electrical",
  "mechanical",
  "refrigeration",
  "controls",
  "low_voltage",
  "access_control",
  "doors",
  "elevator",
  "fire_life_safety",
  "roofing",
  "restoration",
  "janitorial",
  "landscaping",
  "snow_removal",
  "security",
  "locksmith",
  "painting",
  "paving",
  "waste",
  "other",
] as const;

export type ContractorTrade = (typeof CONTRACTOR_TRADE_VALUES)[number];

export interface ContractorRatingSummary {
  averageRating: number;
  reviewCount: number;
  lastReviewedAt?: IsoDateTimeString | null;
}

export interface ContractorAddress {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
}

export interface ContractorOrganization {
  id: EntityId;
  organizationId: EntityId;
  name: string;
  displayName?: string | null;
  parentContractorId?: EntityId | null;
  status: ContractorOrganizationStatus;
  primaryContactId?: EntityId | null;
  billingContactId?: EntityId | null;
  dispatchContactId?: EntityId | null;
  businessEmail?: string | null;
  mainPhone?: string | null;
  altPhone?: string | null;
  fax?: string | null;
  trades?: ContractorTrade[];
  serviceArea?: string | null;
  ratingSummary?: ContractorRatingSummary | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  notes?: string | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  createdByUserId: EntityId;
  updatedByUserId: EntityId;
  recordStatus: RecordStatus;
  isAssignable?: boolean;
  isDeleted: boolean;
  deletedAt?: IsoDateTimeString | null;
  deletedByUserId?: EntityId | null;
}

export interface Contractor {
  id: EntityId;
  parentContractorId?: EntityId | null;
  legalName: string;
  displayName?: string | null;
  status: ContractorStatus;
  businessEmail?: string | null;
  mainPhone?: string | null;
  altPhone?: string | null;
  fax?: string | null;
  trades: ContractorTrade[];
  serviceArea?: string | null;
  ratingSummary?: ContractorRatingSummary | null;
  isAssignable: boolean;
  primaryContactId?: EntityId | null;
  billingContactId?: EntityId | null;
  dispatchContactId?: EntityId | null;
  primaryContact?: ContactSummary | null;
  billingContact?: ContactSummary | null;
  dispatchContact?: ContactSummary | null;
  linkedContacts?: ContactLinkDetail[];
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  notes: string | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  createdByUserId: EntityId;
  updatedByUserId: EntityId;
  recordStatus: RecordStatus;
}

export interface CreateContractorInput {
  legalName: string;
  displayName?: string | null;
  parentContractorId?: EntityId | null;
  businessEmail?: string | null;
  mainPhone?: string | null;
  altPhone?: string | null;
  fax?: string | null;
  trades: ContractorTrade[];
  serviceArea?: string | null;
  ratingSummary?: ContractorRatingSummary | null;
  isAssignable?: boolean;
  primaryContactId?: EntityId | null;
  billingContactId?: EntityId | null;
  dispatchContactId?: EntityId | null;
  linkedContacts?: ContactLinkInput[];
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  notes?: string | null;
  status: ContractorStatus;
}

export interface UpdateContractorInput {
  legalName?: string;
  displayName?: string | null;
  parentContractorId?: EntityId | null;
  businessEmail?: string | null;
  mainPhone?: string | null;
  altPhone?: string | null;
  fax?: string | null;
  trades?: ContractorTrade[];
  serviceArea?: string | null;
  ratingSummary?: ContractorRatingSummary | null;
  isAssignable?: boolean;
  primaryContactId?: EntityId | null;
  billingContactId?: EntityId | null;
  dispatchContactId?: EntityId | null;
  linkedContacts?: ContactLinkInput[];
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  notes?: string | null;
  status?: ContractorStatus;
}

export interface ContractorSessionContext {
  userId: EntityId;
  name: string;
  contractorId: EntityId;
  contractorDisplayName?: string | null;
}
