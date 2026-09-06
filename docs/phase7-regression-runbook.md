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

Expected baseline on 2026-09-05:

- Frontend: 42 test files, 151 tests after the Phase 7 resend regression, zero failures.
- API: 230 tests, zero failures.
- ESLint: zero errors.
- Both production builds: exit code zero.

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

### Smoke B: recovery

1. Request recovery for both an existing and an unknown email; copy must not disclose account existence.
2. Open the recovery link/code, enter mismatched passwords, and confirm local validation.
3. Save a valid password and confirm bootstrap chooses onboarding or dashboard from account state.

### Smoke C: account isolation

1. Login as Account A, select a restaurant, open subscription, and complete one activation module.
2. Logout and login as Account B without clearing browser storage.
3. Confirm no restaurant, subscription, or activation state from Account A appears.
4. For a multi-organization user, switch between accessible restaurants and confirm preference persistence.

### Smoke D: public surface

1. Open a public menu in a signed-out/private window.
2. Confirm menu and ordering remain usable.
3. Confirm no billing, provider account, token, or OAuth state request succeeds anonymously.

## Operational evidence

After Smoke A and Smoke B:

1. Supabase Auth logs show signup, verification, and recovery events for the test aliases.
2. Resend shows delivered events and no unexpected bounce/complaint.
3. Confirmation and recovery links point to an allowed Vapt domain or current Vercel preview, never localhost.
4. Record the preview URL, timestamp, test aliases, and any failed step before approving the release.
