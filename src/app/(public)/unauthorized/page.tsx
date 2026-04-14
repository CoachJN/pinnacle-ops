import Link from "next/link";
import { APP_CONSTANTS } from "@/config/app";

export default function UnauthorizedPage() {
  return (
    <section className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6">
      <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
        Access
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Unauthorized
      </h1>
      <p className="mt-3 text-sm text-neutral-600">
        Your current account cannot access this area.
      </p>
      <Link
        href={APP_CONSTANTS.defaultProtectedPath}
        className="mt-6 inline-flex rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500"
      >
        Back to dashboard
      </Link>
    </section>
  );
}

