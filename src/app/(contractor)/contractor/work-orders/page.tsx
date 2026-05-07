import Link from "next/link";
import { ContractorWorkOrderList } from "@/components/contractor-portal/contractor-work-order-list";
import {
  listContractorPortalWorkOrders,
} from "@/modules/contractors/server/contractor-portal";
import {
  type ContractorWorkOrderFilter,
} from "@/modules/work-orders/contractor-portal";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ContractorWorkOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const filter = parseFilter(readParam(params.filter));
  const items = await listContractorPortalWorkOrders(filter);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
          Assigned work orders
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
          Work queue
        </h1>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Contractor work order filters">
        <FilterLink label="All assigned" href="/contractor/work-orders" active={filter === "all"} />
        <FilterLink label="Quote required" href="/contractor/work-orders?filter=quote_required" active={filter === "quote_required"} />
        <FilterLink label="Client approved" href="/contractor/work-orders?filter=client_approved" active={filter === "client_approved"} />
        <FilterLink label="In progress" href="/contractor/work-orders?filter=in_progress" active={filter === "in_progress"} />
        <FilterLink label="Work completed" href="/contractor/work-orders?filter=work_completed" active={filter === "work_completed"} />
      </nav>

      <ContractorWorkOrderList items={items} />
    </div>
  );
}

function FilterLink({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link href={href} className={active ? "rounded-md bg-neutral-950 px-3 py-2 text-sm font-semibold text-white" : "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500"}>
      {label}
    </Link>
  );
}

function parseFilter(value: string | undefined): ContractorWorkOrderFilter {
  if (
    value === "quote_required" ||
    value === "client_approved" ||
    value === "in_progress" ||
    value === "work_completed"
  ) {
    return value;
  }

  return "all";
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
