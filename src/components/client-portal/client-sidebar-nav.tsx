"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/portal", label: "Overview" },
  { href: "/portal/locations", label: "Locations" },
  { href: "/portal/work-orders", label: "Work Orders" },
] as const;

export function ClientSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-2">
      {NAV_ITEMS.map((item) => {
        const active =
          item.href === "/portal"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            className={
              active
                ? "block rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
                : "block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-white hover:text-slate-950"
            }
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
