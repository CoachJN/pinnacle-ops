import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getOptionalUser } from "@/lib/auth/current-user";
import { APP_PATHS } from "@/lib/utils/constants";

interface SignInPageProps {
  searchParams?: Promise<{
    next?: string;
  }>;
}

export default async function SignInPage({
  searchParams,
}: SignInPageProps) {
  const currentUser = await getOptionalUser();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  if (currentUser) {
    redirect(normalizeNextPath(resolvedSearchParams?.next ?? null));
  }

  return (
    <section className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm sm:p-10">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">
          PinnOps
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">
          Sign in
        </h1>
        <p className="max-w-sm text-sm leading-6 text-neutral-600">
          Use your work order platform account to start a secure session and continue
          into the protected app.
        </p>
      </div>

      <div className="mt-6">
        <SignInForm />
      </div>
    </section>
  );
}

function normalizeNextPath(nextPath: string | null): string {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return APP_PATHS.dashboard;
  }

  return nextPath;
}
