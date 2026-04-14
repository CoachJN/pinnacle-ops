import { readEnv } from "@/config/env";

export const publicEnv = {
  firebaseApiKey: readEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
  firebaseAuthDomain: readEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  firebaseProjectId: readEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  firebaseStorageBucket: readEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  firebaseMessagingSenderId: readEnv(
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  ),
  firebaseAppId: readEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
} as const;

