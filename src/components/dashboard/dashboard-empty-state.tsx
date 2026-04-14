export function DashboardEmptyState({
  message,
}: {
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-5 text-sm text-neutral-600">
      {message}
    </div>
  );
}
