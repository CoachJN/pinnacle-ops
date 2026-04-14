## Pinnacle Phase 1: Work Order Backbone

Phase 1 builds the internal core data and work order hub for Pinnacle. Internal users can list, filter, sort, create, view, edit, and transition work orders through the MVP lifecycle:

`new -> in_review -> dispatched -> in_progress -> completed -> closed`, with cancellation available before terminal states.

Included in this phase:
- Internal app shell and mock role switcher for Coordinator, Manager, Finance/Admin, and Owner.
- Work order list, create, detail, and edit screens.
- MVP work order and activity timeline structures.
- Mock in-memory repository with sample work orders and activity entries.
- Centralized validation, status transition rules, and role-aware action gating.

Intentionally excluded:
- Quotes, invoices, payments, client portal, contractor portal, notifications, SLA automation, file uploads, and advanced reporting.
- Real database persistence. The repository is deliberately shaped so a database-backed implementation can replace the mock store later.

Key files:
- Transition rules live in `src/lib/work-orders/status.ts`.
- Permission rules live in `src/lib/permissions/work-order-permissions.ts`.
- Form validation lives in `src/lib/validation/work-order.ts`.
- Mock data and repository operations live in `src/lib/work-orders/repository.ts`.
- Server actions live in `src/lib/work-orders/actions.ts`.

Manual QA checklist:
- Visit `/work-orders` and verify the seeded list renders with status, priority, client, requested date, and updated date.
- Filter by status, priority, and client search, then sort by updated date, requested service date, and priority.
- Switch mock roles and confirm Coordinator/Owner can create work orders while Finance/Admin cannot.
- Create a work order with blank required fields and confirm friendly validation errors.
- Create a valid work order and confirm redirect to the detail page with status `new`.
- Edit a non-terminal work order as Coordinator, Manager, or Owner and confirm activity timeline entries update.
- Confirm closed and cancelled work orders are read-only by default.
- Confirm Coordinator can move operational statuses up to completed but cannot close completed work orders.
- Confirm Finance/Admin can close completed work orders but does not see normal operational transitions.
- Confirm cancel asks for confirmation and terminal states expose no further transitions.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
