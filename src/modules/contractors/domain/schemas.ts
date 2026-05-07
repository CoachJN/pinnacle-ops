import { z } from "zod";
import {
  CONTRACTOR_TRADE_VALUES,
  type CreateContractorInput,
  type UpdateContractorInput,
} from "../../../types/contractor.ts";
import { CONTACT_RELATIONSHIP_TYPE_VALUES } from "../../../types/contact.ts";
import type { ContractorListQuery } from "./types.ts";
import { CONTRACTOR_STATUS_VALUES } from "./constants.ts";

const contractorStatusSchema = z.enum(CONTRACTOR_STATUS_VALUES);
const contractorTradeSchema = z.enum(CONTRACTOR_TRADE_VALUES);
const optionalTrimmedStringSchema = z.string().trim().optional();
const nullableTrimmedStringSchema = z.string().trim().nullish();
const optionalNullableTrimmedStringSchema = nullableTrimmedStringSchema
  .transform((value) => value || null)
  .optional();
const optionalEmailSchema = z.string().trim().email().nullish().transform((value) => value || null);
const contactRelationshipTypeSchema = z.enum(CONTACT_RELATIONSHIP_TYPE_VALUES);
const contactLinkSchema = z
  .object({
    contactId: z.string().trim().min(1, "Contact id is required."),
    relationshipType: contactRelationshipTypeSchema,
    notes: nullableTrimmedStringSchema.transform((value) => value || null).optional(),
  })
  .strict();

export const createContractorSchema: z.ZodType<CreateContractorInput> = z
  .object({
    legalName: z.string().trim().min(1, "Legal name is required.").max(160),
    displayName: optionalNullableTrimmedStringSchema,
    parentContractorId: optionalNullableTrimmedStringSchema,
    businessEmail: optionalEmailSchema,
    mainPhone: optionalNullableTrimmedStringSchema,
    altPhone: optionalNullableTrimmedStringSchema,
    fax: optionalNullableTrimmedStringSchema,
    trades: z.array(contractorTradeSchema).max(25),
    serviceArea: optionalNullableTrimmedStringSchema,
    ratingSummary: z
      .object({
        averageRating: z.number().min(0).max(5),
        reviewCount: z.number().int().min(0),
        lastReviewedAt: z.string().trim().nullish().transform((value) => value || null).optional(),
      })
      .nullable()
      .optional(),
    isAssignable: z.boolean().optional(),
    primaryContactId: optionalNullableTrimmedStringSchema,
    billingContactId: optionalNullableTrimmedStringSchema,
    dispatchContactId: optionalNullableTrimmedStringSchema,
    linkedContacts: z.array(contactLinkSchema).max(100).optional(),
    addressLine1: optionalNullableTrimmedStringSchema,
    addressLine2: optionalNullableTrimmedStringSchema,
    city: optionalNullableTrimmedStringSchema,
    region: optionalNullableTrimmedStringSchema,
    postalCode: optionalNullableTrimmedStringSchema,
    countryCode: optionalNullableTrimmedStringSchema,
    status: contractorStatusSchema,
    notes: nullableTrimmedStringSchema
      .transform((value) => value || null)
      .pipe(z.string().max(4000).nullable()),
  })
  .strict();

export const updateContractorSchema: z.ZodType<UpdateContractorInput> = z
  .object({
    legalName: z.string().trim().min(1).max(160).optional(),
    displayName: optionalNullableTrimmedStringSchema,
    parentContractorId: optionalNullableTrimmedStringSchema,
    businessEmail: optionalEmailSchema,
    mainPhone: optionalNullableTrimmedStringSchema,
    altPhone: optionalNullableTrimmedStringSchema,
    fax: optionalNullableTrimmedStringSchema,
    trades: z.array(contractorTradeSchema).max(25).optional(),
    serviceArea: optionalNullableTrimmedStringSchema,
    ratingSummary: z
      .object({
        averageRating: z.number().min(0).max(5),
        reviewCount: z.number().int().min(0),
        lastReviewedAt: z.string().trim().nullish().transform((value) => value || null).optional(),
      })
      .nullable()
      .optional(),
    isAssignable: z.boolean().optional(),
    primaryContactId: optionalNullableTrimmedStringSchema,
    billingContactId: optionalNullableTrimmedStringSchema,
    dispatchContactId: optionalNullableTrimmedStringSchema,
    linkedContacts: z.array(contactLinkSchema).max(100).optional(),
    addressLine1: optionalNullableTrimmedStringSchema,
    addressLine2: optionalNullableTrimmedStringSchema,
    city: optionalNullableTrimmedStringSchema,
    region: optionalNullableTrimmedStringSchema,
    postalCode: optionalNullableTrimmedStringSchema,
    countryCode: optionalNullableTrimmedStringSchema,
    status: contractorStatusSchema.optional(),
    notes: nullableTrimmedStringSchema
      .transform((value) => value || null)
      .pipe(z.string().max(4000).nullable())
      .optional(),
  })
  .strict();

export const contractorListQuerySchema: z.ZodType<ContractorListQuery> = z
  .object({
    search: optionalTrimmedStringSchema,
    status: contractorStatusSchema.optional(),
    limit: z.number().int().positive().max(100).optional(),
  })
  .strict();

export { contractorStatusSchema };
