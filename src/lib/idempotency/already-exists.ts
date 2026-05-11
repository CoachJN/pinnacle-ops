export function isAlreadyExistsError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const value = error as { code?: unknown; message?: unknown };
  if (value.code === 6 || value.code === "already-exists" || value.code === "ALREADY_EXISTS") {
    return true;
  }

  return typeof value.message === "string" && value.message.toLowerCase().includes("already exists");
}
