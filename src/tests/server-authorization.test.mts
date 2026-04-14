import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AUTHORITY_CATEGORIES,
  PERMISSION_ENTITIES,
  USER_ROLES,
  roleCanAccessEntity,
} from "../types/permissions.ts";

describe("server authorization foundation", () => {
  test("exposes the complete application role vocabulary", () => {
    assert.deepEqual(Object.values(USER_ROLES), [
      USER_ROLES.Coordinator,
      USER_ROLES.Manager,
      USER_ROLES.FinanceAdmin,
      USER_ROLES.Owner,
      USER_ROLES.ClientUser,
      USER_ROLES.ContractorUser,
    ]);
  });

  test("role capability map includes dashboard access for internal actors", () => {
    assert.equal(
      roleCanAccessEntity(
        USER_ROLES.Manager,
        PERMISSION_ENTITIES.DashboardAccess,
        AUTHORITY_CATEGORIES.View,
      ),
      true,
    );
    assert.equal(
      roleCanAccessEntity(
        USER_ROLES.ClientUser,
        PERMISSION_ENTITIES.DashboardAccess,
        AUTHORITY_CATEGORIES.View,
      ),
      false,
    );
  });

  test("contractor visibility is in the canonical permission matrix", () => {
    assert.equal(
      roleCanAccessEntity(
        USER_ROLES.ContractorUser,
        PERMISSION_ENTITIES.Contractors,
        AUTHORITY_CATEGORIES.View,
      ),
      true,
    );
    assert.equal(
      roleCanAccessEntity(
        USER_ROLES.ClientUser,
        PERMISSION_ENTITIES.Contractors,
        AUTHORITY_CATEGORIES.View,
      ),
      false,
    );
  });

  test("external roles cannot mutate supporting business entity catalogs", () => {
    for (const entity of [
      PERMISSION_ENTITIES.ClientOrganizations,
      PERMISSION_ENTITIES.Locations,
      PERMISSION_ENTITIES.Contractors,
    ]) {
      assert.equal(
        roleCanAccessEntity(USER_ROLES.ClientUser, entity, AUTHORITY_CATEGORIES.Create),
        false,
      );
      assert.equal(
        roleCanAccessEntity(USER_ROLES.ClientUser, entity, AUTHORITY_CATEGORIES.Edit),
        false,
      );
      assert.equal(
        roleCanAccessEntity(
          USER_ROLES.ContractorUser,
          entity,
          AUTHORITY_CATEGORIES.Create,
        ),
        false,
      );
      assert.equal(
        roleCanAccessEntity(
          USER_ROLES.ContractorUser,
          entity,
          AUTHORITY_CATEGORIES.Edit,
        ),
        false,
      );
    }
  });
});
