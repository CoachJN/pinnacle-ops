export interface WorkOrderFileAttachment {
  id: string;
  workOrderId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
  uploadedBy: string;
  uploadedByDisplayName: string;
  createdAt: string;
  accessPath: string;
  description?: string | null;
  notes?: string | null;
}

export type WorkOrderFileCategory = "image" | "document" | "other";

export interface DerivedWorkOrderFileAttachment extends WorkOrderFileAttachment {
  category: WorkOrderFileCategory;
  categoryLabel: string;
  fileTypeLabel: string;
  note: string | null;
}

export interface WorkOrderFilesSummary {
  totalAttachments: number;
  imageCount: number;
  documentCount: number;
  otherCount: number;
  mostRecentUploadAt: string | null;
}

export interface WorkOrderFileTypeGroups {
  images: DerivedWorkOrderFileAttachment[];
  documents: DerivedWorkOrderFileAttachment[];
  otherFiles: DerivedWorkOrderFileAttachment[];
}

const IMAGE_CONTENT_TYPE_PREFIX = "image/";
const IMAGE_EXTENSIONS = new Set([
  "avif",
  "bmp",
  "gif",
  "heic",
  "heif",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "tif",
  "tiff",
  "webp",
]);
const DOCUMENT_EXTENSIONS = new Set([
  "csv",
  "doc",
  "docx",
  "ods",
  "odt",
  "pdf",
  "ppt",
  "pptx",
  "rtf",
  "txt",
  "xls",
  "xlsx",
]);
const DOCUMENT_CONTENT_TYPES = new Map<string, string>([
  ["application/msword", "Word document"],
  ["application/pdf", "PDF document"],
  ["application/rtf", "Rich text document"],
  ["application/vnd.ms-excel", "Excel spreadsheet"],
  ["application/vnd.ms-powerpoint", "PowerPoint presentation"],
  ["application/vnd.oasis.opendocument.presentation", "OpenDocument presentation"],
  ["application/vnd.oasis.opendocument.spreadsheet", "OpenDocument spreadsheet"],
  ["application/vnd.oasis.opendocument.text", "OpenDocument text document"],
  [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "PowerPoint presentation",
  ],
  [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Excel spreadsheet",
  ],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Word document",
  ],
  ["text/csv", "CSV document"],
  ["text/plain", "Text document"],
]);
const IMAGE_CONTENT_TYPE_LABELS = new Map<string, string>([
  ["image/avif", "AVIF image"],
  ["image/bmp", "Bitmap image"],
  ["image/gif", "GIF image"],
  ["image/heic", "HEIC image"],
  ["image/heif", "HEIF image"],
  ["image/jpeg", "JPEG image"],
  ["image/jpg", "JPEG image"],
  ["image/png", "PNG image"],
  ["image/svg+xml", "SVG image"],
  ["image/tiff", "TIFF image"],
  ["image/webp", "WebP image"],
]);

export function deriveWorkOrderFilesSummary(
  attachments: readonly WorkOrderFileAttachment[],
): WorkOrderFilesSummary {
  let imageCount = 0;
  let documentCount = 0;
  let otherCount = 0;
  let mostRecentUploadAt: string | null = null;
  let mostRecentUploadTime = Number.NEGATIVE_INFINITY;

  for (const attachment of attachments) {
    const category = deriveWorkOrderFileCategory(attachment);
    if (category === "image") {
      imageCount += 1;
    } else if (category === "document") {
      documentCount += 1;
    } else {
      otherCount += 1;
    }

    const createdAtTime = Date.parse(attachment.createdAt);
    if (Number.isFinite(createdAtTime) && createdAtTime > mostRecentUploadTime) {
      mostRecentUploadTime = createdAtTime;
      mostRecentUploadAt = attachment.createdAt;
    }
  }

  return {
    totalAttachments: attachments.length,
    imageCount,
    documentCount,
    otherCount,
    mostRecentUploadAt,
  };
}

export function groupWorkOrderAttachmentsByType(
  attachments: readonly WorkOrderFileAttachment[],
): WorkOrderFileTypeGroups {
  const groups: WorkOrderFileTypeGroups = {
    images: [],
    documents: [],
    otherFiles: [],
  };

  for (const attachment of attachments) {
    const derivedAttachment = deriveWorkOrderFileAttachment(attachment);
    if (derivedAttachment.category === "image") {
      groups.images.push(derivedAttachment);
    } else if (derivedAttachment.category === "document") {
      groups.documents.push(derivedAttachment);
    } else {
      groups.otherFiles.push(derivedAttachment);
    }
  }

  groups.images.sort(compareAttachmentsNewestFirst);
  groups.documents.sort(compareAttachmentsNewestFirst);
  groups.otherFiles.sort(compareAttachmentsNewestFirst);

  return groups;
}

export function deriveWorkOrderFileAttachment(
  attachment: WorkOrderFileAttachment,
): DerivedWorkOrderFileAttachment {
  const category = deriveWorkOrderFileCategory(attachment);

  return {
    ...attachment,
    category,
    categoryLabel: categoryLabels[category],
    fileTypeLabel: deriveWorkOrderFileTypeLabel(attachment, category),
    note: attachment.description?.trim() || attachment.notes?.trim() || null,
  };
}

export function deriveWorkOrderFileCategory(
  attachment: Pick<WorkOrderFileAttachment, "contentType" | "fileName">,
): WorkOrderFileCategory {
  const normalizedContentType = attachment.contentType.trim().toLowerCase();
  const extension = getFileExtension(attachment.fileName);

  if (
    normalizedContentType.startsWith(IMAGE_CONTENT_TYPE_PREFIX) ||
    (extension !== null && IMAGE_EXTENSIONS.has(extension))
  ) {
    return "image";
  }

  if (
    DOCUMENT_CONTENT_TYPES.has(normalizedContentType) ||
    normalizedContentType.startsWith("text/") ||
    normalizedContentType.includes("word") ||
    normalizedContentType.includes("excel") ||
    normalizedContentType.includes("powerpoint") ||
    (extension !== null && DOCUMENT_EXTENSIONS.has(extension))
  ) {
    return "document";
  }

  return "other";
}

export function deriveWorkOrderFileTypeLabel(
  attachment: Pick<WorkOrderFileAttachment, "contentType" | "fileName">,
  category = deriveWorkOrderFileCategory(attachment),
): string {
  const normalizedContentType = attachment.contentType.trim().toLowerCase();
  const extension = getFileExtension(attachment.fileName);

  if (category === "image") {
    return (
      IMAGE_CONTENT_TYPE_LABELS.get(normalizedContentType) ??
      (extension ? `${extension.toUpperCase()} image` : "Image file")
    );
  }

  if (category === "document") {
    return (
      DOCUMENT_CONTENT_TYPES.get(normalizedContentType) ??
      (extension ? `${extension.toUpperCase()} document` : "Document file")
    );
  }

  if (extension) {
    return `${extension.toUpperCase()} file`;
  }

  return "Unknown file type";
}

export function formatWorkOrderFilesTabLabel(totalAttachments: number): string {
  return `Files (${totalAttachments})`;
}

function compareAttachmentsNewestFirst(
  left: Pick<WorkOrderFileAttachment, "createdAt">,
  right: Pick<WorkOrderFileAttachment, "createdAt">,
) {
  return getAttachmentTime(right.createdAt) - getAttachmentTime(left.createdAt);
}

function getAttachmentTime(value: string): number {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function getFileExtension(fileName: string): string | null {
  const normalizedFileName = fileName.trim().toLowerCase();
  const lastDotIndex = normalizedFileName.lastIndexOf(".");
  if (lastDotIndex <= 0 || lastDotIndex === normalizedFileName.length - 1) {
    return null;
  }

  return normalizedFileName.slice(lastDotIndex + 1);
}

const categoryLabels: Record<WorkOrderFileCategory, string> = {
  image: "Photo / Image",
  document: "Document",
  other: "Other file",
};
