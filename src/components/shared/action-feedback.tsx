export function ActionFeedback({
  message,
  tone = "error",
}: {
  message?: string | null;
  tone?: "success" | "error" | "info";
}) {
  if (!message) {
    return null;
  }

  const className =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "info"
        ? "border-sky-200 bg-sky-50 text-sky-800"
        : "border-rose-200 bg-rose-50 text-rose-800";

  return (
    <p className={`rounded-md border px-4 py-3 text-sm ${className}`}>
      {message}
    </p>
  );
}

