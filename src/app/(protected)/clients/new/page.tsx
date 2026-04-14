import Link from "next/link";
import { ClientForm } from "@/components/clients/client-form";
import { InternalShell } from "@/components/internal/internal-shell";
import { canCreateClient } from "@/lib/permissions/client-permissions";
import { getMockCurrentUser } from "@/lib/permissions/mock-current-user";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const currentUser = getMockCurrentUser(readParam(params.role));

  return (
    <InternalShell currentUser={currentUser}>
      <div className="mx-auto max-w-4xl">
        <Link href={`/clients?role=${currentUser.role}`} className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline">
          Back to clients
        </Link>
        <div className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
            Client intake
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
            Create client
          </h1>
        </div>
        <div className="mt-6">
          {canCreateClient(currentUser.role) ? (
            <ClientForm mode="create" role={currentUser.role} />
          ) : (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
              Your current mock role cannot create clients.
            </div>
          )}
        </div>
      </div>
    </InternalShell>
  );
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
