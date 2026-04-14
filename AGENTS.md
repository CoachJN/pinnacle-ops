# AGENTS.md

## Architecture rules
- Use service/repository pattern
- Keep route handlers thin
- No business logic in UI components
- Enforce permissions server-side
- Validate all inputs at the boundary
- Prefer explicit types over implicit inference for domain objects

## Working agreements
- Do not refactor unrelated files
- Do not modify files outside assigned ownership
- Run the smallest relevant test set first
- Report files changed, assumptions, blockers, and checks run
- Avoid adding new dependencies unless required

## Response format
1. Files changed
2. Summary of implementation
3. Assumptions made
4. Risks/blockers
5. Checks/tests run