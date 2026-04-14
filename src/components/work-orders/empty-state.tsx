export function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-neutral-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-neutral-600">{message}</p>
    </div>
  );
}
