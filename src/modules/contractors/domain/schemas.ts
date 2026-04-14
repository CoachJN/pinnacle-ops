import { z } from "zod";
import type { CreateContractorInput, UpdateContractorInput } from "../../../types/contractor.ts";
import type { ContractorListQuery } from "./types.ts";
import { CONTRACTOR_STATUS_VALUES } from "./constants.ts";

const contractorStatusSchema = z.enum(CONTRACTOR_STATUS_VALUES);
const trimmedStringSchema = z.string().trim().min(1);
const optionalTrimmedStringSchema = z.string().trim().optional();
const nullableTrimmedStringSchema = z.string().trim().nullish();

export const createContractorSchema: z.ZodType<CreateContractorInput> = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(120),
    company: nullableTrimmedStringSchema.transform((value) => value || null),
    email: z.string().trim().email("Enter a valid email address."),
    phone: z.string().trim().min(1, "Phone is required.").max(40),
    status: contractorStatusSchema,
    serviceCategories: z.array(trimmedStringSchema.max(80)).max(25),
    serviceAreas: z.array(trimmedStringSchema.max(120)).max(25),
    notes: nullableTrimmedStringSchema
      .transform((value) => value || null)
      .pipe(z.string().max(4000).nullable()),
    companyName: optionalTrimmedStringSchema,
    contactName: optionalTrimmedStringSchema,
    createdBy: optionalTrimmedStringSchema,
    lastUpdatedBy: optionalTrimmedStringSchema,
  })
  .strict();

export const updateContractorSchema: z.ZodType<UpdateContractorInput> = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    company: nullableTrimmedStringSchema.transform((value) => value || null).optional(),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().min(1).max(40).optional(),
    status: contractorStatusSchema.optional(),
    serviceCategories: z.array(trimmedStringSchema.max(80)).max(25).optional(),
    serviceAreas: z.array(trimmedStringSchema.max(120)).max(25).optional(),
    notes: nullableTrimmedStringSchema
      .transform((value) => value || null)
      .pipe(z.string().max(4000).nullable())
      .optional(),
    companyName: optionalTrimmedStringSchema,
    contactName: optionalTrimmedStringSchema,
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
