"use client";

import Link from "next/link";
import type {
  WorkOrderPriority,
  WorkOrderStatus,
} from "@/modules/work-orders";
import { WorkOrderPriorityBadge } from "./work-order-priority-badge";
import { WorkOrderStatusBadge } from "./work-order-status-badge";

export interface WorkOrderTableRow {
  id: string;
  workOrderNumber: string;
  title: string;
  clientName: string;
  locationName: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  createdAt: string;
  updatedAt: string;
}

const DASHBOARD_WORK_ORDERS_BASE_PATH = "/dashboard/work-orders";

interface WorkOrderTableProps {
  onRowClick: (workOrderId: string) => void;
  rows: WorkOrderTableRow[];
}

export function WorkOrderTable({
  onRowClick,
  rows,
}: WorkOrderTableProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            <tr>
              <th className="px-4 py-3">Work order</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {rows.map((row) => {
              const detailHref = `${DASHBOARD_WORK_ORDERS_BASE_PATH}/${row.id}`;

              return (
                <tr
                  className="cursor-pointer transition hover:bg-neutral-50"
                  key={row.id}
                  onClick={(event) => {
                    const target = event.target as HTMLElement;
                    if (target.closest("a, button")) {
                      return;
                    }

                    onRowClick(row.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onRowClick(row.id);
                    }
                  }}
                  tabIndex={0}
                >
                  <td className="px-4 py-4 font-semibold text-neutral-950">
                    <Link
                      className="underline-offset-4 hover:underline"
                      href={detailHref}
                    >
                      {row.workOrderNumber}
                    </Link>
                  </td>
                  <td className="max-w-sm px-4 py-4 text-neutral-900">
                    <div className="line-clamp-2">{row.title}</div>
                  </td>
                  <td className="px-4 py-4 text-neutral-600">{row.clientName}</td>
                  <td className="px-4 py-4 text-neutral-600">{row.locationName}</td>
                  <td className="px-4 py-4">
                    <WorkOrderStatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-4">
                    <WorkOrderPriorityBadge priority={row.priority} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-neutral-600">
                    {formatDateTime(row.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-neutral-600">
                    {formatDateTime(row.updatedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
