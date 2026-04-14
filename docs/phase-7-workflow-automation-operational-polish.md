# Phase 7: Workflow Automation & Operational Polish

Phase 7 adds the MVP operational polish layer for Pinnacle without introducing external delivery systems, schedulers, or advanced orchestration.

## Built

- Central operational thresholds in `src/lib/config/operational-thresholds.ts`.
- Derived operational flags in `src/lib/flags/operational-flags.ts` for work orders, invoices, and quotes.
- Explicit System actor support for deterministic workflow sync activity.
- Internal workflow event scaffolding in `src/lib/workflow/internal-events.ts`.
- Central action availability helpers in `src/lib/workflow/action-availability.ts`.
- Queue presets and derived status indicators for internal work-order lists and details.
- Dashboard queues now surface stale active work, ready-to-dispatch work, overdue invoices, paid closeout, and quote bottlenecks more clearly.

## Automation Added

- Quote submission moves the work order to `quote_received`.
- Quote sent to client approval moves the work order to `pending_client_approval`.
- Client quote approval moves the work order to `approved_to_proceed`.
- Client quote rejection returns the work order to `quote_requested`.
- Creating a revised quote makes the new quote current and marks the previous current quote `superseded`.
- Invoice issuance moves the work order to `invoiced`.
- Invoice payment moves the work order to `paid`.
- Voiding the current invoice clears the current invoice and returns an invoiced work order to `completed` when no replacement exists.

Automated lifecycle sync uses actor name `System` and actor role `system` in activity history.

## Derived vs Persisted

The following are derived view-model flags, not persisted fields: stale work, overdue invoices, terminal/active state, quote blocking state, ready-to-dispatch, ready-to-invoice, awaiting payment, and ready-to-close.

Invoice status can still be explicitly marked overdue, but the UI and dashboard also derive overdue visibility from issued invoices whose due date has passed.

## Audit Improvements

Major user actions remain attributed to the user. Deterministic lifecycle sync and revision supersede behavior now adds separate System entries so operators can distinguish human actions from automated consistency updates.

## Intentionally Manual

The MVP still does not send emails/SMS, run cron jobs, assign contractors automatically, escalate SLAs, perform accounting sync, generate AI suggestions, or dispatch route optimization. Those remain future-phase concerns.

## Manual QA Checklist

- Send a reviewed quote to client approval and confirm the work order moves to `pending_client_approval` with a System activity entry.
- Record client approval and confirm the quote becomes `client_approved`, the work order becomes `approved_to_proceed`, and both user and System activity entries appear.
- Record client rejection and confirm the work order returns to `quote_requested`.
- Create a revised quote and confirm the previous current quote is marked `superseded`.
- Issue a draft invoice and confirm the work order moves to `invoiced`.
- Mark an invoice paid and confirm the work order moves to `paid`.
- Void the current invoice and confirm an invoiced work order returns to `completed` with no current invoice.
- Confirm issued invoices past due appear in overdue dashboard/list indicators.
- Confirm stale active work appears in manager/owner dashboards and list indicators.
- Exercise work-order queue presets: all active, needs review, awaiting quote, awaiting client approval, ready to dispatch, in progress, ready to invoice, awaiting payment, ready to close, terminal.
- Confirm closed/cancelled work orders show read-only state and hide/disable quote, invoice, and contractor execution actions.
- Confirm destructive or terminal actions still require confirmation: cancel work order, void invoice, close work order, and quote revision.

