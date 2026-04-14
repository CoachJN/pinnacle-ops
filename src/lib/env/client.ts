function readClientEnv(value: string | undefined): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export const clientEnv = {
  firebaseApiKey: readClientEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  firebaseAuthDomain: readClientEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  firebaseProjectId: readClientEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  firebaseStorageBucket: readClientEnv(
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  ),
  firebaseMessagingSenderId: readClientEnv(
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  ),
  firebaseAppId: readClientEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
} as const;
