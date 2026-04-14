import { redirectIfUnauthenticated } from "@/lib/auth/guards";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await redirectIfUnauthenticated("/dashboard");

  return children;
}
