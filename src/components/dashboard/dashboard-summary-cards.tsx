import Link from "next/link";
import type { DashboardSummaryCard } from "@/modules/dashboard";

const CARD_TONE_STYLES: Record<DashboardSummaryCard["tone"], string> = {
  neutral: "border-neutral-200 bg-white text-neutral-950",
  attention: "border-amber-200 bg-amber-50 text-amber-950",
  risk: "border-rose-200 bg-rose-50 text-rose-950",
};

export function DashboardSummaryCards({
  cards,
}: {
  cards: readonly DashboardSummaryCard[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Link
          className={`rounded-3xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${CARD_TONE_STYLES[card.tone]}`}
          href={card.href}
          key={card.key}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
            {card.label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">
            {card.value}
          </p>
        </Link>
      ))}
    </div>
  );
}
