# Production Setup Checklist

This checklist is for controlled production rollout of the Pinnacle work order platform in its current manual-first runtime phase.

Use this document together with:

- `docs/operations/manual-smoke-tests.md`
- `docs/operations/runtime-recovery-runbook.md`
- `docs/operations/production-readiness-status.md`

## Operator prerequisites

- [ ] Primary production domain is chosen and stable.
- [ ] One internal `owner` or `manager` account exists in production.
- [ ] One finance-admin account exists for invoice verification.
- [ ] One client user and one contractor user exist for portal smoke tests.
- [ ] One staging or launch organization has at least one client organization, one location, and one assignable contractor.
- [ ] An operator can access Firebase console, Vercel project settings, Microsoft app registration, QuickBooks sandbox, and SendGrid.

## 1. Core runtime environment

- [ ] `NODE_ENV=production` on every production deployment target.
- [ ] `APP_URL` is set to the canonical external base URL, for example `https://ops.example.com`.
- [ ] `APP_URL` matches:
  - Firebase authorized domains
  - Microsoft redirect URI registration
  - QuickBooks redirect URI registration
  - operator documentation and runbooks
- [ ] Vercel production environment variables are populated for every required Firebase value.
- [ ] Preview deployments are not used for production OAuth callbacks or production webhooks.
- [ ] No production callback, webhook, or auth flow points at `localhost`.
- [ ] Production runtime logs are enabled in Vercel.

### Vercel expectations

- [ ] The app is deployed as the canonical internal web runtime.
- [ ] Server-side Firebase Admin credentials are available to the deployed app.
- [ ] Production uses only production secrets, not local `.env.local` copies.
- [ ] The primary production domain is used for session establishment and operator API access.

### Runtime worker expectations

- [ ] This phase assumes explicit operator-driven runtime execution, not a hidden autonomous daemon.
- [ ] Runtime execution surfaces are reachable only through authenticated internal admin APIs:
  - `GET /api/operations/runtime/summary`
  - `GET /api/operations/runtime/health`
  - `GET /api/operations/runtime/alerts`
  - `GET /api/operations/runtime/dead-letter`
  - `GET /api/operations/runtime/replay`
  - `POST /api/operations/runtime/repair`
  - `POST /api/operations/runtime/repair/confirm`
  - `GET /api/runtime/operator/diagnostics`
  - `POST /api/runtime/operator/events/process`
  - `POST /api/runtime/operator/jobs/process`
  - `POST /api/runtime/operator/dead-letter/replay`
- [ ] Operators understand that lease-safe job processing and replay are explicit actions.

## 2. Firebase

- [ ] Firestore is enabled in the target Firebase project.
- [ ] Storage is enabled in the target Firebase project.
- [ ] Firebase Auth is enabled in the target Firebase project.
- [ ] Browser config values are populated:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`
- [ ] Admin SDK values are populated:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_STORAGE_BUCKET`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`
  - `FIREBASE_DATABASE_URL` if used by the target project
- [ ] `FIREBASE_STORAGE_BUCKET` and `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` resolve to the same bucket.
- [ ] `FIRESTORE_DATABASE_ID` is set if production does not use the default Firestore database.

### Rules and indexes

- [ ] Firestore rules from `firestore.rules` are deployed.
- [ ] Storage rules from `storage.rules` are deployed.
- [ ] Firestore composite indexes are verified for production workloads.
- [ ] If Firebase console prompts for new composite indexes during staging smoke tests, export and commit the index manifest before production launch.
- [ ] Launch is blocked until required Firestore indexes are captured and deployable.

### Bucket verification

- [ ] Upload one test attachment to `work-orders/<workOrderId>/attachments/<fileName>`.
- [ ] Confirm Storage stores the object in the expected bucket.
- [ ] Confirm the work-order metadata record and canonical communication attachment record are both written.

### Emulator safety notes

- [ ] Never point local emulators at production service-account credentials.
- [ ] Never use production webhook endpoints during emulator testing.
- [ ] Never use production Firebase auth domains in local smoke tests.

### Production auth domains

- [ ] Firebase Auth authorized domains include the production Vercel domain and any approved custom production domain.
- [ ] Unauthorized domains, temporary preview domains, and `localhost` are removed from production-only app registrations where possible.

## 3. Microsoft provider integration

- [ ] A Microsoft app registration exists for the production mailbox integration.
- [ ] The registered redirect URI matches `MICROSOFT_REDIRECT_URI`.
- [ ] The mailbox access scopes granted in Microsoft match the intended ingestion design and the scopes persisted on the provider connection record.
- [ ] Admin consent is completed for production tenant access.
- [ ] The Microsoft webhook callback is configured to `https://<production-domain>/api/provider-runtime/webhooks/microsoft`.
- [ ] Webhook validation was tested with the `validationToken` handshake.
- [ ] Webhook deliveries include a valid `Date` header when available.
- [ ] Provider connection creation persists all required trusted metadata.

### Required provider connection fields

- [ ] `organizationId`
- [ ] `providerTenantId`
- [ ] `metadata.webhookSubscriptionId`
- [ ] `metadata.webhookClientState`

### Operational expectations

- [ ] Webhook tenant routing is derived only from the trusted provider connection mapping.
- [ ] Production webhook requests do not rely on caller-supplied `organizationId`.
- [ ] The production connection is `active` before enabling live webhook delivery.
- [ ] The stored webhook client state matches `MICROSOFT_WEBHOOK_CLIENT_STATE`.

## 4. QuickBooks sandbox

- [ ] `QUICKBOOKS_ENVIRONMENT=sandbox` until production finance verification is explicitly approved.
- [ ] The QuickBooks app redirect URI matches `QUICKBOOKS_REDIRECT_URI`.
- [ ] Sandbox credentials are populated:
  - `QUICKBOOKS_CLIENT_ID`
  - `QUICKBOOKS_CLIENT_SECRET`
  - `QUICKBOOKS_REDIRECT_URI`
- [ ] Token storage and refresh behavior are verified in the intended persistence path before any production cutover.
- [ ] At least one sandbox invoice smoke test is completed end to end.
- [ ] Production QuickBooks enablement is deferred until sandbox verification passes and production finance owners approve cutover.

## 5. SendGrid and notifications

- [ ] `SENDGRID_API_KEY` is populated only in the target environment where outbound delivery is approved.
- [ ] `SENDGRID_FROM_EMAIL` is a verified sender.
- [ ] `SENDGRID_FROM_NAME` is production-safe and recognizable to recipients.
- [ ] SPF is configured for the sender domain.
- [ ] DKIM is configured for the sender domain.
- [ ] A non-customer test outbound email is sent successfully.
- [ ] Bounce and suppression handling expectations are documented for operators.
- [ ] Production sender verification is complete before any customer-facing email is enabled.

## 6. Runtime and workers

- [ ] Durable outbox records are visible in Firestore under `durableOutbox`.
- [ ] Runtime jobs are visible in Firestore under `runtimeJobs`.
- [ ] Dead letters are visible in Firestore under `runtimeDeadLetters`.
- [ ] Runtime event processing records are visible in Firestore under `runtimeEventProcessings`.
- [ ] `GET /api/runtime/operator/diagnostics` is reachable as an internal operational admin.
- [ ] `GET /api/operations/runtime/health` returns a valid health payload for the launch organization.

### Replay and recovery readiness

- [ ] Durable outbox replay procedure is documented and rehearsed.
- [ ] Operator event replay has been verified with `POST /api/runtime/operator/events/process`.
- [ ] Dead-letter replay has been verified with `POST /api/runtime/operator/dead-letter/replay` or the command-center repair API.
- [ ] Stuck-job recovery has been verified with `POST /api/operations/runtime/repair`.
- [ ] Provider receipt replay has been verified with `POST /api/providers/replay`.

## 7. Security

- [ ] All production secrets are stored in Vercel or an approved secret manager.
- [ ] No `localhost` callback URLs remain in production auth or provider registrations.
- [ ] External ingress remains fail-closed:
  - missing provider mapping rejects
  - mismatched client state rejects
  - mismatched tenant rejects
- [ ] No development-only credentials are stored in production.
- [ ] `DEV_AUTH_ROLE` and `DEV_ORGANIZATION_ID` are not set in production.
- [ ] No debug-only routes or manual test credentials are exposed publicly.
- [ ] Operator runtime APIs are accessible only to internal `manager`, `finance_admin`, or `owner` users.

## 8. Production launch checklist

- [ ] Manual smoke tests are complete.
- [ ] Replay and recovery tests are complete.
- [ ] Provider ingestion tests are complete.
- [ ] Finance and invoice tests are complete.
- [ ] Contractor portal tests are complete.
- [ ] Client portal visibility tests are complete.
- [ ] Backup and recovery access is verified for Firebase and Vercel.
- [ ] Known launch constraints from `docs/operations/production-readiness-status.md` are accepted by stakeholders.

## Current launch blockers to resolve explicitly

- [ ] Commit and wire a Firestore indexes manifest if staging verification reveals required composite indexes.
- [ ] Confirm the exact production Microsoft permission set in the app registration and the persisted provider connection scopes.
- [ ] Complete sandbox-first QuickBooks verification before any production finance sync is enabled.
