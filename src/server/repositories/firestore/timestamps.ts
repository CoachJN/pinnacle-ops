import "server-only";

import { Timestamp } from "firebase-admin/firestore";
import type { IsoDateTimeString } from "@/types/entity";

export type FirestoreTimestampValue = Timestamp | Date | IsoDateTimeString;

export function toFirestoreTimestamp(value: FirestoreTimestampValue): Timestamp {
  if (value instanceof Timestamp) {
    return value;
  }

  if (value instanceof Date) {
    assertValidDate(value);
    return Timestamp.fromDate(value);
  }

  const date = new Date(value);
  assertValidDate(date);
  return Timestamp.fromDate(date);
}

export function toNullableFirestoreTimestamp(
  value: FirestoreTimestampValue | null | undefined,
): Timestamp | null {
  return value == null ? null : toFirestoreTimestamp(value);
}

export function toIsoDateTime(value: unknown, fieldName: string): IsoDateTimeString {
  const date = toDate(value, fieldName);
  return date.toISOString();
}

export function toNullableIsoDateTime(
  value: unknown,
  fieldName: string,
): IsoDateTimeString | null {
  if (value == null) {
    return null;
  }

  return toIsoDateTime(value, fieldName);
}

function toDate(value: unknown, fieldName: string): Date {
  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (value instanceof Date) {
    assertValidDate(value, fieldName);
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    assertValidDate(date, fieldName);
    return date;
  }

  throw new TypeError(`Invalid Firestore timestamp for ${fieldName}.`);
}

function assertValidDate(date: Date, fieldName = "timestamp"): void {
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`Invalid ${fieldName}.`);
  }
}
