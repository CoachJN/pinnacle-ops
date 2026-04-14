import "server-only";

import type { DocumentData, Firestore } from "firebase-admin/firestore";

import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type {
  CreateWorkOrderNoteDto,
  WorkOrderNote,
} from "@/modules/work-orders";
import { getFirebaseAdminFirestore } from "@/server/firebase";

import {
  buildWorkOrderNoteCreateModel,
  getWorkOrderNotesCollection,
  parseWorkOrderNoteDocument,
  serializeWorkOrderNoteForFirestore,
  workOrderExists,
} from "./work-order.firestore";

export interface CreateWorkOrderNoteRepositoryInput {
  id?: EntityId;
  workOrderId: EntityId;
  data: CreateWorkOrderNoteDto;
  now?: IsoDateTimeString;
}

export interface WorkOrderNoteRepository {
  createNote(input: CreateWorkOrderNoteRepositoryInput): Promise<WorkOrderNote | null>;
  listNotesByWorkOrderId(workOrderId: EntityId): Promise<WorkOrderNote[]>;
}

export function createWorkOrderNoteRepository(
  firestore: Firestore = getFirebaseAdminFirestore(),
): WorkOrderNoteRepository {
  return new FirestoreWorkOrderNoteRepository(firestore);
}

class FirestoreWorkOrderNoteRepository implements WorkOrderNoteRepository {
  constructor(private readonly firestore: Firestore) {}

  async createNote(
    input: CreateWorkOrderNoteRepositoryInput,
  ): Promise<WorkOrderNote | null> {
    const normalizedWorkOrderId = input.workOrderId.trim();
    if (!normalizedWorkOrderId) {
      return null;
    }

    if (!(await workOrderExists(this.firestore, normalizedWorkOrderId))) {
      return null;
    }

    const collection = getWorkOrderNotesCollection(
      this.firestore,
      normalizedWorkOrderId,
    );
    const id = input.id?.trim() || collection.doc().id;
    const note = buildWorkOrderNoteCreateModel({
      id,
      workOrderId: normalizedWorkOrderId,
      data: input.data,
      now: input.now ?? new Date().toISOString(),
    });

    await collection
      .doc(note.id)
      .create(serializeWorkOrderNoteForFirestore(note) as DocumentData);

    return note;
  }

  async listNotesByWorkOrderId(workOrderId: EntityId): Promise<WorkOrderNote[]> {
    const normalizedWorkOrderId = workOrderId.trim();
    if (!normalizedWorkOrderId) {
      return [];
    }

    const snapshot = await getWorkOrderNotesCollection(
      this.firestore,
      normalizedWorkOrderId,
    )
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs.map((document) =>
      parseWorkOrderNoteDocument(
        document.id,
        normalizedWorkOrderId,
        document.data(),
      ),
    );
  }
}
