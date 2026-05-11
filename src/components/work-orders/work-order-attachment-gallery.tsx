import { formatDateTime } from "./formatting";
import { WorkOrderCompactRow } from "./work-order-compact-row";
import type {
  DerivedWorkOrderFileAttachment,
  WorkOrderFileCategory,
} from "./work-order-files-model";

interface WorkOrderAttachmentGalleryProps {
  attachments: DerivedWorkOrderFileAttachment[];
  category: WorkOrderFileCategory;
}

export function WorkOrderAttachmentGallery({
  attachments,
  category,
}: WorkOrderAttachmentGalleryProps) {
  if (category === "image") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {attachments.map((attachment) => (
          <article
            className="overflow-hidden border border-neutral-200 bg-white"
            key={attachment.id}
          >
            <div className="flex aspect-[4/3] items-end border-b border-neutral-200 bg-[linear-gradient(135deg,#f6f7f5,#ece8df)] p-4">
              <div className="border border-white/70 bg-white/80 px-3 py-2 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                  {attachment.fileTypeLabel}
                </p>
                <p className="mt-1 text-sm font-medium text-neutral-950">
                  {attachment.categoryLabel}
                </p>
              </div>
            </div>
            <div className="p-4">
              <AttachmentBody attachment={attachment} showInlineAction />
            </div>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => (
        <article
          className="border border-neutral-200 bg-white px-3 py-3"
          key={attachment.id}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <AttachmentBody attachment={attachment} />
            </div>
            <div className="hidden lg:block">
              <FileAction attachment={attachment} />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function AttachmentBody({
  attachment,
  showInlineAction = false,
}: {
  attachment: DerivedWorkOrderFileAttachment;
  showInlineAction?: boolean;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="min-w-0 text-sm font-semibold text-neutral-950">
          <span className="break-all">{attachment.fileName}</span>
        </h3>
        <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-600">
          {attachment.fileTypeLabel}
        </span>
      </div>

      <dl className="mt-3 grid gap-x-5 gap-y-1 border-t border-neutral-200 pt-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetaItem
          label="Uploaded"
          value={formatDateTime(attachment.createdAt)}
        />
        <MetaItem
          label="Uploaded by"
          value={attachment.uploadedByDisplayName.trim() || "Unknown uploader"}
        />
        <MetaItem label="Size" value={formatFileSize(attachment.sizeBytes)} />
        <MetaItem label="Type group" value={attachment.categoryLabel} />
      </dl>

      {attachment.note ? (
        <p className="mt-3 text-sm text-neutral-600">{attachment.note}</p>
      ) : null}

      <div className={showInlineAction ? "mt-3" : "mt-3 lg:hidden"}>
        <FileAction attachment={attachment} />
      </div>
    </>
  );
}

function FileAction({
  attachment,
}: {
  attachment: Pick<DerivedWorkOrderFileAttachment, "accessPath" | "fileName">;
}) {
  return (
    <a
      aria-label={`Open or download ${attachment.fileName}`}
      className="inline-flex items-center justify-center rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
      href={attachment.accessPath}
      rel="noreferrer"
      target="_blank"
    >
      Open / download
    </a>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return <WorkOrderCompactRow label={label} value={value} />;
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
