"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import type { AuthenticatedUser } from "@/lib/auth/auth-types";
import type { NavigationItem } from "@/types/navigation";
import { APP_ROLE_LABELS } from "@/lib/rbac/roles";
import { getExistingFirebaseClientApp, getFirebaseClientAuth } from "@/lib/firebase/client";
import {
  APP_PATHS,
  APP_SHELL_BRAND,
  AUTH_API_PATHS,
} from "@/lib/utils/constants";

interface TopbarProps {
  currentUser: AuthenticatedUser;
  navigationItems: readonly NavigationItem[];
}

export function Topbar({ currentUser, navigationItems }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeNavigationItem = getActiveNavigationItem(pathname, navigationItems);
  const currentPageLabel = activeNavigationItem?.label ?? "Workspace";

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
    <header className="border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-start lg:px-8">
        <div className="min-w-0">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
              {APP_SHELL_BRAND.companyName}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-neutral-950">
              {APP_SHELL_BRAND.productName}
            </h2>
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-start lg:justify-center">
          <div className="flex flex-wrap items-center gap-3 lg:justify-center">
            <h1 className="text-lg font-semibold text-neutral-950">
              {currentPageLabel}
            </h1>
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 lg:items-end">
          {errorMessage ? (
            <p className="text-sm text-red-700">{errorMessage}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
              {APP_ROLE_LABELS[currentUser.role]}
            </span>
            <p className="text-sm text-neutral-500">
              {currentUser.displayName ?? currentUser.email ?? "Authenticated user"}
            </p>
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
      </div>
    </header>
  );
}

function getActiveNavigationItem(
  currentPath: string,
  items: readonly NavigationItem[],
): NavigationItem | undefined {
  return items.find((item) =>
    item.match === "prefix"
      ? currentPath.startsWith(item.href)
      : currentPath === item.href,
  );
}
