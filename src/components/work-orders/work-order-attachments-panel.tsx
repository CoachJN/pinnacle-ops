"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { deleteObject, ref, uploadBytes } from "firebase/storage";
import { getFirebaseClientStorage } from "@/lib/firebase/client";
import {
  buildWorkOrderAttachmentStoragePath,
  formatWorkOrderAttachmentSizeLimit,
  getWorkOrderAttachmentValidationMessage,
  WORK_ORDER_ATTACHMENT_ACCEPT,
  WORK_ORDER_ATTACHMENT_MAX_SIZE_BYTES,
} from "@/lib/work-orders/attachments";
import { formatDateTime } from "./formatting";

interface WorkOrderAttachmentItem {
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
}

interface WorkOrderAttachmentsPanelProps {
  workOrderId: string;
  attachments: WorkOrderAttachmentItem[];
  canAddAttachment: boolean;
  onAttachmentsChange: (attachments: WorkOrderAttachmentItem[]) => void;
}

interface WorkOrderAttachmentsResponse {
  data?: {
    attachments?: WorkOrderAttachmentItem[];
  };
}

interface WorkOrderAttachmentCreateResponse {
  data?: {
    attachment?: WorkOrderAttachmentItem;
  };
}

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

export function WorkOrderAttachmentsPanel({
  workOrderId,
  attachments,
  canAddAttachment,
  onAttachmentsChange,
}: WorkOrderAttachmentsPanelProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function refreshAttachments() {
    const response = await fetch(`/api/work-orders/${workOrderId}/attachments`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as
      | WorkOrderAttachmentsResponse
      | ApiErrorResponse;

    if (!response.ok) {
      throw new Error(getApiErrorMessage(payload, "Unable to refresh attachments."));
    }

    onAttachmentsChange((payload as WorkOrderAttachmentsResponse).data?.attachments ?? []);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setFormError("Choose a file to upload.");
      return;
    }

    const validationMessage = getWorkOrderAttachmentValidationMessage({
      contentType: selectedFile.type,
      sizeBytes: selectedFile.size,
    });
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setSubmitError(null);

    const storagePath = buildWorkOrderAttachmentStoragePath({
      workOrderId,
      fileName: selectedFile.name,
    });
    const storageReference = ref(getFirebaseClientStorage(), storagePath);
    let metadataPersisted = false;

    try {
      await uploadBytes(storageReference, selectedFile, {
        contentType: selectedFile.type,
      });

      const response = await fetch(`/api/work-orders/${workOrderId}/attachments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: selectedFile.name,
          contentType: selectedFile.type,
          sizeBytes: selectedFile.size,
          storagePath,
        }),
      });
      const payload = (await response.json()) as
        | WorkOrderAttachmentCreateResponse
        | ApiErrorResponse;

      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "Unable to save attachment metadata."));
      }

      metadataPersisted = true;
      setSelectedFile(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      await refreshAttachments();
    } catch (error) {
      if (!metadataPersisted) {
        void deleteObject(storageReference).catch(() => undefined);
      }

      setSubmitError(
        error instanceof Error ? error.message : "Unable to upload attachment.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 px-6 py-5">
        <h2 className="text-lg font-semibold text-neutral-950">Attachments</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Files associated with the work order record.
        </p>
      </div>

      {canAddAttachment ? (
        <form className="border-b border-neutral-200 px-6 py-5" onSubmit={handleSubmit}>
          <label
            className="mb-2 block text-sm font-medium text-neutral-900"
            htmlFor={inputId}
          >
            Upload attachment
          </label>
          <input
            accept={WORK_ORDER_ATTACHMENT_ACCEPT}
            className="block w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm file:mr-4 file:rounded-full file:border-0 file:bg-neutral-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-50"
            disabled={isSubmitting}
            id={inputId}
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] ?? null);
              setFormError(null);
              setSubmitError(null);
            }}
            ref={inputRef}
            type="file"
          />
          <p className="mt-2 text-xs text-neutral-500">
            Allowed: PDF, JPG, PNG. Max size {formatWorkOrderAttachmentSizeLimit(
              WORK_ORDER_ATTACHMENT_MAX_SIZE_BYTES,
            )}.
          </p>
          {selectedFile ? (
            <p className="mt-2 text-sm text-neutral-600">
              Selected {selectedFile.name} ({formatFileSize(selectedFile.size)})
            </p>
          ) : null}
          {formError ? (
            <p className="mt-2 text-sm text-rose-700">{formError}</p>
          ) : null}
          {submitError ? (
            <p className="mt-2 text-sm text-rose-700">{submitError}</p>
          ) : null}
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-neutral-500">
              Uploads are stored in project storage and registered on the work order.
            </p>
            <button
              className="inline-flex items-center justify-center rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Uploading..." : "Add attachment"}
            </button>
          </div>
        </form>
      ) : null}

      {attachments.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-neutral-600">
            No attachments have been uploaded yet.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-200">
          {attachments.map((attachment) => (
            <article className="p-6" key={attachment.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-neutral-950">
                    {attachment.fileName}
                  </p>
                  <p className="mt-1 text-sm text-neutral-600">
                    {attachment.contentType}
                  </p>
                  <a
                    className="mt-3 inline-flex text-sm font-medium text-neutral-700 underline-offset-4 hover:text-neutral-950 hover:underline"
                    href={attachment.accessPath}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open attachment
                  </a>
                </div>
                <p className="text-xs text-neutral-500">
                  Uploaded {formatDateTime(attachment.createdAt)}
                </p>
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                <MetaItem label="Size" value={formatFileSize(attachment.sizeBytes)} />
                <MetaItem
                  label="Uploaded by"
                  value={attachment.uploadedByDisplayName}
                />
                <MetaItem label="Storage path" value={attachment.storagePath} />
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MetaItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </dt>
      <dd className="mt-2 break-all text-sm text-neutral-900">{value}</dd>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getApiErrorMessage(
  payload:
    | WorkOrderAttachmentsResponse
    | WorkOrderAttachmentCreateResponse
    | ApiErrorResponse,
  fallback: string,
): string {
  if ("error" in payload && payload.error?.message) {
    return payload.error.message;
  }

  return fallback;
}
