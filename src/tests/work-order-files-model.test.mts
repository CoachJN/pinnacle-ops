import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveWorkOrderFileAttachment,
  deriveWorkOrderFilesSummary,
  formatWorkOrderFilesTabLabel,
  groupWorkOrderAttachmentsByType,
  type WorkOrderFileAttachment,
} from "@/components/work-orders/work-order-files-model";

function makeAttachment(
  overrides: Partial<WorkOrderFileAttachment> = {},
): WorkOrderFileAttachment {
  return {
    id: overrides.id ?? "attachment-1",
    workOrderId: overrides.workOrderId ?? "wo-1",
    fileName: overrides.fileName ?? "attachment.jpg",
    contentType: overrides.contentType ?? "image/jpeg",
    sizeBytes: overrides.sizeBytes ?? 1024,
    storagePath: overrides.storagePath ?? "work-orders/wo-1/attachments/attachment.jpg",
    uploadedBy: overrides.uploadedBy ?? "user-1",
    uploadedByDisplayName: overrides.uploadedByDisplayName ?? "Jordan Ops",
    createdAt: overrides.createdAt ?? "2026-05-08T10:00:00.000Z",
    accessPath: overrides.accessPath ?? "/api/work-orders/wo-1/attachments/attachment-1/content",
    description: overrides.description,
    notes: overrides.notes,
  };
}

test("files summary handles zero attachments", () => {
  const summary = deriveWorkOrderFilesSummary([]);

  assert.deepEqual(summary, {
    totalAttachments: 0,
    imageCount: 0,
    documentCount: 0,
    otherCount: 0,
    mostRecentUploadAt: null,
  });
  assert.equal(formatWorkOrderFilesTabLabel(summary.totalAttachments), "Files (0)");
});

test("files summary counts image attachments", () => {
  const attachments = [
    makeAttachment({ id: "attachment-1", fileName: "before.jpg", contentType: "image/jpeg" }),
    makeAttachment({ id: "attachment-2", fileName: "after.png", contentType: "image/png" }),
  ];

  const summary = deriveWorkOrderFilesSummary(attachments);
  const groups = groupWorkOrderAttachmentsByType(attachments);

  assert.equal(summary.totalAttachments, 2);
  assert.equal(summary.imageCount, 2);
  assert.equal(summary.documentCount, 0);
  assert.equal(summary.otherCount, 0);
  assert.equal(groups.images.length, 2);
  assert.equal(groups.documents.length, 0);
  assert.equal(groups.otherFiles.length, 0);
});

test("files summary counts pdf and document attachments", () => {
  const attachments = [
    makeAttachment({
      id: "attachment-1",
      fileName: "proposal.pdf",
      contentType: "application/pdf",
    }),
    makeAttachment({
      id: "attachment-2",
      fileName: "scope.docx",
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
  ];

  const summary = deriveWorkOrderFilesSummary(attachments);

  assert.equal(summary.totalAttachments, 2);
  assert.equal(summary.imageCount, 0);
  assert.equal(summary.documentCount, 2);
  assert.equal(summary.otherCount, 0);
});

test("files summary groups mixed attachment types", () => {
  const attachments = [
    makeAttachment({ id: "image-1", fileName: "photo.jpg", contentType: "image/jpeg" }),
    makeAttachment({
      id: "document-1",
      fileName: "invoice.pdf",
      contentType: "application/pdf",
    }),
    makeAttachment({
      id: "other-1",
      fileName: "archive.zip",
      contentType: "application/zip",
    }),
  ];

  const summary = deriveWorkOrderFilesSummary(attachments);
  const groups = groupWorkOrderAttachmentsByType(attachments);

  assert.equal(summary.totalAttachments, 3);
  assert.equal(summary.imageCount, 1);
  assert.equal(summary.documentCount, 1);
  assert.equal(summary.otherCount, 1);
  assert.equal(groups.images[0]?.id, "image-1");
  assert.equal(groups.documents[0]?.id, "document-1");
  assert.equal(groups.otherFiles[0]?.id, "other-1");
  assert.equal(formatWorkOrderFilesTabLabel(summary.totalAttachments), "Files (3)");
});

test("files model falls back unknown attachment types safely", () => {
  const attachment = deriveWorkOrderFileAttachment(
    makeAttachment({
      fileName: "payload",
      contentType: "",
    }),
  );

  assert.equal(attachment.category, "other");
  assert.equal(attachment.fileTypeLabel, "Unknown file type");
});

test("files summary derives the most recent upload", () => {
  const attachments = [
    makeAttachment({
      id: "attachment-1",
      createdAt: "2026-05-07T10:00:00.000Z",
    }),
    makeAttachment({
      id: "attachment-2",
      createdAt: "2026-05-08T12:30:00.000Z",
    }),
    makeAttachment({
      id: "attachment-3",
      createdAt: "2026-05-08T08:00:00.000Z",
    }),
  ];

  const summary = deriveWorkOrderFilesSummary(attachments);
  const groups = groupWorkOrderAttachmentsByType(attachments);

  assert.equal(summary.mostRecentUploadAt, "2026-05-08T12:30:00.000Z");
  assert.equal(groups.images[0]?.id, "attachment-2");
});
