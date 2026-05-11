import type { ReactNode } from "react";

import { WorkOrderAttachmentGallery } from "./work-order-attachment-gallery";
import type { WorkOrderFileTypeGroups as WorkOrderFileTypeGroupsModel } from "./work-order-files-model";

interface WorkOrderFileTypeGroupsProps {
  groups: WorkOrderFileTypeGroupsModel;
}

export function WorkOrderFileTypeGroups({
  groups,
}: WorkOrderFileTypeGroupsProps) {
  return (
    <section className="space-y-4">
      {groups.images.length > 0 ? (
        <FileGroupSection
          count={groups.images.length}
          description="Photos and image files uploaded against this work order."
          title="Photos / Images"
        >
          <WorkOrderAttachmentGallery
            attachments={groups.images}
            category="image"
          />
        </FileGroupSection>
      ) : null}

      {groups.documents.length > 0 ? (
        <FileGroupSection
          count={groups.documents.length}
          description="PDFs and working documents that operators may need during execution."
          title="Documents"
        >
          <WorkOrderAttachmentGallery
            attachments={groups.documents}
            category="document"
          />
        </FileGroupSection>
      ) : null}

      {groups.otherFiles.length > 0 ? (
        <FileGroupSection
          count={groups.otherFiles.length}
          description="Other attached files that do not classify as images or documents."
          title="Other Files"
        >
          <WorkOrderAttachmentGallery
            attachments={groups.otherFiles}
            category="other"
          />
        </FileGroupSection>
      ) : null}
    </section>
  );
}

function FileGroupSection({
  children,
  count,
  description,
  title,
}: {
  children: ReactNode;
  count: number;
  description: string;
  title: string;
}) {
  return (
    <section className="space-y-3 border-t border-neutral-200 pt-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
          <p className="mt-1 text-sm text-neutral-600">{description}</p>
        </div>
        <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-700">
          {count} file{count === 1 ? "" : "s"}
        </span>
      </div>
      {children}
    </section>
  );
}
