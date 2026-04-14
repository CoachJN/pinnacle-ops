import "server-only";

import type { DocumentData, Firestore } from "firebase-admin/firestore";

import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type {
  CreateWorkOrderAttachmentMetadataDto,
  WorkOrderAttachment,
} from "@/modules/work-orders";
import { getFirebaseAdminFirestore } from "@/server/firebase";

import {
  buildWorkOrderAttachmentCreateModel,
  getWorkOrderAttachmentsCollection,
  parseWorkOrderAttachmentDocument,
  serializeWorkOrderAttachmentForFirestore,
  workOrderExists,
} from "./work-order.firestore";

export interface CreateWorkOrderAttachmentRepositoryInput {
  id?: EntityId;
  workOrderId: EntityId;
  data: CreateWorkOrderAttachmentMetadataDto;
  now?: IsoDateTimeString;
}

export interface WorkOrderAttachmentRepository {
  createAttachment(
    input: CreateWorkOrderAttachmentRepositoryInput,
  ): Promise<WorkOrderAttachment | null>;
  listAttachmentsByWorkOrderId(
    workOrderId: EntityId,
  ): Promise<WorkOrderAttachment[]>;
}

export function createWorkOrderAttachmentRepository(
  firestore: Firestore = getFirebaseAdminFirestore(),
): WorkOrderAttachmentRepository {
  return new FirestoreWorkOrderAttachmentRepository(firestore);
}

class FirestoreWorkOrderAttachmentRepository
  implements WorkOrderAttachmentRepository
{
  constructor(private readonly firestore: Firestore) {}

  async createAttachment(
    input: CreateWorkOrderAttachmentRepositoryInput,
  ): Promise<WorkOrderAttachment | null> {
    const normalizedWorkOrderId = input.workOrderId.trim();
    if (!normalizedWorkOrderId) {
      return null;
    }

    if (!(await workOrderExists(this.firestore, normalizedWorkOrderId))) {
      return null;
    }

    const collection = getWorkOrderAttachmentsCollection(
      this.firestore,
      normalizedWorkOrderId,
    );
    const id = input.id?.trim() || collection.doc().id;
    const attachment = buildWorkOrderAttachmentCreateModel({
      id,
      workOrderId: normalizedWorkOrderId,
      data: input.data,
      now: input.now ?? new Date().toISOString(),
    });

    await collection
      .doc(attachment.id)
      .create(
        serializeWorkOrderAttachmentForFirestore(attachment) as DocumentData,
      );

    return attachment;
  }

  async listAttachmentsByWorkOrderId(
    workOrderId: EntityId,
  ): Promise<WorkOrderAttachment[]> {
    const normalizedWorkOrderId = workOrderId.trim();
    if (!normalizedWorkOrderId) {
      return [];
    }

    const snapshot = await getWorkOrderAttachmentsCollection(
      this.firestore,
      normalizedWorkOrderId,
    )
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs.map((document) =>
      parseWorkOrderAttachmentDocument(
        document.id,
        normalizedWorkOrderId,
        document.data(),
      ),
    );
  }
}
