import "server-only";

import { readEnv } from "@/config/env";

export const serverEnv = {
  firebaseProjectId:
    readEnv("FIREBASE_PROJECT_ID") ?? readEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  firebaseClientEmail: readEnv("FIREBASE_CLIENT_EMAIL"),
  firebasePrivateKey: readEnv("FIREBASE_PRIVATE_KEY"),
  firebaseDatabaseURL: readEnv("FIREBASE_DATABASE_URL"),
  firestoreDatabaseId: readEnv("FIRESTORE_DATABASE_ID"),
} as const;
