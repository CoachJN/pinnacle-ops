import Link from "next/link";
import type { ReactNode } from "react";
import type { MockContractorCurrentUser } from "@/lib/permissions/contractor-session";

export function ContractorShell({
  children,
  currentUser,
}: {
  children: ReactNode;
  currentUser: MockContractorCurrentUser;
}) {
  // Contractor-only shell. Keep admin management UI out of this boundary.
  const query = `contractorId=${currentUser.contractorId}`;

  return (
    <div className="min-h-screen bg-zinc-50 text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <Link href={`/contractor/dashboard?${query}`} className="text-xl font-semibold">
              Pinnacle
            </Link>
            <p className="mt-1 text-sm text-neutral-600">Contractor workspace</p>
            <nav className="mt-3 flex flex-wrap gap-2" aria-label="Contractor navigation">
              <Link href={`/contractor/dashboard?${query}`} className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-500">
                Dashboard
              </Link>
              <Link href={`/contractor/work-orders?${query}`} className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-500">
                Assigned Work
              </Link>
            </nav>
          </div>
          <span className="rounded-md border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-700">
            Testing as {currentUser.roleLabel}
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
