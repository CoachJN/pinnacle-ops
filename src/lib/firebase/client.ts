import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { clientEnv } from "@/lib/env/client";
import type { FirebaseClientConfig } from "@/lib/firebase/config";

export function getFirebaseClientApp(): FirebaseApp {
  const existingApp = getApps()[0];

  if (existingApp) {
    return existingApp;
  }

  return initializeApp(readFirebaseClientConfig());
}

export function getFirebaseClientAuth(): Auth {
  return getAuth(getFirebaseClientApp());
}

export function getFirebaseClientFirestore(): Firestore {
  return getFirestore(getFirebaseClientApp());
}

export function getFirebaseClientStorage(): FirebaseStorage {
  return getStorage(getFirebaseClientApp());
}

export function getExistingFirebaseClientApp(): FirebaseApp | null {
  return getApps()[0] ?? null;
}

export { getApp as getNamedFirebaseClientApp };

function readFirebaseClientConfig(): FirebaseClientConfig {
  const apiKey = clientEnv.firebaseApiKey;
  const authDomain = clientEnv.firebaseAuthDomain;
  const projectId = clientEnv.firebaseProjectId;
  const appId = clientEnv.firebaseAppId;
  const missing = [
    ["NEXT_PUBLIC_FIREBASE_API_KEY", apiKey],
    ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", authDomain],
    ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", projectId],
    ["NEXT_PUBLIC_FIREBASE_APP_ID", appId],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing Firebase client config: ${missing.join(", ")}`);
  }

  return {
    apiKey: apiKey!,
    authDomain: authDomain!,
    projectId: projectId!,
    storageBucket: clientEnv.firebaseStorageBucket,
    messagingSenderId: clientEnv.firebaseMessagingSenderId,
    appId: appId!,
  };
}
