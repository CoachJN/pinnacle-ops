import { redirectIfUnauthenticated } from "@/lib/auth/guards";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Transitional legacy internal surface for mock-role pages. Avoid new feature
  // entry points here when the `(app)` shell can own the route instead.
  await redirectIfUnauthenticated("/dashboard");

  return children;
}
