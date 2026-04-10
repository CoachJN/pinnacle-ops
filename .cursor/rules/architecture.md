# Architecture

- Use App Router conventions.
- Keep domain logic out of page components.
- Prefer the following boundaries:
  - `src/app` for routes
  - `src/components` for UI and feature components
  - `src/lib` for utilities, validation, permissions, and domain helpers
  - `src/server` for server-only services and repository logic
  - `src/types` for shared types
- Validate all external input at the boundary.
- Centralize role and permission logic.
- Avoid duplicating schema or status definitions across files.