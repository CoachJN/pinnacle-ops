import type { ReactNode } from "react";
import type { AuthenticatedUser } from "@/lib/auth/auth-types";
import { ClientSidebarNav } from "@/components/client-portal/client-sidebar-nav";
import { ClientTopbar } from "@/components/client-portal/client-topbar";

interface ClientShellProps {
  children: ReactNode;
  currentUser: AuthenticatedUser;
}

export function ClientShell({ children, currentUser }: ClientShellProps) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ecfdf5_0%,#f8fafc_24%,#f8fafc_100%)] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="border-b border-emerald-100 bg-emerald-50/80 px-4 py-6 lg:border-b-0 lg:border-r lg:px-6">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
              Client Workspace
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Service Portal
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              A dedicated view for locations, work orders, and quote actions.
            </p>
          </div>

          <ClientSidebarNav />
        </aside>

        <div className="flex min-h-screen flex-col">
          <ClientTopbar currentUser={currentUser} />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
