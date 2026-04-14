# Phase 6 Finance Workflow

## What Was Built

Phase 6 adds the MVP internal finance closeout workflow for work orders. Invoices are subordinate to work orders and are managed from the work order detail finance section plus finance-focused dashboard queues.

The work order lifecycle now separates operational completion from financial closure:

- `completed` means operational work is done and can be invoiced.
- A draft invoice keeps the work order in `completed`.
- Issuing the current invoice moves the work order to `invoiced`.
- Marking the current invoice paid moves the work order to `paid`.
- Finance/Admin or Owner can close only paid work orders with a paid current invoice.

## Invoice Behavior

Each work order has zero or one active `currentInvoiceId` in this MVP. Voided invoices remain in invoice history. If the current invoice is voided, the work order returns to `completed` when applicable and finance can create a replacement invoice.

Supported invoice statuses are:

- `draft`
- `issued`
- `paid`
- `overdue`
- `void`

Allowed invoice transitions are:

- `draft -> issued, void`
- `issued -> paid, overdue, void`
- `overdue -> paid, void`
- `paid` and `void` are terminal

Overdue support is both explicit and simple: Finance/Admin or Owner can manually mark an issued invoice overdue, and the UI also derives an overdue display state when an issued invoice is past due.

## Intentional MVP Exclusions

This phase intentionally does not include external accounting integrations, payout or remittance workflows, tax engines, notifications, SLA automation, file uploads, advanced reporting, external client invoice portals, or multi-invoice accounting. Future accounting integrations can attach to the centralized invoice repository/actions and lifecycle events.

## Manual QA Checklist

- Create an invoice from a completed work order with no current invoice.
- Confirm the saved draft appears in the work order invoice section and history.
- Edit a draft invoice and verify subtotal, tax, and total recompute.
- Issue a draft invoice and confirm the work order moves from `completed` to `invoiced`.
- Mark an issued or overdue invoice paid with an optional payment reference and confirm the work order moves to `paid`.
- Close a paid work order as Finance/Admin or Owner and confirm it becomes terminal `closed`.
- Void a draft or issued invoice and confirm it remains historical while the work order can be invoiced again.
- Verify Finance/Admin and Owner can perform invoice actions.
- Verify Manager and Coordinator can view internal invoice summaries/history but cannot author, issue, void, pay, or close via finance workflow.
- Verify contractor-facing work order projections do not include invoice totals, invoice status, finance notes, or finance actions.
