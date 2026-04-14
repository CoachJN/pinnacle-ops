import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { redirectIfCannotAccessAppShell } from "@/lib/auth/guards";

export default async function AppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const currentUser = await redirectIfCannotAccessAppShell();

  return <AppShell currentUser={currentUser}>{children}</AppShell>;
}
