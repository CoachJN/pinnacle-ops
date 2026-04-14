import type { AppRole } from "@/lib/rbac/roles";

export type NavigationMatch = "exact" | "prefix";

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  allowedRoles: readonly AppRole[];
  match?: NavigationMatch;
  disabled?: boolean;
}
