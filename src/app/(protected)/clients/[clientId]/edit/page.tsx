import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientForm } from "@/components/clients/client-form";
import { InternalShell } from "@/components/internal/internal-shell";
import { canEditClient } from "@/lib/permissions/client-permissions";
import { getMockCurrentUser } from "@/lib/permissions/mock-current-user";
import { getClientById } from "@/lib/clients/repository";

type Params = Promise<{ clientId?: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EditClientPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ clientId }, query] = await Promise.all([params, searchParams]);
  if (!clientId || !clientId.trim()) {
    notFound();
  }

  const currentUser = getMockCurrentUser(readParam(query.role));
  const client = await getClientById(clientId);
  if (!client) {
    notFound();
  }

  return (
    <InternalShell currentUser={currentUser}>
      <div className="mx-auto max-w-4xl">
        <Link href={`/clients/${client.id}?role=${currentUser.role}`} className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline">
          Back to client
        </Link>
        <div className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
            {client.name}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
            Edit client
          </h1>
        </div>
        <div className="mt-6">
          {canEditClient(currentUser.role, client) ? (
            <ClientForm mode="edit" role={currentUser.role} client={client} />
          ) : (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
              Your current mock role cannot edit clients.
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
