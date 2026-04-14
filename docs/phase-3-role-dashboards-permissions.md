# Phase 3: Role-Based Dashboards and Permission Enforcement

## What changed

Phase 3 adds the internal role-based operational layer for coordinator, manager, finance_admin, and owner users.

- `/dashboard` now renders a role-specific internal dashboard with summary counts, work order queues, and quick actions.
- Work order, client, and location actions are gated through centralized permission helpers.
- The internal shell now includes Dashboard navigation and a visible mock role switcher for development testing.
- The work order list supports MVP queue presets: active, completed, closed, cancelled, and mine.
- Mock work order data now includes records across new, in_review, dispatched, in_progress, completed, closed, and cancelled.

## Permission structure

Role parsing and shared role helpers live in `src/lib/permissions/roles.ts`.

Entity-specific permission helpers live in:

- `src/lib/permissions/work-order-permissions.ts`
- `src/lib/permissions/client-permissions.ts`
- `src/lib/permissions/location-permissions.ts`
- `src/lib/permissions/navigation-permissions.ts`
- `src/lib/permissions/dashboard-permissions.ts`

The permission helpers are the source of truth for page controls and server actions. UI hiding is not the only enforcement path; create, update, and transition server actions validate permissions before mutating mock-backed data.

## Dashboard data

Dashboard view-model selectors live in `src/lib/dashboard/work-order-dashboard-data.ts`.

The selectors accept the current internal role and a work order collection, then return summary counts, queue lists, and quick action definitions. Pages use these view models instead of computing role-specific dashboard logic inline.

## Intentional MVP limits

- Internal visibility remains broad for all four internal roles.
- Advanced row-level security is not implemented in Phase 3.
- External client and contractor dashboards are not implemented.
- Quotes, invoices, notifications, SLA automation, analytics, and reporting are intentionally out of scope.

## Manual QA checklist

- Switch to coordinator and confirm the dashboard highlights new, in review, dispatched, and in progress work.
- Switch to manager and confirm active, review, and recently updated queues are visible.
- Switch to finance_admin and confirm completed and closed work orders are emphasized.
- Switch to owner and confirm total, active, completed, closed, and cancelled summaries are visible.
- Confirm coordinator, manager, and owner can create work orders, but finance_admin cannot.
- Confirm finance_admin and owner can close a completed work order, while coordinator and manager cannot.
- Confirm terminal closed and cancelled work orders do not expose operational edit or transition controls.
- Confirm finance_admin can view clients and locations but cannot create or edit them.
- Confirm coordinator, manager, and owner can create and edit clients and locations.
- Confirm the work order list queue presets filter active, completed, closed, cancelled, and mine views.
