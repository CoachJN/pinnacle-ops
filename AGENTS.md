# Agent Working Agreement

## Goal
Build a production-grade work order management platform with strong operational reliability, clear role boundaries, maintainable architecture, and safe workflow automation.

## Core principles
- Preserve security and RBAC correctness.
- Keep changes minimal, cohesive, and reviewable.
- Validate all external input at system boundaries.
- Prefer server-enforced authorization over client assumptions.
- Extend existing patterns before introducing new abstractions.
- Separate UI, domain logic, validation, and data access.

## Working process
1. Inspect the relevant code paths first.
2. Identify the smallest correct implementation.
3. Implement with clear file boundaries.
4. Run lint, typecheck, and relevant tests.
5. Summarize changed files, risks, and follow-up work.

## Non-negotiables
- Do not expose secrets to the client.
- Do not weaken auth, permissions, or auditability.
- Do not leave placeholder TODO logic unless explicitly requested.
- Do not create duplicate schemas or conflicting state models.
- Update tests when meaningful business logic changes.

## Definition of done
- Feature works end to end
- Types pass
- Lint passes
- Relevant tests are added or updated
- No obvious regression to auth, permissions, or workflow lifecycle