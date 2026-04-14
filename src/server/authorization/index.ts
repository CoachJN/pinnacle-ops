import "server-only";

// Canonical runtime authorization entry point. Lower-level policy helpers may
// still live in `src/lib` during the transition, but server code should import
// authorization behavior from here.
export * from "@/server/authorization/actions";
export {
  APPLICATION_ROLES,
  AUTHORIZATION_RESOURCES,
  RESOURCE_ACTIONS,
} from "@/server/authorization/actions";
export * from "@/server/authorization/capabilities";
export * from "@/server/authorization/evaluator";
export {
  AuthorizationError,
  canUserPerformAction,
  createAccessDeniedError,
  evaluatePermission,
  requirePermission,
} from "@/server/authorization/evaluator";
export * from "@/server/authorization/policies";
export * from "@/server/authorization/visibility";
export * from "@/server/authorization/work-order.permissions";
