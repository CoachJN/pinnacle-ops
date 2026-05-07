import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  authorizeFinanceQueueRead,
  listScopeForActor,
} from "../server/api/work-order-access.ts";
import { createAccessDeniedError } from "../server/authorization/index.ts";
import { APP_PRIMARY_NAV_ITEMS } from "../lib/navigation/nav-config.ts";
import { getNavigationItemsForRole } from "../lib/rbac/checks.ts";
import { APP_ROLES } from "../lib/rbac/roles.ts";
import type { AccessActor, ClientAccessActor } from "../types/auth.ts";
import { USER_ROLES } from "../types/permissions.ts";

test("app route ownership does not publish duplicate public page paths", () => {
  const appRoot = path.resolve(process.cwd(), "src/app");
  const pageFiles = walkFiles(appRoot).filter((file) => /\/page\.tsx$/.test(file));
  const owners = new Map<string, string[]>();

  for (const file of pageFiles) {
    const routePath = toPublicRoutePath(path.relative(appRoot, file));
    const entries = owners.get(routePath) ?? [];
    entries.push(path.relative(process.cwd(), file));
    owners.set(routePath, entries);
  }

  const duplicates = [...owners.entries()].filter(([, files]) => files.length > 1);
  assert.deepEqual(duplicates, []);
});

test("protected legacy route group is removed", () => {
  const routeGroup = `(${["protected"].join("")})`;
  const removedRoot = path.resolve(process.cwd(), "src/app", routeGroup);
  assert.equal(statExists(removedRoot), false);
});

test("legacy API routes are removed from the active app surface", () => {
  const removedRoutes = [
    "src/app/api/clients/route.ts",
    "src/app/api/clients/[clientId]/route.ts",
    "src/app/api/work-orders/[workOrderId]/assign-contractor/route.ts",
    "src/app/api/work-orders/[workOrderId]/quotes/route.ts",
    "src/app/api/work-orders/[workOrderId]/quotes/[quoteId]/route.ts",
    "src/app/api/work-orders/[workOrderId]/quotes/[quoteId]/transition/route.ts",
    "src/app/api/work-orders/[workOrderId]/transition/route.ts",
  ];

  for (const routePath of removedRoutes) {
    const absolutePath = path.resolve(process.cwd(), routePath);
    assert.equal(statExists(absolutePath), false, `${routePath} should not exist`);
  }
});

test("client-scoped work-order list scope preserves selected location boundaries", () => {
  const actor: ClientAccessActor = {
    actorType: "client",
    userId: "client-user-1",
    role: USER_ROLES.ClientUser,
    scope: {
      kind: "client",
      organizationId: "org-1",
      clientOrganizationId: "client-1",
      locationAccess: {
        kind: "selected_client_locations",
        locationIds: ["loc-1", "loc-2"],
      },
    },
  };

  assert.deepEqual(listScopeForActor(actor, 100), {
    scope: "locations",
    locationIds: ["loc-1", "loc-2"],
    limit: 100,
  });
});

test("finance queue authorization rejects external actors", () => {
  for (const actor of [makeClientActor(), makeContractorActor()]) {
    assert.throws(
      () =>
        authorizeFinanceQueueRead({
          actor,
        }),
      (error: unknown) =>
        error instanceof Error &&
        error.message === createAccessDeniedError().message,
    );
  }
});

test("finance queue authorization rejects manager actors", () => {
  assert.throws(
    () =>
      authorizeFinanceQueueRead({
        actor: makeInternalActor(USER_ROLES.Manager),
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === createAccessDeniedError().message,
  );
});

test("navigation only exposes external portal links to matching external roles", () => {
  const ownerItems = getNavigationItemsForRole(
    APP_ROLES.Owner,
    APP_PRIMARY_NAV_ITEMS,
  );
  assert.equal(
    ownerItems.some((item) => item.id === "client-organizations"),
    true,
  );
  assert.equal(ownerItems.some((item) => item.id === "contacts"), true);
  assert.equal(
    ownerItems.findIndex((item) => item.id === "contacts") >
      ownerItems.findIndex((item) => item.id === "locations"),
    true,
  );
  assert.equal(ownerItems.some((item) => item.id === "client-portal"), false);
  assert.equal(
    ownerItems.some((item) => item.id === "contractor-portal"),
    false,
  );

  const clientItems = getNavigationItemsForRole(
    APP_ROLES.ClientUser,
    APP_PRIMARY_NAV_ITEMS,
  );
  assert.equal(
    clientItems.some((item) => item.id === "client-organizations"),
    true,
  );
  assert.equal(clientItems.some((item) => item.id === "contacts"), false);
  assert.equal(clientItems.some((item) => item.id === "client-portal"), true);
  assert.equal(
    clientItems.some((item) => item.id === "contractor-portal"),
    false,
  );

  const contractorItems = getNavigationItemsForRole(
    APP_ROLES.ContractorUser,
    APP_PRIMARY_NAV_ITEMS,
  );
  assert.equal(
    contractorItems.some((item) => item.id === "client-organizations"),
    true,
  );
  assert.equal(contractorItems.some((item) => item.id === "contacts"), false);
  assert.equal(
    contractorItems.some((item) => item.id === "client-portal"),
    false,
  );
  assert.equal(
    contractorItems.some((item) => item.id === "contractor-portal"),
    true,
  );
});

function walkFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

function statExists(targetPath: string): boolean {
  try {
    statSync(targetPath);
    return true;
  } catch {
    return false;
  }
}

function toPublicRoutePath(relativeFile: string): string {
  const parts = relativeFile.replace(/\\/g, "/").split("/");
  const routeSegments = parts
    .slice(0, -1)
    .filter((segment) => !/^\(.+\)$/.test(segment));

  const routePath = `/${routeSegments.join("/")}`.replace(/\/+/g, "/");
  return routePath === "/" ? routePath : routePath.replace(/\/$/, "");
}

function makeClientActor(): AccessActor {
  return {
    actorType: "client",
    userId: "client-user-1",
    role: USER_ROLES.ClientUser,
    scope: {
      kind: "client",
      organizationId: "org-1",
      clientOrganizationId: "client-1",
      locationAccess: {
        kind: "all_client_locations",
      },
    },
  };
}

function makeContractorActor(): AccessActor {
  return {
    actorType: "contractor",
    userId: "contractor-user-1",
    role: USER_ROLES.ContractorUser,
    scope: {
      kind: "contractor",
      organizationId: "org-1",
      contractorOrganizationId: "contractor-1",
    },
  };
}

function makeInternalActor(role: typeof USER_ROLES.Manager): AccessActor {
  return {
    actorType: "internal",
    userId: `${role.toLowerCase()}-1`,
    role,
    scope: {
      kind: "internal",
      organizationId: "org-1",
    },
  };
}
