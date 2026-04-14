import Link from "next/link";

export interface SummaryCardItem {
  label: string;
  value: string | number;
  href?: string;
  description?: string;
}

export function SummaryCardGrid({ items }: { items: SummaryCardItem[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <SummaryCard key={item.label} item={item} />
      ))}
    </section>
  );
}

function SummaryCard({ item }: { item: SummaryCardItem }) {
  const card = (
    <article className="rounded-lg border border-neutral-200 bg-white p-5">
      <p className="text-sm font-medium text-neutral-600">{item.label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950">
        {item.value}
      </p>
      {item.description ? (
        <p className="mt-1 text-xs text-neutral-600">{item.description}</p>
      ) : null}
    </article>
  );

  if (!item.href) {
    return card;
  }

  return (
    <Link href={item.href} className="rounded-lg border border-neutral-200 bg-white p-5 hover:border-neutral-400">
      <p className="text-sm font-medium text-neutral-600">{item.label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950">
        {item.value}
      </p>
      {item.description ? (
        <p className="mt-1 text-xs text-neutral-600">{item.description}</p>
      ) : null}
    </Link>
  );
}

