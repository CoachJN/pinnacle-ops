import type { ReactNode } from "react";
import type { AuthenticatedUser } from "@/lib/auth/auth-types";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import { Topbar } from "@/components/app-shell/topbar";
import { APP_PRIMARY_NAV_ITEMS } from "@/lib/navigation/nav-config";
import { canAccessAppShell, getNavigationItemsForRole } from "@/lib/rbac/checks";
import { AuthorizationError } from "@/lib/utils/errors";

interface AppShellProps {
  children: ReactNode;
  currentUser: AuthenticatedUser;
}

export function AppShell({ children, currentUser }: AppShellProps) {
  // Canonical authenticated application shell for current internal/client-facing
  // routes that are not contractor-portal specific.
  if (!canAccessAppShell(currentUser)) {
    throw new AuthorizationError(
      "You do not have access to the authenticated application shell.",
    );
  }

  const navigationItems = getNavigationItemsForRole(
    currentUser,
    APP_PRIMARY_NAV_ITEMS,
  );

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-950">
      <Topbar currentUser={currentUser} navigationItems={navigationItems} />

      <div className="flex min-h-[calc(100vh-1px)]">
        <aside className="hidden w-72 border-r border-neutral-200 bg-white lg:flex lg:flex-col">
          <div className="flex-1 px-4 py-6">
            <SidebarNav items={navigationItems} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-neutral-200 bg-white px-4 py-3 lg:hidden">
            <SidebarNav
              items={navigationItems}
              orientation="horizontal"
            />
          </div>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
