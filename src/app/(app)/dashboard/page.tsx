import { normalizeCurrentUser } from "@/lib/auth/current-user";
import { redirectIfCannotAccessAppShell } from "@/lib/auth/guards";

const DASHBOARD_MODULES = [
  {
    title: "Work orders",
    description:
      "Placeholder surface for intake, dispatch, and execution queues.",
  },
  {
    title: "Clients and locations",
    description:
      "Placeholder surface for account context, sites, and service coverage.",
  },
  {
    title: "Contractors and finance",
    description:
      "Placeholder surface for partner coordination, billing, and closeout.",
  },
] as const;

const FOUNDATION_CHECKS = [
  "Authenticated route access",
  "Server-side role evaluation",
  "Shared application shell rendering",
] as const;

export default async function DashboardPage() {
  const currentUser = await redirectIfCannotAccessAppShell();
  const normalizedUser = normalizeCurrentUser(currentUser);

  return (
    <section className="space-y-8">
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Dashboard
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
          Work Order Platform Foundation
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-neutral-600">
          This landing page confirms the authenticated app shell, normalized
          current-user handling, and server-side RBAC checks are working
          together before domain modules are layered in.
        </p>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Signed in as
            </dt>
            <dd className="mt-2 text-base font-semibold text-neutral-950">
              {normalizedUser.displayLabel}
            </dd>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Role
            </dt>
            <dd className="mt-2 text-base font-semibold text-neutral-950">
              {normalizedUser.roleLabel}
            </dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-neutral-950">
                Future modules
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                These cards are intentionally placeholders for upcoming
                operational surfaces.
              </p>
            </div>
            <span className="rounded-full border border-dashed border-neutral-300 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">
              Placeholder
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {DASHBOARD_MODULES.map((module) => (
              <article
                className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5"
                key={module.title}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  Phase 1 placeholder
                </p>
                <h3 className="mt-3 text-base font-semibold text-neutral-950">
                  {module.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  {module.description}
                </p>
              </article>
            ))}
          </div>
        </div>

        <aside className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-950">
            Foundation checks
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            This page is useful only if these integration points are real.
          </p>

          <ul className="mt-6 space-y-3">
            {FOUNDATION_CHECKS.map((check) => (
              <li
                className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3"
                key={check}
              >
                <span
                  aria-hidden="true"
                  className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500"
                />
                <div>
                  <p className="text-sm font-medium text-neutral-900">{check}</p>
                  <p className="text-sm text-neutral-600">Confirmed on render.</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
