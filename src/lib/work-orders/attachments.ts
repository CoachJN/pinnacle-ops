export const WORK_ORDER_ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export const WORK_ORDER_ATTACHMENT_ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

const WORK_ORDER_ATTACHMENT_ALLOWED_CONTENT_TYPE_SET = new Set<string>(
  WORK_ORDER_ATTACHMENT_ALLOWED_CONTENT_TYPES,
);

export const WORK_ORDER_ATTACHMENT_ACCEPT = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
].join(",");

export function isAllowedWorkOrderAttachmentContentType(
  contentType: string,
): boolean {
  return WORK_ORDER_ATTACHMENT_ALLOWED_CONTENT_TYPE_SET.has(contentType.trim().toLowerCase());
}

export function getWorkOrderAttachmentValidationMessage(input: {
  contentType: string;
  sizeBytes: number;
}): string | null {
  if (!isAllowedWorkOrderAttachmentContentType(input.contentType)) {
    return "Attachments must be a PDF, JPG, or PNG file.";
  }

  if (input.sizeBytes > WORK_ORDER_ATTACHMENT_MAX_SIZE_BYTES) {
    return `Attachments must be ${formatWorkOrderAttachmentSizeLimit(
      WORK_ORDER_ATTACHMENT_MAX_SIZE_BYTES,
    )} or smaller.`;
  }

  return null;
}

export function buildWorkOrderAttachmentStoragePath(input: {
  workOrderId: string;
  fileName: string;
  uniqueSuffix?: string;
}): string {
  const normalizedWorkOrderId = normalizeWorkOrderAttachmentWorkOrderId(
    input.workOrderId,
  );
  const normalizedFileName = sanitizeWorkOrderAttachmentFileName(input.fileName);
  const uniqueSuffix =
    input.uniqueSuffix?.trim() ||
    `${Date.now()}-${typeof crypto !== "undefined" ? crypto.randomUUID() : "attachment"}`;

  return `work-orders/${normalizedWorkOrderId}/attachments/${uniqueSuffix}-${normalizedFileName}`;
}

export function isWorkOrderAttachmentStoragePathForWorkOrder(input: {
  workOrderId: string;
  storagePath: string;
}): boolean {
  const normalizedWorkOrderId = normalizeWorkOrderAttachmentWorkOrderId(
    input.workOrderId,
  );
  const normalizedStoragePath = input.storagePath.trim();

  if (!normalizedStoragePath) {
    return false;
  }

  const expectedPrefix = `work-orders/${normalizedWorkOrderId}/attachments/`;

  return (
    normalizedStoragePath.startsWith(expectedPrefix) &&
    normalizedStoragePath.length > expectedPrefix.length
  );
}

export function sanitizeWorkOrderAttachmentFileName(fileName: string): string {
  const normalized = fileName
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "attachment";
}

export function formatWorkOrderAttachmentSizeLimit(sizeBytes: number): string {
  return `${Math.round(sizeBytes / (1024 * 1024))} MB`;
}

function normalizeWorkOrderAttachmentWorkOrderId(workOrderId: string): string {
  const normalizedWorkOrderId = workOrderId.trim();

  if (!normalizedWorkOrderId) {
    throw new Error("workOrderId is required.");
  }

  return normalizedWorkOrderId;
}
