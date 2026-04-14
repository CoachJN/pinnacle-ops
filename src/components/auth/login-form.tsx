"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  browserLocalPersistence,
  setPersistence,
  signOut,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { APP_CONSTANTS } from "@/config/app";
import { getFirebaseClientAuth } from "@/lib/firebase";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextPath = useMemo(
    () => normalizeNextPath(searchParams.get("next")),
    [searchParams],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const auth = getFirebaseClientAuth();

    try {
      await setPersistence(auth, browserLocalPersistence);
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken(true);
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        throw new Error("Session creation failed.");
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      await signOut(auth).catch(() => undefined);
      setError("We could not sign you in. Check your email and password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
        Email
        <input
          autoComplete="email"
          className="rounded-md border border-neutral-300 px-3 py-2 text-base text-neutral-950 outline-none focus:border-neutral-950"
          disabled={isSubmitting}
          inputMode="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
        Password
        <input
          autoComplete="current-password"
          className="rounded-md border border-neutral-300 px-3 py-2 text-base text-neutral-950 outline-none focus:border-neutral-950"
          disabled={isSubmitting}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
      <button
        className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-500"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

function normalizeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return APP_CONSTANTS.defaultProtectedPath;
  }

  return value;
}
