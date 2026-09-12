# Phase 7 regression runbook

This runbook closes Task 20 of `Vapt_Codex_Implementation_Plan.md`.

## Automated gates

Run from the frontend repository:

```powershell
npm ci
npm test
npm run lint
npm run build
```

Run from the API repository on `codex/membership-authorization`:

```powershell
npm ci
npm test
npm run build
```

Verified locally on 2026-09-10 (existing installed dependencies):

- Frontend: 42 test files, 160 tests, zero failures after the slug UX correction.
- API: 241 tests, zero failures.
- ESLint: zero errors.
- Both production builds: exit code zero.

Sandbox subprocess restrictions initially caused EPERM in both test runners;
rerunning with subprocess permission passed. Existing non-fatal warnings remain:
React Router future flags, React act warnings, dialog accessibility warnings,
outdated Browserslist data, and a frontend bundle chunk over 500 kB.

## Remaining live evidence

Task 20 is not yet signed off. Automated coverage is not a claim that every
negative scenario was reproduced on the deployed environment.

- The user declined repeating onboarding resume, accepting the earlier manual
  validation and automated coverage. The latest run did not repeat fresh signup.
- The user confirmed duplicate slug rejection in Appearance and successful saving
  of a different value. This checks editing, not duplicate slug during onboarding.
  The generic-error UX was corrected with blur validation and inline conflict
  handling; five added tests passed. User waived another manual preview round.
- Recovery negative cases (unknown email, mismatch, old-password rejection and
  sign-out failure/retry) have automated coverage but no complete live record.
- Full order/payment submission and full OAuth connection were not exercised in
  these smoke checks; do not imply end-to-end payment validation.

## Coverage matrix

| Required scenario | Automated evidence | Live check |
| --- | --- | --- |
| Signup, code, verified session, onboarding, dashboard | `signup-verification-flow`, `verify-email-page`, `protected-route`, `onboarding-flow` | Smoke A |
| Signup resend cooldown and 429 | `verify-email-page` | Smoke A |
| Recovery request, code, password update | `password-recovery-flow` | Smoke B |
| Login to complete account | `account-bootstrap-query`, `protected-route` | Smoke C |
| Login to incomplete account | `account-bootstrap-query`, `protected-route` | Smoke A |
| Onboarding reload/resume | `onboarding-flow` | Smoke A |
| Onboarding failure rollback | `atomic_onboarding_finalization_test.sql` | Database suite |
| Duplicate slug | `onboarding-flow` | Smoke A |
| Real logo persistence | `restaurant-assets`, `appearance-logo-upload` | Smoke A |
| User A/B activation isolation | `activation-progress`, `restaurant_activation_progress_test.sql` | Smoke C |
| Organization with multiple restaurants | `account-bootstrap-query`, `restaurant-switcher` | Smoke C |
| User in multiple organizations | `account-bootstrap-query` | Smoke C |
| No restaurant never routes to subscription | `protected-route` | Smoke A |
| Logout/login has no stale subscription | `use-subscription` | Smoke C |
| RLS cross-tenant denial | `phase7_cross_tenant_regression_test.sql` | Database suite |
| Anonymous public menu works | `public-menu-rating`, `phase7_cross_tenant_regression_test.sql` | Smoke D |
| Anonymous billing/provider fields inaccessible | `phase7_cross_tenant_regression_test.sql`, `payment_v2_schema_test.sql` | Database suite |
| Storage cross-tenant denial | `phase7_cross_tenant_regression_test.sql`, `restaurant_asset_storage_test.sql` | Database suite |
| Valid and invalid API JWTs | API `jwt.test.ts`, `auth.test.ts` | API suite |

## Database suite

Apply `supabase/migrations/20260906090000_revoke_anon_organization_subscription_access.sql` before running the final database suite.

In Supabase Studio SQL Editor, run these files in order. Every file below returns every assertion as ordered `sequence` and `result` rows.

1. `supabase/tests/resumable_onboarding_test.sql`
2. `supabase/tests/atomic_onboarding_finalization_test.sql`
3. `supabase/tests/restaurant_asset_storage_test.sql`
4. `supabase/tests/restaurant_activation_progress_test.sql`
5. `supabase/tests/restaurant_entitlement_test.sql`
6. `supabase/tests/phase7_cross_tenant_regression_test.sql`

The final file must return `1..12`, twelve `ok` rows, and no `not ok` row. Every file ends with `rollback`, so fixture data is not retained.

Validated against the self-hosted Supabase instance on 2026-09-06: `12/12` assertions passed.

## Manual smoke

Use a clean browser profile and a disposable email alias. Do not reuse a session from development.

### Smoke A: new account

1. Create an account and confirm that the app opens email verification rather than dashboard.
2. Confirm that resend is disabled for 60 seconds and that a rate-limit response is not retried automatically.
3. Enter the code and confirm routing to onboarding.
4. Save step one, reload the page, and confirm the same draft and step return.
5. Try an existing slug and confirm a field-level conflict without losing entered data.
6. Finish onboarding and confirm dashboard routing, not subscription routing.
7. Upload a logo, reload on another browser/device, and confirm the persisted image.

Logo observation (2026-09-10, dxuxotkqz preview): bestochefo initially had no
logo. The user uploaded and saved an image; the success notification was
observed. After reloading Appearance, the image remained visible in both the
logo field and the live preview. The user then confirmed that the same image
appeared in another browser/device without uploading again. The reload was
directly observed; cross-browser/device confirmation is user-reported.

### Smoke B: recovery

1. Request recovery for both an existing and an unknown email; copy must not disclose account existence.
2. Open the recovery link/code, enter mismatched passwords, and confirm local validation.
3. Save a valid password and confirm global sign-out completes before redirecting
   to login with the password-change confirmation. No automatic dashboard login.
4. Sign in explicitly with the new password; bootstrap then chooses onboarding
   or dashboard from account state. The old password must fail.
5. If sign-out fails after the password update, confirm recovery restrictions
   remain active and retry only sign-out, without submitting the password again.

Global sign-out revokes refresh sessions. Previously issued access JWTs may
remain valid until expiry; this change does not implement immediate server-side
revocation of every access token.

Recovery observation (2026-09-09): on preview
`https://vaptmesaflow-dxuxotkqz-contatoupboost-2301s-projects.vercel.app`,
recovery was requested for Account A and the generic request confirmation was
observed. After changing the password, the user confirmed that the corrected
return-to-login flow worked, without automatic dashboard login (commit `085f133`).
This does not establish live results for unknown-email recovery, old-password
rejection, mismatched passwords, or sign-out failure/retry.

Recovery negative observation (2026-09-12, ptzic1k3o preview): submitting the
synthetic address qa-inexistente-20260912-7b32@example.com on /forgot-password
displayed the generic conditional recovery message without disclosing account
existence. The address was cleared afterward. This verifies the visible UI
response only, not timing indistinguishability, email delivery, or database
confirmation that the synthetic address is absent. Mismatch and old-password
checks still require user participation; no password was changed in this check.

User report (2026-09-12, ptzic1k3o preview): recovery link opened, password was
changed, and login worked normally. This does not confirm mismatched-password
or old-password rejection; those specific negative results were not reported.
The user also reported an unusable recovery OTP in the email. A separate
public/auth-email-recovery.html template now offers only the recovery button
and fallback ConfirmationURL. Confirmation email OTP remains unchanged.
Five email-template tests passed. Live mailer activation/delivery remains pending.

### Smoke C: account isolation

1. Login as Account A, select a restaurant, open subscription, and complete one activation module.
2. Logout and login as Account B without clearing browser storage.
3. Confirm no restaurant, subscription, or activation state from Account A appears.
4. For a multi-organization user, switch between accessible restaurants and confirm preference persistence.

Account-switch observation (2026-09-08): on preview
`https://vaptmesaflow-c6kpy6rqa-contatoupboost-2301s-projects.vercel.app`,
Account A (`bestochefo`, expired trial, Mercado Pago disconnected) logged out
through the application and Account B logged in in the same tab without clearing
browser storage. Account B showed `hamburger`, an 11-day remaining trial, four
menu items, its own restaurant settings, and an active Mercado Pago connection.
The restaurant selector listed only `hamburger`; no `bestochefo` reference was
observed in the inspected dashboard, selector, menu, or settings.
This verifies the observed post-login UI state and authenticated provider-status
lookup, not transient rendering during login, activation-state isolation,
multi-organization switching, or the full OAuth connection flow. Those checks
remained pending at that observation. API compatibility fix: `d378780` (HS256 without issuer).

Activation-switch observation (2026-09-09/10): on preview
`https://vaptmesaflow-dxuxotkqz-contatoupboost-2301s-projects.vercel.app`,
Account A's test trial was extended by the user to allow dashboard access.
The overview/metrics module was completed for `bestochefo`; after a page reload,
it remained completed while the other four modules remained pending.
Account A then logged out through the application without browser storage being
cleared. After the user logged into Account B, `hamburger` displayed all five
modules as pending, including overview/metrics, and its own 10-day trial banner.
This validates the observed A-to-B activation UI isolation and A reload
persistence, not cross-device persistence or transient rendering during login.
Multi-organization switching was subsequently checked below; the full OAuth
flow remains pending.

Multi-organization observation (2026-09-10, same preview): the user confirmed
creating a temporary active staff membership for Account A in hamburger's
organization. The selector listed both bestochefo and hamburger. Switching to
hamburger displayed its own 10-day trial and all five activation modules pending;
the selection persisted after a reload. The user then reported deleting the
exact temporary membership (organization `59808ffb-1f44-42e9-ae12-ae84278705e5`,
user `53d7fc92-7409-4cb8-80a0-1d859665d66b`, created at
`2026-09-10 16:37:45.378276+00`). Subsequent inspection and another reload showed
bestochefo, its own trial and completed overview module, and only bestochefo in
the selector. This establishes post-reload UI fallback and removal from the
selector, not immediate in-session revocation or direct API denial.

Same-organization observation (2026-09-10, same preview): after the user
temporarily changed organization `b4f2952d-1fd8-4eec-ba17-3abe73e59213` from
Starter to Business, the selector offered restaurant creation. The three-step
wizard created `QA descartavel unidade 2` (slug
`qa-bestochefo-unidade2-20260910`, id `7cdecc23-1c81-4f83-8a4a-271face858b9`)
in that organization, with salon service and one table. No orders or payments
were submitted. Its dashboard showed all five activation modules pending and
the organization's seven-day trial. The selector listed both units; switching
back to bestochefo and reloading preserved the selection and its completed
overview module. The user subsequently ran the scoped cleanup and supplied SQL
results confirming Starter, one restaurant, and the unchanged trial end
`2026-09-17 01:31:33.079044+00`. Post-cleanup reload on 2026-09-10 showed
only bestochefo in the selector, the one-restaurant-limit message, and no add
restaurant action. The completed overview module remained intact.

### Smoke D: public surface

1. Open a public menu in a signed-out/private window.
2. Confirm menu and ordering remain usable.
3. Confirm no billing, provider account, token, or OAuth state request succeeds anonymously.

## Operational evidence

### Pre-merge boundary fixes (2026-09-11)

Frontend verification after tenant form isolation and route-switch fixes:
188 tests passed across 44 files; npm run lint and npm run build passed.
Build retains non-blocking Browserslist-age and chunk-size warnings.
Regression tests cover delayed/failed/out-of-order loads, pending logo isolation,
branding cache invalidation, and explicit selection overriding stale route IDs.

Database follow-up: the user returned 44/48 passing results. Tests 25-28 failed
because deployed policies named "Owners can view own restaurant" and
"Owners can update own restaurant" survived the original named-policy cleanup.
Read-only inspection confirmed those, a legacy INSERT policy, and "Public can
view restaurant by slug" while RLS remained enabled. The follow-up migration
removes these confirmed aliases. Tests now reject unexpected restaurant policies
and also verify anonymous public RPC access. On 2026-09-12 the user returned
50/50 passing assertions and `# finish(): no failures` from the self-hosted
Supabase run. Previously failing tests 25-28 now pass. This database validation
is complete; no repeat execution is needed for the same deployed correction.
Run whole files as postgres, in order (skip the first if already applied):

1. supabase/migrations/20260911090000_harden_billing_and_membership_boundaries.sql
2. supabase/migrations/20260911091000_remove_deployed_legacy_restaurant_policies.sql
3. supabase/tests/billing_membership_boundaries_test.sql

The test plans 50 assertions, returns every ordered sequence/result row and
finish diagnostics, and rolls back its fixtures. SQL was statically reviewed,
not executed locally (psql unavailable). No API code changed in this correction;
no API redeploy or EasyPanel infrastructure changes are needed. The user-provided
results close this database regression blocker. Overall Task 20/release signoff
must still respect remaining runbook scope; no merge was performed.

Historical signup audit evidence (received 2026-09-11, user SQL results for
Account A): `user_confirmation_requested` at `2026-09-01 23:44:35.713241+00`
was followed by `user_signedup` at `2026-09-01 23:44:46.024714+00`.
This supplies the historical Auth events previously outside the 30-row query
window and complements the earlier user-reported signup/confirmation flow.
It is not a fresh signup test of the latest preview and does not by itself
establish onboarding routing or which confirmation method was used.

Resend evidence (2026-09-10, user screenshot): the Sending list was filtered to
Last 15 days / All Statuses / All API keys. Both visible password-reset emails
to Account A were Delivered (relative send times 19h ago and 1d ago), as were
four confirmation emails (9d/10d ago) and one unrelated test email. No failed or
bounced status appeared in the seven visible rows. This establishes delivery
status for those messages, not a complete event/complaint audit or exact send
timestamps.

Auth audit evidence (2026-09-10, user SQL results for Account A): UTC events show
`user_recovery_requested` at 00:04:54.282064, `login` at 00:23:59.890487,
`user_updated_password` at 00:24:07.946207, `user_modified` at
00:24:07.947158, `logout` at 00:24:08.030463, and a subsequent `login` at
00:24:18.539268. Together with the user's UI confirmation, this supports the
corrected password-update -> logout -> explicit-login flow. The earlier login
event precedes the password change; it does not establish automatic dashboard
navigation. These rows do not prove immediate invalidation of all access JWTs,
old-password rejection, or signup/verification audit events outside the query's
30-row window.

Public-menu observation (2026-09-09): after application logout, the same preview
loaded `/menu/hamburger`. Without a table it requested the table QR code, as
implemented. `/menu/hamburger?table=1` displayed the restaurant and categories.
Opening `hamberger`, adding one item, and reviewing the cart showed BRL 23.00
and the online payment button. No order or payment was submitted. The anonymous
provider-status navigation was blocked by the browser (`ERR_BLOCKED_BY_CLIENT`),
so it does not establish an API authorization result. Full order submission and
live anonymous API denial remained pending at that observation; the database
denial suite above passed.

Live anonymous API check (2026-09-10): a direct GET without Authorization to
`https://samuel-vapt-api.br8r5p.easypanel.host/restaurants/07251443-7559-4628-af49-b6e207854e95/payments/mercado-pago/status?environment=production`
returned HTTP 401 and only `{"error":{"code":"unauthorized","message":"Unauthorized"}}`.
The initial sandbox network attempt was refused; the permitted network retry
produced this response. This verifies that endpoint without credentials, not
all provider endpoints or authenticated cross-tenant denial.

After Smoke A and Smoke B:

1. Supabase Auth logs show signup, verification, and recovery events for the test aliases.
2. Resend shows delivered events and no unexpected bounce/complaint.
3. Confirmation and recovery links point to an allowed Vapt domain or current Vercel preview, never localhost.
4. Record the preview URL, timestamp, test aliases, and any failed step before approving the release.
