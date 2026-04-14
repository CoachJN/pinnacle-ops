import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { redirectIfCannotAccessAppShell } from "@/lib/auth/guards";

export default async function AppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  // Canonical authenticated application surface. Prefer new internal pages here.
  const currentUser = await redirectIfCannotAccessAppShell();

  return <AppShell currentUser={currentUser}>{children}</AppShell>;
}
