"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  browserLocalPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import type { AuthResponse, SignInFormStatus } from "@/lib/auth/auth-types";
import { getFirebaseClientAuth } from "@/lib/firebase/client";
import {
  APP_PATHS,
  AUTH_API_PATHS,
  AUTH_MESSAGES,
  AUTH_QUERY_PARAMS,
} from "@/lib/utils/constants";
import { isEmail } from "@/lib/validation/common";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<SignInFormStatus>("idle");
  const nextPath = useMemo(
    () => normalizeNextPath(searchParams.get(AUTH_QUERY_PARAMS.next)),
    [searchParams],
  );
  const isPending = status === "submitting";
  const isSuccess = status === "success";

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage(null);
    setStatus("idle");

    if (!isEmail(email)) {
      setErrorMessage(AUTH_MESSAGES.invalidEmail);
      setStatus("error");
      return;
    }

    setStatus("submitting");

    const auth = getFirebaseClientAuth();

    try {
      await setPersistence(auth, browserLocalPersistence);
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password,
      );
      const idToken = await credential.user.getIdToken(true);
      const response = await fetch(AUTH_API_PATHS.session, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const payload = (await response.json().catch(() => null)) as AuthResponse | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(readAuthErrorMessage(payload));
      }

      setStatus("success");
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      await signOut(auth).catch(() => undefined);
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : AUTH_MESSAGES.invalidCredentials,
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
        Email
        <input
          autoComplete="email"
          className="rounded-md border border-neutral-300 px-3 py-2 text-base text-neutral-950 outline-none transition focus:border-neutral-950"
          disabled={isPending}
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
          className="rounded-md border border-neutral-300 px-3 py-2 text-base text-neutral-950 outline-none transition focus:border-neutral-950"
          disabled={isPending}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>

      {isSuccess ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Sign-in successful. Redirecting to your workspace now.
        </p>
      ) : null}

      {errorMessage ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <button
        className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-500"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

function normalizeNextPath(nextPath: string | null): string {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return APP_PATHS.dashboard;
  }

  return nextPath;
}

function readAuthErrorMessage(payload: AuthResponse | null): string {
  if (payload && !payload.ok) {
    return payload.error.message;
  }

  return AUTH_MESSAGES.invalidCredentials;
}
