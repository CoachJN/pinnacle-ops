import type { ReactNode } from "react";
import { requireUserWithRole } from "@/lib/auth/guards";
import { APP_ROLES } from "@/lib/rbac/roles";
import { ContractorShell } from "@/components/contractor-portal/contractor-shell";

export default async function ContractorLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const currentUser = await requireUserWithRole([APP_ROLES.ContractorUser] as const);

  return <ContractorShell currentUser={currentUser}>{children}</ContractorShell>;
}
