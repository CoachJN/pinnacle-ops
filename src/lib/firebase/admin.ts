import "server-only";

import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getFirebaseAdminConfig } from "@/lib/firebase/config";

export function getFirebaseAdminApp(): App {
  const existingApp = getApps()[0];

  if (existingApp) {
    return existingApp;
  }

  const config = getFirebaseAdminConfig();

  return initializeApp({
    credential: getFirebaseAdminCredential(),
    databaseURL: config.databaseURL,
    projectId: config.projectId,
  });
}

export function getFirebaseAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminFirestore(): Firestore {
  const config = getFirebaseAdminConfig();

  if (config.firestoreDatabaseId) {
    return getFirestore(getFirebaseAdminApp(), config.firestoreDatabaseId);
  }

  return getFirestore(getFirebaseAdminApp());
}

function getFirebaseAdminCredential() {
  const config = getFirebaseAdminConfig();

  if (config.projectId && config.clientEmail && config.privateKey) {
    return cert({
      projectId: config.projectId,
      clientEmail: config.clientEmail,
      privateKey: config.privateKey.replace(/\\n/g, "\n"),
    });
  }

  return applicationDefault();
}
