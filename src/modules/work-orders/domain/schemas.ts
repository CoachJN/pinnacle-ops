import { z } from "zod";
import {
  getWorkOrderAttachmentValidationMessage,
  WORK_ORDER_ATTACHMENT_MAX_SIZE_BYTES,
} from "../../../lib/work-orders/attachments.ts";

import {
  ASSIGNMENT_ASSIGNEE_TYPES,
  ASSIGNMENT_STATUSES,
  WORK_ORDER_CATEGORIES,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_SOURCES,
  WORK_ORDER_STATUSES,
} from "./constants.ts";
import type {
  AcceptAssignmentDto,
  CompleteAssignmentDto,
  CreateContractorAssignmentDto,
  CreateAssignmentDto,
  CreateWorkOrderAttachmentMetadataDto,
  CreateWorkOrderDto,
  CreateWorkOrderNoteDto,
  DeclineAssignmentDto,
  ReassignContractorAssignmentDto,
  ReassignAssignmentDto,
  UpdateWorkOrderStatusDto,
  WorkOrderStatusTransitionWithAssignmentDto,
  WorkOrderListQueryDto,
} from "./types.ts";

const entityIdSchema = z.string().trim().min(1, "Must be a non-empty identifier.");
const optionalEntityIdSchema = entityIdSchema.optional();
const optionalTrimmedStringSchema = z.string().trim().min(1).optional();
const optionalEmailSchema = z.string().trim().email().optional();
const optionalNonNegativeIntegerSchema = z.number().int().nonnegative().nullable().optional();
const isoDateTimeSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Must be a valid date.");
const optionalIsoDateTimeSchema = isoDateTimeSchema.optional();

export const workOrderStatusSchema = z.enum(WORK_ORDER_STATUSES);
export const workOrderPrioritySchema = z.enum(WORK_ORDER_PRIORITIES);
export const workOrderCategorySchema = z.enum(WORK_ORDER_CATEGORIES);
export const workOrderSourceSchema = z.enum(WORK_ORDER_SOURCES);
export const assignmentStatusSchema = z.enum(ASSIGNMENT_STATUSES);
export const assignmentAssigneeTypeSchema = z.enum(ASSIGNMENT_ASSIGNEE_TYPES);

export const createWorkOrderSchema: z.ZodType<CreateWorkOrderDto> = z
  .object({
    title: z.string().trim().min(3).max(150),
    description: z.string().trim().min(10),
    clientOrganizationId: entityIdSchema,
    locationId: entityIdSchema,
    requestedByContactId: optionalEntityIdSchema,
    siteContactId: optionalEntityIdSchema,
    priority: workOrderPrioritySchema,
    category: workOrderCategorySchema,
    requestedServiceDate: optionalIsoDateTimeSchema,
    requiresQuote: z.boolean().optional(),
    quoteRequiredThresholdCents: optionalNonNegativeIntegerSchema,
    requestedByName: z.string().trim().min(1),
    requestedByEmail: optionalEmailSchema,
    requestedByPhone: optionalTrimmedStringSchema,
    source: workOrderSourceSchema,
    createdByUserId: entityIdSchema,
    coordinatorUserId: optionalEntityIdSchema,
    managerUserId: optionalEntityIdSchema,
    dueDate: optionalIsoDateTimeSchema,
    status: workOrderStatusSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.requiresQuote === false && value.quoteRequiredThresholdCents != null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "quoteRequiredThresholdCents can only be set when requiresQuote is true.",
        path: ["quoteRequiredThresholdCents"],
      });
    }
  })
  .strict();

export const updateWorkOrderStatusSchema: z.ZodType<UpdateWorkOrderStatusDto> = z
  .object({
    status: workOrderStatusSchema,
  })
  .strict();

const assignmentSchedulingSchema = z
  .object({
    scheduledDate: isoDateTimeSchema.nullish(),
    timeWindowStart: isoDateTimeSchema.nullish(),
    timeWindowEnd: isoDateTimeSchema.nullish(),
  })
  .superRefine((value, context) => {
    if (value.timeWindowStart && value.timeWindowEnd) {
      const start = Date.parse(value.timeWindowStart);
      const end = Date.parse(value.timeWindowEnd);
      if (start > end) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "timeWindowEnd must be greater than or equal to timeWindowStart.",
          path: ["timeWindowEnd"],
        });
      }
    }
  });

export const createAssignmentSchema: z.ZodType<CreateAssignmentDto> =
  assignmentSchedulingSchema
    .safeExtend({
      workOrderId: entityIdSchema,
      assigneeType: assignmentAssigneeTypeSchema,
      assigneeUserId: entityIdSchema,
      notes: z.string().trim().max(2000).nullish(),
    })
    .strict();

export const reassignAssignmentSchema: z.ZodType<ReassignAssignmentDto> =
  assignmentSchedulingSchema
    .safeExtend({
      currentAssignmentId: entityIdSchema,
      workOrderId: entityIdSchema,
      assigneeType: assignmentAssigneeTypeSchema,
      assigneeUserId: entityIdSchema,
      notes: z.string().trim().max(2000).nullish(),
    })
    .strict();

export const createContractorAssignmentSchema: z.ZodType<CreateContractorAssignmentDto> =
  assignmentSchedulingSchema
    .safeExtend({
      contractorOrganizationId: entityIdSchema,
      notes: z.string().trim().max(2000).nullish(),
    })
    .strict();

export const reassignContractorAssignmentSchema: z.ZodType<ReassignContractorAssignmentDto> =
  assignmentSchedulingSchema
    .safeExtend({
      currentAssignmentId: entityIdSchema,
      contractorOrganizationId: entityIdSchema,
      notes: z.string().trim().max(2000).nullish(),
    })
    .strict();

export const acceptAssignmentSchema: z.ZodType<AcceptAssignmentDto> = z
  .object({
    assignmentId: entityIdSchema,
  })
  .strict();

export const declineAssignmentSchema: z.ZodType<DeclineAssignmentDto> = z
  .object({
    assignmentId: entityIdSchema,
    notes: z.string().trim().max(2000).nullish(),
  })
  .strict();

export const completeAssignmentSchema: z.ZodType<CompleteAssignmentDto> = z
  .object({
    assignmentId: entityIdSchema,
    notes: z.string().trim().max(2000).nullish(),
  })
  .strict();

export const workOrderStatusTransitionWithAssignmentSchema: z.ZodType<WorkOrderStatusTransitionWithAssignmentDto> =
  z
    .object({
      status: workOrderStatusSchema,
    })
    .strict();

export const createWorkOrderNoteSchema: z.ZodType<CreateWorkOrderNoteDto> = z
  .object({
    body: z.string().trim().min(1),
    createdByUserId: entityIdSchema,
  })
  .strict();

export const createWorkOrderAttachmentMetadataSchema: z.ZodType<CreateWorkOrderAttachmentMetadataDto> =
  z
  .object({
    fileName: z.string().trim().min(1),
    contentType: z.string().trim().min(1),
    sizeBytes: z.number().int().positive().max(WORK_ORDER_ATTACHMENT_MAX_SIZE_BYTES),
    storagePath: z.string().trim().min(1),
    uploadedBy: entityIdSchema,
  })
  .superRefine((value, context) => {
    const validationMessage = getWorkOrderAttachmentValidationMessage({
      contentType: value.contentType,
      sizeBytes: value.sizeBytes,
    });

    if (validationMessage) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: validationMessage,
        path: ["contentType"],
      });
    }
  })
  .strict();

export const workOrderListQuerySchema: z.ZodType<WorkOrderListQueryDto> = z
  .object({
    status: workOrderStatusSchema.optional(),
    priority: workOrderPrioritySchema.optional(),
    category: workOrderCategorySchema.optional(),
    source: workOrderSourceSchema.optional(),
    clientOrganizationId: optionalEntityIdSchema,
    locationId: optionalEntityIdSchema,
    coordinatorUserId: optionalEntityIdSchema,
    managerUserId: optionalEntityIdSchema,
    requestedByEmail: optionalEmailSchema,
    dueDateFrom: optionalIsoDateTimeSchema,
    dueDateTo: optionalIsoDateTimeSchema,
    search: optionalTrimmedStringSchema,
    isArchived: z.boolean().optional(),
    limit: z.number().int().positive().max(100).optional(),
    cursor: optionalTrimmedStringSchema,
  })
  .strict();
