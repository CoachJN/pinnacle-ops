import { InternalShell } from "@/components/internal/internal-shell";
import { getMockCurrentUser } from "@/lib/permissions/mock-current-user";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const currentUser = getMockCurrentUser(readParam(params.role));

  return (
    <InternalShell currentUser={currentUser}>
      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
          Settings
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
          Platform settings
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-neutral-600">
          Organization, role, and automation controls will be configured here.
        </p>
      </section>
    </InternalShell>
  );
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

