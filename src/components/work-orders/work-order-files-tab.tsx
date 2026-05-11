"use client";

import { WorkOrderFileEmptyState } from "./work-order-file-empty-state";
import { WorkOrderFileTypeGroups } from "./work-order-file-type-groups";
import { WorkOrderFileUploadPanel } from "./work-order-file-upload-panel";
import {
  deriveWorkOrderFilesSummary,
  groupWorkOrderAttachmentsByType,
  type WorkOrderFileAttachment,
} from "./work-order-files-model";
import { WorkOrderFilesSummaryPanel } from "./work-order-files-summary-panel";

interface WorkOrderFilesTabProps {
  attachments: WorkOrderFileAttachment[];
  canAddAttachment: boolean;
  onAttachmentsChange: (attachments: WorkOrderFileAttachment[]) => void;
  workOrderId: string;
}

export function WorkOrderFilesTab({
  attachments,
  canAddAttachment,
  onAttachmentsChange,
  workOrderId,
}: WorkOrderFilesTabProps) {
  const summary = deriveWorkOrderFilesSummary(attachments);
  const groups = groupWorkOrderAttachmentsByType(attachments);

  return (
    <section
      aria-labelledby="work-order-tab-files"
      className="space-y-4"
      id="work-order-panel-files"
      role="tabpanel"
    >
      <WorkOrderFilesSummaryPanel summary={summary} />
      <WorkOrderFileUploadPanel
        attachments={attachments}
        canAddAttachment={canAddAttachment}
        onAttachmentsChange={onAttachmentsChange}
        workOrderId={workOrderId}
      />

      {summary.totalAttachments === 0 ? (
        <WorkOrderFileEmptyState />
      ) : (
        <WorkOrderFileTypeGroups groups={groups} />
      )}

      <section className="border-t border-neutral-200 pt-3">
        <h2 className="text-sm font-semibold text-neutral-950">
          File visibility
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          File visibility is controlled by the work order file permissions and
          portal rules.
        </p>
      </section>
    </section>
  );
}
