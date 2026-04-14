import type {
  AuthorizationFailureCode,
  TransitionAuthorizationResult,
} from "../rbac-transition/index.ts";
import type {
  TransitionFailureCode,
  TransitionValidationDetails,
} from "../transition-engine/index.ts";
import type { WorkflowBlockReasonCode } from "./types.ts";

export function mapAuthorizationBlockReason(
  result: TransitionAuthorizationResult,
): WorkflowBlockReasonCode {
  if (result.ok) {
    throw new Error("Cannot map an allowed authorization result to a block reason.");
  }

  if (
    result.failureCode === "LIFECYCLE_VALIDATION_FAILED" &&
    isTransitionFailureCode(result.details?.lifecycleFailureCode)
  ) {
    return mapLifecycleBlockReason(result.details.lifecycleFailureCode);
  }

  return mapAuthorizationFailureCode(result.failureCode);
}

export function mapAuthorizationFailureCode(
  failureCode: AuthorizationFailureCode,
): WorkflowBlockReasonCode {
  switch (failureCode) {
    case "INVALID_ROLE":
      return "INVALID_ROLE";
    case "INVALID_ACTOR_TYPE":
      return "INVALID_ACTOR_TYPE";
    case "ROLE_NOT_PERMITTED":
      return "ROLE_NOT_PERMITTED";
    case "SYSTEM_ONLY_TRANSITION":
      return "SYSTEM_ONLY";
    case "STATUS_MODEL_MISMATCH":
      return "STATUS_MODEL_MISMATCH";
    case "LIFECYCLE_VALIDATION_FAILED":
      return "INVALID_TRANSITION";
  }
}

export function mapLifecycleBlockReason(
  failureCode: TransitionFailureCode,
): WorkflowBlockReasonCode {
  switch (failureCode) {
    case "UNKNOWN_STATUS":
      return "UNKNOWN_STATUS";
    case "TERMINAL_STATE":
      return "TERMINAL_STATE";
    case "INVALID_TRANSITION":
      return "INVALID_TRANSITION";
    case "DEPENDENCY_FAILED":
      return "DEPENDENCY_FAILED";
    case "STATUS_MODEL_MISMATCH":
      return "STATUS_MODEL_MISMATCH";
    case "INVALID_LIFECYCLE":
      return "UNSUPPORTED_RUNTIME_PATH";
  }
}

export function buildBlockedMessage(input: {
  readonly defaultMessage: string;
  readonly blockReasonCode: WorkflowBlockReasonCode;
  readonly details?: TransitionValidationDetails;
}): string {
  if (
    input.blockReasonCode === "DEPENDENCY_FAILED" &&
    input.details?.dependency === "quote"
  ) {
    return "This action requires an approved client quote.";
  }

  if (
    input.blockReasonCode === "DEPENDENCY_FAILED" &&
    input.details?.dependency === "work-order"
  ) {
    return "This action requires the related work order to be ready for invoicing.";
  }

  if (input.blockReasonCode === "SYSTEM_ONLY") {
    return "This action is system-only.";
  }

  if (input.blockReasonCode === "TERMINAL_STATE") {
    return "This entity is in a terminal status.";
  }

  return input.defaultMessage;
}

export function isTransitionFailureCode(
  value: unknown,
): value is TransitionFailureCode {
  return (
    value === "INVALID_LIFECYCLE" ||
    value === "UNKNOWN_STATUS" ||
    value === "TERMINAL_STATE" ||
    value === "INVALID_TRANSITION" ||
    value === "DEPENDENCY_FAILED" ||
    value === "STATUS_MODEL_MISMATCH"
  );
}
