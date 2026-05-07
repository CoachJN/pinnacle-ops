"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavigationItem } from "@/types/navigation";

interface SidebarNavProps {
  items: readonly NavigationItem[];
  orientation?: "horizontal" | "vertical";
}

function isNavigationItemActive(
  currentPath: string,
  item: Pick<NavigationItem, "href" | "match" | "disabled">,
): boolean {
  if (item.disabled) {
    return false;
  }

  return item.match === "prefix"
    ? currentPath.startsWith(item.href)
    : currentPath === item.href;
}

export function SidebarNav({
  items,
  orientation = "vertical",
}: SidebarNavProps) {
  const pathname = usePathname();
  const isHorizontal = orientation === "horizontal";

  return (
    <nav
      aria-label="Primary"
      className={
        isHorizontal
          ? "flex gap-2 overflow-x-auto pb-1"
          : "flex flex-col gap-2"
      }
    >
      {items.map((item) => {
        const isActive = isNavigationItemActive(pathname, item);
        const baseClassName = isHorizontal
          ? "inline-flex min-w-max items-center rounded-full px-3 py-2 text-sm font-medium"
          : "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium";
        const activeClassName =
          "bg-neutral-950 text-white shadow-sm shadow-neutral-950/10";
        const inactiveClassName =
          "text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950";
        const disabledClassName =
          "cursor-not-allowed border border-dashed border-neutral-200 bg-neutral-50 text-neutral-400";
        const className = [
          baseClassName,
          item.disabled
            ? disabledClassName
            : isActive
              ? activeClassName
              : inactiveClassName,
        ].join(" ");
        const content = (
          <>
            <span>{item.label}</span>
            {item.disabled ? (
              <span className="ml-3 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Soon
              </span>
            ) : null}
          </>
        );

        if (item.disabled) {
          return (
            <span
              key={item.id}
              aria-disabled="true"
              className={className}
            >
              {content}
            </span>
          );
        }

        return (
          <Link key={item.id} href={item.href} className={className}>
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
