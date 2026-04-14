# Architecture Guide

## Canonical ownership

- `src/app`
  Route definitions, layouts, loading/error boundaries, and minimal server-side page wiring only.
  Do not add feature business rules here.
- `src/components`
  Reusable UI and page composition only.
  Do not add data access, permission ownership, or domain orchestration here.
- `src/modules`
  Preferred home for feature-owned logic going forward.
  A feature module may own `domain`, `repositories`, `server`, `ui`, and `validation`.
- `src/server`
  Cross-cutting server infrastructure only.
  This is the canonical home for runtime authorization, shared backend services, Firestore adapters, and API support code.
- `src/lib`
  Transitional shared utilities, framework-agnostic helpers, and compatibility layers.
  Do not expand `lib` into a second application architecture.
- `src/types`
  Cross-feature shared types only.
  Feature-local types should stay close to the feature when they are not broadly reused.

## Route groups

- `(public)`
  Unauthenticated entry points such as sign-in and unauthorized handling.
- `(app)`
  Canonical authenticated application surface.
  New internal, client, and shared authenticated experiences should prefer this shell unless a route is intentionally contractor-specific.
- `(contractor)`
  Contractor-facing authenticated workspace and contractor-only page composition.
- `(protected)`
  Transitional internal surface for legacy/mock-role pages that predate the current app-shell architecture.
  Avoid adding new pages here unless the work is explicitly extending an existing legacy flow.
  All new internal UI work should go to `(app)`, not `(protected)`.

## Transitional guidance

- Prefer new feature work in `src/modules/<feature>` with page wiring in `src/app`.
- Keep route handlers thin and push orchestration into `src/server` or a feature module server layer.
- Treat `src/server/authorization` as the runtime authorization entry point.
  Legacy policy helpers may remain in `src/lib`, but new runtime enforcement should not start there.
- For work-order dashboard list UI, the canonical list surface lives under `src/components/work-orders/list`.
  Legacy internal-shell list components may remain temporarily for `(protected)` routes, but should not set the pattern for new work.
- For contractor-related UI, keep internal contractor management in `src/components/contractors` and contractor-facing workspace UI in `src/components/contractor-portal`.
  Do not mix those responsibilities in new Phase 1 work.
