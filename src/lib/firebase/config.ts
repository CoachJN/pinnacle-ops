import "server-only";

import { serverEnv } from "@/lib/env/server";

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

export interface FirebaseAdminConfig {
  projectId?: string;
  storageBucket?: string;
  clientEmail?: string;
  privateKey?: string;
  databaseURL?: string;
  firestoreDatabaseId?: string;
}

export function getFirebaseAdminConfig(): FirebaseAdminConfig {
  const config: FirebaseAdminConfig = {
    projectId: serverEnv.firebaseProjectId,
    storageBucket: serverEnv.firebaseStorageBucket,
    clientEmail: serverEnv.firebaseClientEmail,
    privateKey: serverEnv.firebasePrivateKey,
    databaseURL: serverEnv.firebaseDatabaseURL,
    firestoreDatabaseId: serverEnv.firestoreDatabaseId,
  };
  const credentialFields = [
    ["FIREBASE_PROJECT_ID", config.projectId],
    ["FIREBASE_CLIENT_EMAIL", config.clientEmail],
    ["FIREBASE_PRIVATE_KEY", config.privateKey],
  ] as const;
  const providedCredentialFields = credentialFields.filter(([, value]) => value);

  if (
    providedCredentialFields.length > 0 &&
    providedCredentialFields.length < credentialFields.length
  ) {
    const missingCredentialFields = credentialFields
      .filter(([, value]) => !value)
      .map(([name]) => name);

    throw new Error(
      `Incomplete Firebase admin config. Missing: ${missingCredentialFields.join(", ")}`,
    );
  }

  return config;
}
