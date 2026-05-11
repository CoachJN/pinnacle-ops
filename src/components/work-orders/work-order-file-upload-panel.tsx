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
import type { WorkOrderFileAttachment } from "./work-order-files-model";

interface WorkOrderFileUploadPanelProps {
  workOrderId: string;
  attachments: WorkOrderFileAttachment[];
  canAddAttachment: boolean;
  onAttachmentsChange: (attachments: WorkOrderFileAttachment[]) => void;
}

interface WorkOrderAttachmentsResponse {
  data?: {
    attachments?: WorkOrderFileAttachment[];
  };
}

interface WorkOrderAttachmentCreateResponse {
  data?: {
    attachment?: WorkOrderFileAttachment;
  };
}

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

export function WorkOrderFileUploadPanel({
  workOrderId,
  attachments,
  canAddAttachment,
  onAttachmentsChange,
}: WorkOrderFileUploadPanelProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function refreshAttachments() {
    const response = await fetch(
      `/api/work-orders/${workOrderId}/attachments`,
      {
        cache: "no-store",
      },
    );
    const payload = (await response.json()) as
      | WorkOrderAttachmentsResponse
      | ApiErrorResponse;

    if (!response.ok) {
      throw new Error(
        getApiErrorMessage(payload, "Unable to refresh attachments."),
      );
    }

    onAttachmentsChange(
      (payload as WorkOrderAttachmentsResponse).data?.attachments ?? [],
    );
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

      const response = await fetch(
        `/api/work-orders/${workOrderId}/attachments`,
        {
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
        },
      );
      const payload = (await response.json()) as
        | WorkOrderAttachmentCreateResponse
        | ApiErrorResponse;

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(payload, "Unable to save attachment metadata."),
        );
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

  if (!canAddAttachment) {
    return null;
  }

  return (
    <section className="border border-neutral-200 bg-white px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-base font-semibold text-neutral-950">Add file</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Attach photos, contractor documents, client files, completion proof,
            or manually uploaded quotes and invoices to this work order.
          </p>
          <p className="mt-3 text-xs text-neutral-500">
            Files added here are stored against this work order record.
          </p>
        </div>
        <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-700">
          {attachments.length} current file{attachments.length === 1 ? "" : "s"}
        </span>
      </div>

      <form
        className="mt-4 space-y-4 border-t border-neutral-200 pt-4"
        onSubmit={handleSubmit}
      >
        <div className="border border-dashed border-neutral-300 bg-neutral-50 px-4 py-4">
          <label
            className="block text-sm font-medium text-neutral-900"
            htmlFor={inputId}
          >
            Upload attachment
          </label>
          <input
            accept={WORK_ORDER_ATTACHMENT_ACCEPT}
            className="mt-3 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 file:mr-4 file:rounded-full file:border-0 file:bg-neutral-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-50"
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
          <p className="mt-3 text-xs text-neutral-500">
            Allowed: PDF, JPG, PNG. Max size{" "}
            {formatWorkOrderAttachmentSizeLimit(
              WORK_ORDER_ATTACHMENT_MAX_SIZE_BYTES,
            )}
            .
          </p>
        </div>

        {selectedFile ? (
          <p className="text-sm text-neutral-600">
            Selected {selectedFile.name} ({formatFileSize(selectedFile.size)})
          </p>
        ) : null}
        {formError ? (
          <p className="text-sm text-rose-700">{formError}</p>
        ) : null}
        {submitError ? (
          <p className="text-sm text-rose-700">{submitError}</p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-neutral-500">
            Use this workspace for files that operators need to locate quickly
            during execution.
          </p>
          <button
            className="inline-flex items-center justify-center rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Uploading..." : "Add file"}
          </button>
        </div>
      </form>
    </section>
  );
}

function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string" &&
    payload.error.message.trim()
  ) {
    return payload.error.message;
  }

  return fallback;
}

function formatFileSize(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = sizeBytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}
