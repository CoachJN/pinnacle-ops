# Phase 4 Quote System

## Implementation Note

Phase 4 adds an MVP quote workflow inside the Work Order lifecycle. Quotes are not a standalone module: quote creation, review, client approval recording, and quote history are all reached from Work Order Detail.

Work orders now carry `requiresQuote` and `currentQuoteId`. The lifecycle supports quote-specific states:

- `quote_requested`
- `quote_received`
- `pending_client_approval`
- `approved_to_proceed`

If `requiresQuote` is true, dispatch is blocked by centralized transition permission logic until the current quote is `client_approved` and the work order has reached `approved_to_proceed`. Work orders that do not require quotes can still move from `in_review` to `dispatched`.

Quote versions are stored as history on the work order. Only one quote is current at a time through `currentQuoteId`. Creating a revised quote supersedes the previous current quote and increments the version number. Superseded and rejected quotes remain visible in the work order quote history.

Intentionally excluded from this MVP phase:

- Invoicing
- Payment tracking
- External client portal authentication
- External contractor portal authentication
- Notifications
- SLA automation
- File uploads
- Advanced reporting

## Manual QA Checklist

- No-quote flow: create or open a work order, move it to `in_review`, leave `requiresQuote` false, then confirm dispatch is available for an operational role.
- Quote-required flow: mark a work order as requiring quote, request quote, create a quote draft, submit it, and confirm the work order moves to `quote_received`.
- Manager review flow: switch to manager, mark a submitted quote under review, add internal notes, send it to client approval, and confirm the work order moves to `pending_client_approval`.
- Client approve flow: record client approval with optional notes and confirm quote status becomes `client_approved` and work order status becomes `approved_to_proceed`.
- Client reject flow: record client rejection with optional notes and confirm quote status becomes `client_rejected` and work order status returns to `quote_requested`.
- Revised quote flow: create a revised quote from a rejected/current quote and confirm the new quote becomes current, increments version number, and the old active quote is superseded in history.
- Dispatch blocking: set `requiresQuote` true on an `in_review` work order and confirm dispatch is not available until the client-approved quote path is complete.
