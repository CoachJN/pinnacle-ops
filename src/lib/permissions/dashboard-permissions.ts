import type { InternalUserRole } from "../../types/permissions.ts";
import { USER_ROLES } from "../../types/permissions.ts";

export type DashboardAudience =
  | "coordinator"
  | "manager"
  | "finance_admin"
  | "owner";

export interface DashboardQuickAction {
  label: string;
  href: string;
  primary?: boolean;
}

export interface DashboardQueueConfig {
  key: string;
  title: string;
  description: string;
}

export interface DashboardConfig {
  audience: DashboardAudience;
  eyebrow: string;
  title: string;
  summaryLabels: readonly string[];
  queues: readonly DashboardQueueConfig[];
  quickActions: readonly DashboardQuickAction[];
}

export function getDashboardConfigForRole(
  role: InternalUserRole,
): DashboardConfig {
  if (role === USER_ROLES.Manager) {
    return {
      audience: "manager",
      eyebrow: "Manager dashboard",
      title: "Operational oversight",
      summaryLabels: [
        "Total active work orders",
        "In review",
        "Dispatched",
        "In progress",
        "Completed awaiting close",
      ],
      queues: [
        {
          key: "needingReview",
          title: "Work orders needing review",
          description: "Items in review or missing clear ownership.",
        },
        {
          key: "activeWorkOrders",
          title: "Active work orders",
          description: "Current non-terminal operational work.",
        },
        {
          key: "recentlyUpdated",
          title: "Recently updated work orders",
          description: "Latest changes across the operation.",
        },
      ],
      quickActions: [
        { label: "View work orders", href: `/work-orders?role=${role}`, primary: true },
        {
          label: "Review operational bottlenecks",
          href: `/work-orders?role=${role}&view=active&sort=priority`,
        },
        { label: "View clients", href: `/clients?role=${role}` },
        { label: "View locations", href: `/locations?role=${role}` },
      ],
    };
  }

  if (role === USER_ROLES.FinanceAdmin) {
    return {
      audience: "finance_admin",
      eyebrow: "Finance/Admin dashboard",
      title: "Closeout queue",
      summaryLabels: [
        "Completed work orders",
        "Closed work orders",
        "Recently completed",
      ],
      queues: [
        {
          key: "readyToClose",
          title: "Ready to close",
          description: "Completed work orders awaiting administrative closeout.",
        },
        {
          key: "recentlyClosed",
          title: "Recently closed",
          description: "Latest closed records for follow-up checks.",
        },
      ],
      quickActions: [
        {
          label: "View completed work orders",
          href: `/work-orders?role=${role}&view=completed`,
          primary: true,
        },
        { label: "View all work orders", href: `/work-orders?role=${role}` },
      ],
    };
  }

  if (role === USER_ROLES.Owner) {
    return {
      audience: "owner",
      eyebrow: "Owner dashboard",
      title: "Full operational picture",
      summaryLabels: [
        "Total work orders",
        "Active work orders",
        "Completed",
        "Closed",
        "Cancelled",
      ],
      queues: [
        {
          key: "recentlyUpdated",
          title: "Recently updated",
          description: "Latest work order movement.",
        },
        {
          key: "activeWorkOrders",
          title: "Active work orders",
          description: "Open operational workload.",
        },
        {
          key: "completedAwaitingClose",
          title: "Completed awaiting close",
          description: "Completed work orders pending closeout.",
        },
      ],
      quickActions: [
        { label: "Work orders", href: `/work-orders?role=${role}`, primary: true },
        { label: "Clients", href: `/clients?role=${role}` },
        { label: "Locations", href: `/locations?role=${role}` },
      ],
    };
  }

  return {
    audience: "coordinator",
    eyebrow: "Coordinator dashboard",
    title: "Today's operational queue",
    summaryLabels: ["New work orders", "In review", "Dispatched", "In progress"],
    queues: [
      {
        key: "needsIntakeAttention",
        title: "Needs intake attention",
        description: "New and review-stage work that needs coordination.",
      },
      {
        key: "activeOperationalWork",
        title: "Active operational work",
        description: "Dispatched and in-progress records to keep moving.",
      },
    ],
    quickActions: [
      {
        label: "Create work order",
        href: `/work-orders/new?role=${role}`,
        primary: true,
      },
      { label: "View all work orders", href: `/work-orders?role=${role}` },
      { label: "View clients", href: `/clients?role=${role}` },
      { label: "View locations", href: `/locations?role=${role}` },
    ],
  };
}
