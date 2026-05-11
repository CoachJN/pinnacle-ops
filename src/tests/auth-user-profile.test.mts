import assert from "node:assert/strict";
import test from "node:test";

import {
  toCanonicalAppUserProfile,
  toCanonicalSessionProfile,
} from "../server/auth/user-profile.ts";
import { USER_ROLES } from "../types/permissions.ts";
import type { UserProfile } from "../server/repositories/index.ts";

test("canonical app user profile maps active repository users", () => {
  const result = toCanonicalAppUserProfile(makeUserProfile());

  assert.deepEqual(result, {
    uid: "user-1",
    email: "owner@example.com",
    displayName: "Owner User",
    role: USER_ROLES.Owner,
    organizationId: "org-1",
    isActive: true,
  });
});

test("canonical app user profile marks inactive repository users as inactive", () => {
  const result = toCanonicalAppUserProfile(
    makeUserProfile({ status: "inactive" }),
  );

  assert.equal(result?.isActive, false);
});

test("canonical session profile reads role and organization from repository users", () => {
  const result = toCanonicalSessionProfile(makeUserProfile());

  assert.deepEqual(result, {
    role: USER_ROLES.Owner,
    organizationId: "org-1",
  });
});

function makeUserProfile(
  overrides: Partial<UserProfile> = {},
): UserProfile {
  return {
    id: "user-1",
    organizationId: "org-1",
    recordStatus: "active",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    isDeleted: false,
    deletedAt: null,
    deletedByUserId: null,
    email: "owner@example.com",
    displayName: "Owner User",
    role: USER_ROLES.Owner,
    status: "active",
    clientOrganizationId: null,
    contractorOrganizationId: null,
    locationIds: [],
    lastLoginAt: null,
    ...overrides,
  };
}
