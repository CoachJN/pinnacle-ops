import type { ReactNode } from "react";
import { requireUserWithRole } from "@/lib/auth/guards";
import { APP_ROLES } from "@/lib/rbac/roles";
import { ClientShell } from "@/components/client-portal/client-shell";

export default async function ClientLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const currentUser = await requireUserWithRole([APP_ROLES.ClientUser] as const);

  return <ClientShell currentUser={currentUser}>{children}</ClientShell>;
}
