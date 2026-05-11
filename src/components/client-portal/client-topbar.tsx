"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import type { AuthenticatedUser } from "@/lib/auth/auth-types";
import { getExistingFirebaseClientApp, getFirebaseClientAuth } from "@/lib/firebase/client";
import { APP_PATHS, AUTH_API_PATHS } from "@/lib/utils/constants";

interface ClientTopbarProps {
  currentUser: AuthenticatedUser;
}

export function ClientTopbar({ currentUser }: ClientTopbarProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSignOut(): void {
    setErrorMessage(null);

    startTransition(async () => {
      try {
        await fetch(AUTH_API_PATHS.logout, { method: "POST" });

        if (getExistingFirebaseClientApp()) {
          await signOut(getFirebaseClientAuth());
        }

        router.replace(APP_PATHS.signIn);
        router.refresh();
      } catch {
        setErrorMessage("Unable to sign out cleanly.");
      }
    });
  }

  return (
    <header className="border-b border-emerald-100 bg-white/90 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
            PinnOps Client Portal
          </p>
          <h1 className="mt-2 text-lg font-semibold text-slate-950">
            {currentUser.displayName ?? currentUser.email ?? "Client user"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Service visibility, location updates, and quote responses.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {errorMessage ? (
            <p className="text-sm text-rose-700">{errorMessage}</p>
          ) : null}
          <button
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-500 hover:text-slate-950 disabled:cursor-not-allowed disabled:text-slate-400"
            disabled={isPending}
            onClick={handleSignOut}
            type="button"
          >
            {isPending ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>
    </header>
  );
}
