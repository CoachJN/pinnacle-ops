import assert from "node:assert/strict";
import test from "node:test";

import {
  canAssignmentTransition,
  canManageAssignments,
  getContractorAssignmentEligibility,
  isActiveAssignmentStatus,
  isTerminalAssignmentWorkOrderStatus,
} from "../modules/work-orders/domain/assignment-rules.ts";
import { USER_ROLES } from "../types/permissions.ts";

test("contractor eligibility requires active status and matching category", () => {
  assert.deepEqual(
    getContractorAssignmentEligibility({
      status: "active",
      serviceCategories: ["hvac", "electrical"],
      workOrderCategory: "hvac",
    }),
    { isAssignable: true, reason: null },
  );

  assert.equal(
    getContractorAssignmentEligibility({
      status: "inactive",
      serviceCategories: ["hvac"],
      workOrderCategory: "hvac",
    }).isAssignable,
    false,
  );

  assert.match(
    getContractorAssignmentEligibility({
      status: "active",
      serviceCategories: ["plumbing"],
      workOrderCategory: "hvac",
    }).reason ?? "",
    /not configured/i,
  );
});

test("work order and assignment rule helpers enforce operational constraints", () => {
  assert.equal(canManageAssignments(USER_ROLES.Coordinator), true);
  assert.equal(canManageAssignments(USER_ROLES.ClientUser), false);

  assert.equal(isTerminalAssignmentWorkOrderStatus("completed"), true);
  assert.equal(isTerminalAssignmentWorkOrderStatus("assigned"), false);

  assert.equal(isActiveAssignmentStatus("assigned"), true);
  assert.equal(isActiveAssignmentStatus("declined"), false);

  assert.equal(canAssignmentTransition("assigned", "accepted"), true);
  assert.equal(canAssignmentTransition("accepted", "declined"), false);
});
