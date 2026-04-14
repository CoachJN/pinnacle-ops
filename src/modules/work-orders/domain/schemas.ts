import { z } from "zod";

import {
  WORK_ORDER_CATEGORIES,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_SOURCES,
  WORK_ORDER_STATUSES,
} from "./constants";
import type { WorkOrderListQuery } from "./types";

const entityIdSchema = z.string().trim().min(1, "Must be a non-empty identifier.");
const optionalEntityIdSchema = entityIdSchema.optional();
const optionalTrimmedStringSchema = z.string().trim().min(1).optional();
const optionalEmailSchema = z.string().trim().email().optional();
const isoDateTimeSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Must be a valid date.");
const optionalIsoDateTimeSchema = isoDateTimeSchema.optional();

export const workOrderStatusSchema = z.enum(WORK_ORDER_STATUSES);
export const workOrderPrioritySchema = z.enum(WORK_ORDER_PRIORITIES);
export const workOrderCategorySchema = z.enum(WORK_ORDER_CATEGORIES);
export const workOrderSourceSchema = z.enum(WORK_ORDER_SOURCES);

export const createWorkOrderSchema = z
  .object({
    title: z.string().trim().min(3).max(150),
    description: z.string().trim().min(10),
    clientOrganizationId: entityIdSchema,
    locationId: entityIdSchema,
    priority: workOrderPrioritySchema,
    category: workOrderCategorySchema,
    requestedByName: z.string().trim().min(1),
    requestedByEmail: optionalEmailSchema,
    requestedByPhone: optionalTrimmedStringSchema,
    source: workOrderSourceSchema,
    createdByUserId: entityIdSchema,
    assignedCoordinatorUserId: optionalEntityIdSchema,
    assignedManagerUserId: optionalEntityIdSchema,
    dueDate: optionalIsoDateTimeSchema,
    status: workOrderStatusSchema.optional(),
  })
  .strict();

export const updateWorkOrderStatusSchema = z
  .object({
    status: workOrderStatusSchema,
  })
  .strict();

export const createWorkOrderNoteSchema = z
  .object({
    body: z.string().trim().min(1),
    createdByUserId: entityIdSchema,
  })
  .strict();

export const createWorkOrderAttachmentMetadataSchema = z
  .object({
    fileName: z.string().trim().min(1),
    contentType: z.string().trim().min(1),
    fileSizeBytes: z.number().int().positive(),
    storagePath: z.string().trim().min(1),
    uploadedByUserId: entityIdSchema,
  })
  .strict();

export const workOrderListQuerySchema: z.ZodType<WorkOrderListQuery> = z
  .object({
    status: workOrderStatusSchema.optional(),
    priority: workOrderPrioritySchema.optional(),
    category: workOrderCategorySchema.optional(),
    source: workOrderSourceSchema.optional(),
    clientOrganizationId: optionalEntityIdSchema,
    locationId: optionalEntityIdSchema,
    assignedCoordinatorUserId: optionalEntityIdSchema,
    assignedManagerUserId: optionalEntityIdSchema,
    requestedByEmail: optionalEmailSchema,
    dueDateFrom: optionalIsoDateTimeSchema,
    dueDateTo: optionalIsoDateTimeSchema,
    search: optionalTrimmedStringSchema,
    isArchived: z.boolean().optional(),
    limit: z.number().int().positive().max(100).optional(),
    cursor: optionalTrimmedStringSchema,
  })
  .strict();

export type CreateWorkOrderDto = z.output<typeof createWorkOrderSchema>;
export type UpdateWorkOrderStatusDto = z.output<
  typeof updateWorkOrderStatusSchema
>;
export type CreateWorkOrderNoteDto = z.output<typeof createWorkOrderNoteSchema>;
export type CreateWorkOrderAttachmentMetadataDto = z.output<
  typeof createWorkOrderAttachmentMetadataSchema
>;
export type WorkOrderListQueryDto = z.output<typeof workOrderListQuerySchema>;
