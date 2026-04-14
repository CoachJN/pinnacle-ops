import type { DecodedIdToken } from "firebase-admin/auth";
import type { AppRole } from "@/lib/rbac/roles";

export type { AppRole } from "@/lib/rbac/roles";

export const AUTH_GUARD_FAILURE_REASONS = {
  Unauthenticated: "unauthenticated",
  Unauthorized: "unauthorized",
} as const;

export type AuthGuardFailureReason =
  (typeof AUTH_GUARD_FAILURE_REASONS)[keyof typeof AUTH_GUARD_FAILURE_REASONS];

export interface RoleSubject<TRole extends AppRole = AppRole> {
  role: TRole;
}

export type UserWithAllowedRole<
  TUser extends RoleSubject,
  TAllowedRoles extends readonly AppRole[],
> = TUser & {
  role: TAllowedRoles[number];
};

export interface AuthGuardSuccess<TUser> {
  ok: true;
  user: TUser;
}

export interface AuthGuardFailure {
  ok: false;
  reason: AuthGuardFailureReason;
  statusCode: 401 | 403;
  message: string;
}

export type AuthGuardResult<TUser> =
  | AuthGuardSuccess<TUser>
  | AuthGuardFailure;

export interface FirebaseCustomClaims {
  role: AppRole;
  organizationId?: string;
  organizationIds?: readonly string[];
  permissionsVersion?: number;
}

export interface SessionUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
  role: AppRole;
  organizationId: string | null;
  claims: FirebaseCustomClaims;
}

export interface AuthenticatedUser extends SessionUser {
  token: DecodedIdToken;
}

export interface AuthSession {
  sessionCookie: string;
  user: SessionUser;
  token: DecodedIdToken;
}

export type SignInFormStatus = "idle" | "submitting" | "success" | "error";

export interface AuthSuccessResponse {
  ok: true;
  user: SessionUser;
}

export interface AuthErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export type AuthResponse = AuthSuccessResponse | AuthErrorResponse;
