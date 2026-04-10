export type UserRole =
  | "admin"
  | "service_manager"
  | "service_staff"
  | "finance_manager"
  | "customer_head_office"
  | "customer_store";

export interface AuthUser {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
}