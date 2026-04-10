---
name: firebase-auth-rbac
description: Use for authentication, authorization, session handling, and role-based access changes.
---

Rules:
- Enforce permissions server-side.
- Never rely on client-only checks for data protection.
- Keep claims, roles, and route guards consistent.
- For any auth change, verify:
  - sign-in path
  - session persistence
  - unauthorized access behavior
  - audit/logging implications