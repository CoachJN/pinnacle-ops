import type { ReactNode } from "react";
import { headers } from "next/headers";
import type { AuthenticatedUser } from "@/lib/auth/auth-types";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import { Topbar } from "@/components/app-shell/topbar";
import { APP_PRIMARY_NAV_ITEMS } from "@/lib/navigation/nav-config";
import { canAccessAppShell, getNavigationItemsForRole } from "@/lib/rbac/checks";
import { APP_PATHS, APP_SHELL_BRAND } from "@/lib/utils/constants";
import { AuthorizationError } from "@/lib/utils/errors";
import type { NavigationItem } from "@/types/navigation";

interface AppShellProps {
  children: ReactNode;
  currentUser: AuthenticatedUser;
}

export async function AppShell({ children, currentUser }: AppShellProps) {
  // Canonical authenticated application shell for current internal/client-facing
  // routes that are not contractor-portal specific.
  if (!canAccessAppShell(currentUser)) {
    throw new AuthorizationError(
      "You do not have access to the authenticated application shell.",
    );
  }

  const requestHeaders = await headers();
  const currentPath = requestHeaders.get("x-pathname") ?? APP_PATHS.dashboard;
  const navigationItems = getNavigationItemsForRole(
    currentUser,
    APP_PRIMARY_NAV_ITEMS,
  );
  const activeNavigationItem = getActiveNavigationItem(currentPath, navigationItems);
  const currentPageLabel = activeNavigationItem?.label ?? "Workspace";

  return (
    <div className="flex min-h-screen bg-neutral-100 text-neutral-950">
      <aside className="hidden w-72 border-r border-neutral-200 bg-white lg:flex lg:flex-col">
        <div className="border-b border-neutral-200 px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
            {APP_SHELL_BRAND.companyName}
          </p>
          <h2 className="mt-2 text-lg font-semibold">
            {APP_SHELL_BRAND.productName}
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            Authenticated workspace for operations teams and partner users.
          </p>
        </div>
        <div className="flex-1 px-4 py-6">
          <SidebarNav currentPath={currentPath} items={navigationItems} />
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar currentPageLabel={currentPageLabel} currentUser={currentUser} />
        <div className="border-b border-neutral-200 bg-white px-4 py-3 lg:hidden">
          <SidebarNav
            currentPath={currentPath}
            items={navigationItems}
            orientation="horizontal"
          />
        </div>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
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
