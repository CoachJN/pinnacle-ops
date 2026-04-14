import "server-only";

type ServerEnvKey =
  | "NODE_ENV"
  | "FIREBASE_PROJECT_ID"
  | "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
  | "FIREBASE_CLIENT_EMAIL"
  | "FIREBASE_PRIVATE_KEY"
  | "FIREBASE_DATABASE_URL"
  | "FIREBASE_DATABASE_ID"
  | "FIRESTORE_DATABASE_ID"
  | "DEV_AUTH_ROLE"
  | "DEV_ORGANIZATION_ID";

function readServerEnv(name: ServerEnvKey): string | undefined {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

const nodeEnv = readServerEnv("NODE_ENV");

export const serverEnv = {
  nodeEnv: nodeEnv ?? "development",
  isProduction: nodeEnv === "production",
  firebaseProjectId:
    readServerEnv("FIREBASE_PROJECT_ID") ??
    readServerEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  firebaseClientEmail: readServerEnv("FIREBASE_CLIENT_EMAIL"),
  firebasePrivateKey: readServerEnv("FIREBASE_PRIVATE_KEY"),
  firebaseDatabaseURL: readServerEnv("FIREBASE_DATABASE_URL"),
  firestoreDatabaseId:
    readServerEnv("FIRESTORE_DATABASE_ID") ??
    readServerEnv("FIREBASE_DATABASE_ID"),
  devAuthRole: readServerEnv("DEV_AUTH_ROLE"),
  devOrganizationId: readServerEnv("DEV_ORGANIZATION_ID"),
} as const;
