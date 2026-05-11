import Link from "next/link";
import { requireUserWithRole } from "@/lib/auth/guards";
import { APP_ROLE_LABELS, INTERNAL_APP_ROLES } from "@/lib/rbac/roles";
import { serverEnv } from "@/lib/env/server";
import { getWorkOrderApiContext } from "@/server/api/work-orders";

const diagnosticsLinks = [
  {
    label: "Operations runtime summary",
    href: "/api/operations/runtime/summary",
    description: "Queue counts and high-level runtime posture.",
  },
  {
    label: "Operations runtime health",
    href: "/api/operations/runtime/health",
    description: "Operational health checks across runtime surfaces.",
  },
  {
    label: "Runtime operator diagnostics",
    href: "/api/runtime/operator/diagnostics",
    description: "Core runtime diagnostics for operators.",
  },
  {
    label: "Provider diagnostics",
    href: "/api/providers/diagnostics",
    description: "Provider connection and ingestion diagnostics.",
  },
  {
    label: "Provider runtime diagnostics",
    href: "/api/provider-runtime/operator/diagnostics",
    description: "Webhook/reconciliation runtime diagnostics.",
  },
  {
    label: "Scheduler diagnostics",
    href: "/api/scheduler/operator/diagnostics",
    description: "Scheduler state and execution diagnostics.",
  },
  {
    label: "SLA diagnostics",
    href: "/api/sla/diagnostics",
    description: "SLA state, timers, and breach diagnostics.",
  },
  {
    label: "Delivery diagnostics",
    href: "/api/delivery/operator/diagnostics",
    description: "Delivery-plan execution diagnostics.",
  },
  {
    label: "Runtime loops diagnostics",
    href: "/api/runtime-loops/diagnostics",
    description: "Loop coordination and drain-state diagnostics.",
  },
  {
    label: "Runtime capacity diagnostics",
    href: "/api/runtime-capacity/diagnostics",
    description: "Backpressure, quotas, and capacity diagnostics.",
  },
  {
    label: "Runtime claim diagnostics",
    href: "/api/runtime-claim/diagnostics",
    description: "Worker claim and lease diagnostics.",
  },
  {
    label: "Runtime allocator diagnostics",
    href: "/api/runtime-allocator/diagnostics",
    description: "Worker allocation and fairness diagnostics.",
  },
] as const;

export default async function SettingsPage() {
  const currentUser = await requireUserWithRole(INTERNAL_APP_ROLES);
  const context = await getWorkOrderApiContext();

  const appChecks = [
    {
      label: "Authenticated workspace",
      value:
        context.actor.actorType === "internal"
          ? `Ready as ${APP_ROLE_LABELS[currentUser.role]}`
          : "Not available",
      healthy: context.actor.actorType === "internal",
    },
    {
      label: "Firebase project id",
      value: serverEnv.firebaseProjectId ?? "Missing",
      healthy: Boolean(serverEnv.firebaseProjectId),
    },
    {
      label: "Firestore database id",
      value: serverEnv.firestoreDatabaseId ?? "Missing",
      healthy: Boolean(serverEnv.firestoreDatabaseId),
    },
    {
      label: "Firebase storage bucket",
      value: serverEnv.firebaseStorageBucket ?? "Missing",
      healthy: Boolean(serverEnv.firebaseStorageBucket),
    },
    {
      label: "Firebase admin email",
      value: serverEnv.firebaseClientEmail ?? "Missing",
      healthy: Boolean(serverEnv.firebaseClientEmail),
    },
    {
      label: "Firebase admin private key",
      value: serverEnv.firebasePrivateKey ? "Configured" : "Missing",
      healthy: Boolean(serverEnv.firebasePrivateKey),
    },
  ] as const;

  const providerChecks = [
    {
      label: "Microsoft provider config",
      value: hasAllEnv([
        "MICROSOFT_CLIENT_ID",
        "MICROSOFT_CLIENT_SECRET",
        "MICROSOFT_TENANT_ID",
        "MICROSOFT_REDIRECT_URI",
      ])
        ? "Configured"
        : "Incomplete",
      healthy: hasAllEnv([
        "MICROSOFT_CLIENT_ID",
        "MICROSOFT_CLIENT_SECRET",
        "MICROSOFT_TENANT_ID",
        "MICROSOFT_REDIRECT_URI",
      ]),
    },
    {
      label: "QuickBooks provider config",
      value: hasAllEnv([
        "QUICKBOOKS_CLIENT_ID",
        "QUICKBOOKS_CLIENT_SECRET",
        "QUICKBOOKS_REDIRECT_URI",
      ])
        ? "Configured"
        : "Incomplete",
      healthy: hasAllEnv([
        "QUICKBOOKS_CLIENT_ID",
        "QUICKBOOKS_CLIENT_SECRET",
        "QUICKBOOKS_REDIRECT_URI",
      ]),
    },
    {
      label: "Email delivery config",
      value: hasAllEnv(["SENDGRID_API_KEY", "SENDGRID_FROM_EMAIL"])
        ? "Configured"
        : "Incomplete",
      healthy: hasAllEnv(["SENDGRID_API_KEY", "SENDGRID_FROM_EMAIL"]),
    },
  ] as const;

  return (
    <section className="space-y-8">
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Settings
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
          Internal runtime checks
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-neutral-600">
          Use this page as a fast operator view for environment readiness and the
          diagnostic endpoints that back the runtime, provider, scheduler, and SLA systems.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StatusPanel title="Core App Checks" items={appChecks} />
        <StatusPanel title="Provider Checks" items={providerChecks} />
      </div>

      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-neutral-950">Diagnostics Links</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Open these authenticated endpoints directly when you want the raw operational payload.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {diagnosticsLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 transition hover:border-neutral-400 hover:bg-white"
            >
              <p className="text-sm font-semibold text-neutral-950">{item.label}</p>
              <p className="mt-1 text-sm text-neutral-600">{item.description}</p>
              <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">
                {item.href}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatusPanel({
  title,
  items,
}: {
  title: string;
  items: readonly { label: string; value: string; healthy: boolean }[];
}) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-lg font-semibold text-neutral-950">{title}</h2>
      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-start justify-between gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-neutral-900">{item.label}</p>
              <p className="mt-1 text-sm text-neutral-600">{item.value}</p>
            </div>
            <span
              className={
                item.healthy
                  ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700"
                  : "rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-800"
              }
            >
              {item.healthy ? "Ready" : "Check"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function hasAllEnv(keys: readonly string[]): boolean {
  return keys.every((key) => {
    const value = process.env[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}
