import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import type { MockCurrentUser } from "@/lib/permissions/mock-current-user";
import { getVisibleNavigationForRole } from "@/lib/permissions/navigation-permissions";
import { INTERNAL_ROLE_OPTIONS } from "@/lib/permissions/roles";
import { getSafeAuthContext } from "@/server/auth";

export function InternalShell({
  children,
  currentUser,
}: {
  children: ReactNode;
  currentUser: MockCurrentUser;
}) {
  const navigation = getVisibleNavigationForRole(currentUser.role);

  return (
    <div className="min-h-screen bg-stone-50 text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <Link href={`/dashboard?role=${currentUser.role}`} className="text-xl font-semibold">
              Pinnacle
            </Link>
            <p className="mt-1 text-sm text-neutral-600">
              Internal work order operations
            </p>
            <nav className="mt-3 flex flex-wrap gap-2" aria-label="Internal navigation">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-500"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AuthSummary />
            <span className="rounded-md border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-700">
              Demo role: {currentUser.roleLabel}
            </span>
            <nav className="flex flex-wrap gap-2" aria-label="Mock role switcher">
              {INTERNAL_ROLE_OPTIONS.map((option) => (
                <Link
                  key={option.role}
                  href={`/dashboard?role=${option.role}`}
                  className={
                    option.role === currentUser.role
                      ? "rounded-md bg-neutral-950 px-3 py-2 text-sm font-medium text-white"
                      : "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-500"
                  }
                >
                  {option.label}
                </Link>
              ))}
              <Link
                href="/contractor/dashboard"
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-500"
              >
                Contractor
              </Link>
              <LogoutButton />
            </nav>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

async function AuthSummary() {
  const authContext = await getSafeAuthContext();
  const label =
    authContext?.profile?.displayName ??
    authContext?.identity.displayName ??
    authContext?.profile?.email ??
    authContext?.identity.email ??
    "Authenticated";

  return (
    <span className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
      {label}
    </span>
  );
}
