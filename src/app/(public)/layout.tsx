export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-12 text-neutral-950">
      {children}
    </main>
  );
}

