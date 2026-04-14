import { redirect } from "next/navigation";
import { buildLoginRedirectPath } from "@/server/auth/redirect-path";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const nextPath = Array.isArray(params.next) ? params.next[0] : params.next;

  redirect(buildLoginRedirectPath(nextPath));
}
