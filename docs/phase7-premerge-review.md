# Phase 7 pre-merge review

Date: 2026-09-11. Read-only static review against locally available origin/main.
Frontend HEAD: 8208a90. API branch: codex/membership-authorization.
No merge or production changes performed. Review is targeted, not exhaustive.

## Blocking findings

1. P1: SettingsPage.tsx:92 does not reset or invalidate tenant-bound form state
   during restaurant changes. handleSave at line 177 targets the current
   restaurantId even while the form contains the previous restaurant's values.
   Slow or failed fetches allow saving A's settings to B. Reset/gate by loaded
   tenant identity and discard obsolete responses; test delayed and failed loads.
2. P1: 20260829102000_harden_restaurant_multitenant_access.sql adds membership
   policies but does not drop owners_select_own, owners_update_own or
   owners_insert_own from the original restaurant migration. Permissive policies
   combine with OR, preserving owner_id-based access after membership removal.
   Protect owner_id/organization reassignment as well as removing legacy paths.
3. P1, deployed grants unverified: owner/admin UPDATE policy on
   organization_subscriptions permits authoritative plan/status/trial edits when
   the caller has column or table UPDATE grants. Restrict billing writes to
   trusted backend operations; verify effective ACLs and add negative tests.
4. P1, deployed grants/data unverified: organization_subscription_backfill_conflicts
   has no RLS/client revocation in reviewed migrations and includes webhook tokens
   in details. The staff subscription SELECT policy also does not exclude secret
   columns. Effective client SELECT grants can expose these values. Restrict
   conflict records to service operations and expose only safe subscription fields.

## Additional fixes

5. P2: useSwitchRestaurant does not clear/update restaurantId in the URL;
   route priority can reselect A and overwrite the preference after choosing B.
6. P2: AppearancePage does not clear pending logoFile on restaurant changes.
   A's unsaved image can be uploaded to B when another branding edit is saved.
7. P2: AppearancePage does not invalidate account-bootstrap after saving branding,
   so the dashboard account menu may keep linking to the previous slug.

No concrete new API verifier regression identified in this review. Missing
issuer for legacy HS256 is an intentional compatibility exception, not an
asymmetric JWT exemption. Previous passing automated suites do not cover all
the scenarios above. Do not sign off integration until blockers are resolved.

## Remediation

Implemented in the Phase 7 worktree; database deployment remains pending:

- Settings and Appearance forms are keyed by authenticated user and restaurant,
  reject missing/failed loads, and ignore obsolete asynchronous responses.
- Pending logo state is discarded on tenant change; successful branding writes
  invalidate account-bootstrap so public links refresh.
- Explicit switching removes the stale restaurantId route override. Bootstrap
  reads no longer write preferences, avoiding stale-query selection reversals.
- Migration 20260911090000_harden_billing_and_membership_boundaries.sql removes
  legacy owner policies, guards client ownership/organization changes, and
  restricts billing/conflict table and column privileges. Trusted definer
  onboarding and service_role operations remain supported.
- billing_membership_boundaries_test.sql contains 50 rollback-only assertions
  and returns all ordered results, including finish diagnostics.

Do not treat static SQL review as deployment validation. Apply the migration
before the test in the self-hosted Supabase SQL editor; no infrastructure fork
or Docker changes are required.

The first deployed run passed 44/48 checks. Failures 25-28 exposed additional
legacy policy names absent from the repository. User-provided pg_policies
output confirmed the owner SELECT/UPDATE bypass and legacy INSERT/anonymous
SELECT rules. Follow-up migration 20260911091000 removes those exact aliases;
expanded tests check the policy allowlist and continued public slug RPC access.
The follow-up has not yet been executed against the user's database.
