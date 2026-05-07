import "server-only";

import type { CollectionReference, DocumentData, Firestore } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/server/firebase";
import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { ProviderReceipt } from "@/modules/provider-runtime/domain/provider-receipt";
import type { ProviderWebhookEvent } from "@/modules/provider-runtime/domain/provider-webhook-event";
import type { ProviderReceiptRepository, ProviderWebhookEventRepository } from "./provider-receipt-repository";

const PROVIDER_RECEIPT_COLLECTION = "providerReceipts";
const PROVIDER_WEBHOOK_EVENT_COLLECTION = "providerWebhookEvents";

export interface ProviderRuntimeStorage {
  receipts: ProviderReceiptRepository;
  webhookEvents: ProviderWebhookEventRepository;
}

export function createFirestoreProviderRuntimeStorage(
  firestore: Firestore = getFirebaseAdminFirestore(),
): ProviderRuntimeStorage {
  return {
    receipts: createFirestoreProviderReceiptRepository(firestore.collection(PROVIDER_RECEIPT_COLLECTION)),
    webhookEvents: createFirestoreProviderWebhookEventRepository(firestore.collection(PROVIDER_WEBHOOK_EVENT_COLLECTION)),
  };
}

function createFirestoreProviderReceiptRepository(
  collection: CollectionReference<DocumentData>,
): ProviderReceiptRepository {
  return {
    newId() {
      return collection.doc().id;
    },
    async getById(id) {
      const snapshot = await collection.doc(id).get();
      return snapshot.exists ? ({ id: snapshot.id, ...(snapshot.data() as Omit<ProviderReceipt, "id">) }) : null;
    },
    async create(receipt) {
      await collection.doc(receipt.id).set(receipt);
    },
    async save(receipt) {
      await collection.doc(receipt.id).set(receipt);
    },
    async findByIdempotencyKey(input) {
      const snapshot = await collection
        .where("organizationId", "==", input.organizationId)
        .where("idempotencyKey", "==", input.idempotencyKey)
        .limit(1)
        .get();
      const doc = snapshot.docs[0];
      return doc ? ({ id: doc.id, ...(doc.data() as Omit<ProviderReceipt, "id">) }) : null;
    },
    async findLatestForAttempt(input) {
      const snapshot = await collection
        .where("organizationId", "==", input.organizationId)
        .where("deliveryAttemptId", "==", input.deliveryAttemptId)
        .orderBy("receivedAt", "desc")
        .limit(1)
        .get();
      const doc = snapshot.docs[0];
      return doc ? ({ id: doc.id, ...(doc.data() as Omit<ProviderReceipt, "id">) }) : null;
    },
    async listByOrganizationId(input) {
      let query = collection
        .where("organizationId", "==", input.organizationId)
        .orderBy("receivedAt", "desc")
        .limit(input.limit ?? 50);
      const snapshot = await query.get();
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<ProviderReceipt, "id">) }));
      return input.reconciliationStatus
        ? items.filter((item) => item.reconciliationStatus === input.reconciliationStatus)
        : items;
    },
    async listByDeliveryAttemptId(input) {
      const snapshot = await collection
        .where("organizationId", "==", input.organizationId)
        .where("deliveryAttemptId", "==", input.deliveryAttemptId)
        .orderBy("receivedAt", "desc")
        .limit(input.limit ?? 50)
        .get();
      return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<ProviderReceipt, "id">) }));
    },
  };
}

function createFirestoreProviderWebhookEventRepository(
  collection: CollectionReference<DocumentData>,
): ProviderWebhookEventRepository {
  return {
    newId() {
      return collection.doc().id;
    },
    async getById(id) {
      const snapshot = await collection.doc(id).get();
      return snapshot.exists ? ({ id: snapshot.id, ...(snapshot.data() as Omit<ProviderWebhookEvent, "id">) }) : null;
    },
    async create(event) {
      await collection.doc(event.id).set(event);
    },
    async save(event) {
      await collection.doc(event.id).set(event);
    },
    async findByIdempotencyKey(input) {
      const snapshot = await collection
        .where("organizationId", "==", input.organizationId)
        .where("idempotencyKey", "==", input.idempotencyKey)
        .limit(1)
        .get();
      const doc = snapshot.docs[0];
      return doc ? ({ id: doc.id, ...(doc.data() as Omit<ProviderWebhookEvent, "id">) }) : null;
    },
    async listByOrganizationId(input) {
      const snapshot = await collection
        .where("organizationId", "==", input.organizationId)
        .orderBy("receivedAt", "desc")
        .limit(input.limit ?? 50)
        .get();
      return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<ProviderWebhookEvent, "id">) }));
    },
  };
}
