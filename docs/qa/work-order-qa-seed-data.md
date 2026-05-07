# QA Seed Data Inventory

Use `npm run seed:qa` to create or refresh the dedicated manual QA fixtures.

Important notes:

- The seed is idempotent.
- Stable ids are used so rerunning it updates the same records instead of creating duplicates.
- The default organization is `org-1`.
- Override the tenant or actor if needed:
  - `QA_SEED_ORGANIZATION_ID=... npm run seed:qa`
  - `QA_SEED_ACTOR_USER_ID=... npm run seed:qa`

## Seeded Clients

- `client-qa-northstar` -> Northstar QA
- `client-qa-harbor` -> Harbor QA

## Seeded Locations

- `loc-qa-northstar-tower` -> Northstar Tower QA
- `loc-qa-harbor-plaza` -> Harbor Plaza QA

## Seeded Contractors

- `contractor-qa-summit-mechanical` -> active, assignable, valid primary test contractor
- `contractor-qa-nightwatch-electric` -> active, assignable, mismatched-trade candidate
- `contractor-qa-inactive-facilities` -> inactive assignment failure case
- `contractor-qa-backoffice-cleaning` -> active but non-assignable failure case

## Seeded Work Orders

- `wo-qa-a-no-quote` -> WO-A no-quote lifecycle fixture
- `wo-qa-b-quote-required` -> WO-B quote-required lifecycle fixture
- `wo-qa-c-legacy-candidate` -> WO-C owner/legacy regression fixture
- `wo-qa-d-minimal` -> WO-D minimal-data fixture

## Recommended Use

- Run the seed before a new QA pass.
- Use the master runbook and role sheets in `docs/qa/`.
- Keep any additional experimental QA data separate from these fixed fixtures so reruns remain predictable.
