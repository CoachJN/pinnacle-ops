import Link from "next/link";
import type { ReactNode } from "react";
import type { AuthenticatedUser } from "@/lib/auth/auth-types";
import { LogoutButton } from "@/components/auth/logout-button";

export function ContractorShell({
  children,
  currentUser,
}: {
  children: ReactNode;
  currentUser: AuthenticatedUser;
}) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ecfeff_0%,#f8fafc_28%,#f8fafc_100%)] text-neutral-950">
      <header className="border-b border-cyan-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">
              Contractor Workspace
            </p>
            <Link href="/contractor/dashboard" className="mt-2 inline-block text-2xl font-semibold tracking-tight text-slate-950">
              Pinnacle Ops
            </Link>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Assigned work, quote submission, and completion updates without the
              internal operations tooling.
            </p>
            <nav className="mt-4 flex flex-wrap gap-2" aria-label="Contractor navigation">
              <Link href="/contractor/dashboard" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:text-slate-950">
                Dashboard
              </Link>
              <Link href="/contractor/work-orders" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:text-slate-950">
                Assigned Work
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-cyan-100 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-900">
              {currentUser.displayName ?? currentUser.email ?? "Contractor user"}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
