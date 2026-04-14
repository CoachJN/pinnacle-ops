export const SIGN_IN_PATH = "/sign-in";
export const LOGIN_PATH = SIGN_IN_PATH;

export function buildLoginRedirectPath(returnToPath?: string): string {
  if (
    !returnToPath ||
    !returnToPath.startsWith("/") ||
    returnToPath.startsWith("//")
  ) {
    return SIGN_IN_PATH;
  }

  const params = new URLSearchParams({ next: returnToPath });
  return `${SIGN_IN_PATH}?${params.toString()}`;
}
