"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import type { AuthenticatedUser } from "@/lib/auth/auth-types";
import { APP_ROLE_LABELS } from "@/lib/rbac/roles";
import { getExistingFirebaseClientApp, getFirebaseClientAuth } from "@/lib/firebase/client";
import {
  APP_PATHS,
  APP_SHELL_BRAND,
  AUTH_API_PATHS,
} from "@/lib/utils/constants";

interface TopbarProps {
  currentPageLabel: string;
  currentUser: AuthenticatedUser;
}

export function Topbar({ currentPageLabel, currentUser }: TopbarProps) {
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
    <header className="border-b border-neutral-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500 lg:hidden">
            {APP_SHELL_BRAND.companyName}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-semibold text-neutral-950">
              {currentPageLabel}
            </h1>
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
              {APP_ROLE_LABELS[currentUser.role]}
            </span>
          </div>
          <p className="mt-2 text-sm text-neutral-500">
            {currentUser.displayName ?? currentUser.email ?? "Authenticated user"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {errorMessage ? (
            <p className="text-sm text-red-700">{errorMessage}</p>
          ) : null}
          <button
            className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950 disabled:cursor-not-allowed disabled:text-neutral-400"
            disabled={isPending}
            onClick={handleSignOut}
            type="button"
          >
            {isPending ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>

      <div className="mt-3 lg:hidden">
        <p className="text-xs font-medium text-neutral-500">
          {APP_SHELL_BRAND.productName}
        </p>
      </div>
    </header>
  );
}
