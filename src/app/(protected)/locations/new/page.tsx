import Link from "next/link";
import { InternalShell } from "@/components/internal/internal-shell";
import { LocationForm } from "@/components/locations/location-form";
import { canCreateLocation } from "@/lib/permissions/location-permissions";
import { getMockCurrentUser } from "@/lib/permissions/mock-current-user";
import { listAllClients } from "@/lib/clients/repository";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewLocationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const currentUser = getMockCurrentUser(readParam(params.role));
  const defaultClientId = readParam(params.clientId);
  const clients = await listAllClients();

  return (
    <InternalShell currentUser={currentUser}>
      <div className="mx-auto max-w-4xl">
        <Link href={`/locations?role=${currentUser.role}`} className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline">
          Back to locations
        </Link>
        <div className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
            Location intake
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
            Create location
          </h1>
        </div>
        <div className="mt-6">
          {canCreateLocation(currentUser.role) ? (
            clients.length > 0 ? (
              <LocationForm
                mode="create"
                role={currentUser.role}
                clients={clients}
                defaultClientId={defaultClientId}
              />
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                Create a client before adding locations.
                <Link href={`/clients/new?role=${currentUser.role}`} className="ml-2 font-semibold underline">
                  Create client
                </Link>
              </div>
            )
          ) : (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
              Your current mock role cannot create locations.
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
