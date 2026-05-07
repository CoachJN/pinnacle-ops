import { z } from "zod";
import type {
  ContactStatus,
  PreferredContactMethod,
  PreferredLanguage,
} from "@/types/contact";

const CONTACT_LANGUAGE_VALUES = [
  "en",
  "fr",
  "other",
  "unknown",
] as const satisfies readonly PreferredLanguage[];

const CONTACT_METHOD_VALUES = [
  "email",
  "phone",
  "sms",
  "other",
  "unknown",
] as const satisfies readonly PreferredContactMethod[];

const CONTACT_STATUS_VALUES = [
  "active",
  "inactive",
  "archived",
] as const satisfies readonly ContactStatus[];

const contactLanguageSchema = z.enum(CONTACT_LANGUAGE_VALUES);
const contactMethodSchema = z.enum(CONTACT_METHOD_VALUES);
const contactStatusSchema = z.enum(CONTACT_STATUS_VALUES);

const nullableTrimmedStringSchema = z.string().trim().nullish();
const optionalNullableTrimmedStringSchema = nullableTrimmedStringSchema
  .transform((value) => value || null)
  .optional();
const optionalEmailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .nullish()
  .transform((value) => value || null);

export const createContactSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required.").max(120),
    lastName: z.string().trim().min(1, "Last name is required.").max(120),
    displayName: optionalNullableTrimmedStringSchema,
    email: optionalEmailSchema,
    primaryPhone: optionalNullableTrimmedStringSchema,
    secondaryPhone: optionalNullableTrimmedStringSchema,
    roleTitle: optionalNullableTrimmedStringSchema,
    preferredLanguage: contactLanguageSchema.optional(),
    preferredContactMethod: contactMethodSchema.nullish().optional(),
    notes: nullableTrimmedStringSchema
      .transform((value) => value || null)
      .pipe(z.string().max(4000).nullable()),
    status: contactStatusSchema.optional(),
  })
  .strict();

export const updateContactSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required.").max(120).optional(),
    lastName: z.string().trim().min(1, "Last name is required.").max(120).optional(),
    displayName: optionalNullableTrimmedStringSchema,
    email: optionalEmailSchema.optional(),
    primaryPhone: optionalNullableTrimmedStringSchema,
    secondaryPhone: optionalNullableTrimmedStringSchema,
    roleTitle: optionalNullableTrimmedStringSchema,
    preferredLanguage: contactLanguageSchema.optional(),
    preferredContactMethod: contactMethodSchema.nullish().optional(),
    notes: nullableTrimmedStringSchema
      .transform((value) => value || null)
      .pipe(z.string().max(4000).nullable())
      .optional(),
    status: contactStatusSchema.optional(),
  })
  .strict();

export {
  CONTACT_LANGUAGE_VALUES,
  CONTACT_METHOD_VALUES,
  CONTACT_STATUS_VALUES,
  contactLanguageSchema,
  contactMethodSchema,
  contactStatusSchema,
};
