export const APP_PATHS = {
  home: "/",
  signIn: "/sign-in",
  dashboard: "/dashboard",
  intakeReview: "/dashboard/intake",
  clientPortal: "/portal",
  clientOrganizations: "/client-organizations",
  workOrders: "/dashboard/work-orders",
  locations: "/locations",
  contacts: "/contacts",
  contractors: "/contractors",
  contractorPortal: "/contractor/dashboard",
  finance: "/finance",
  settings: "/settings",
} as const;

export const AUTH_API_PATHS = {
  session: "/api/auth/session",
  logout: "/api/auth/logout",
} as const;

export const AUTH_QUERY_PARAMS = {
  next: "next",
} as const;

export const AUTH_MESSAGES = {
  invalidOrigin: "Invalid request origin.",
  invalidRequestBody: "Request body must be valid JSON.",
  missingIdToken: "Missing Firebase ID token.",
  sessionCreationFailed: "Unable to establish an authenticated session.",
  invalidCredentials: "Unable to sign in with the provided credentials.",
  invalidEmail: "Enter a valid email address.",
} as const;

export const SESSION_COOKIE_NAME = "__session";
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;

export const APP_SHELL_BRAND = {
  companyName: "Pinnacle Ops",
  productName: "Work Order Platform",
} as const;
