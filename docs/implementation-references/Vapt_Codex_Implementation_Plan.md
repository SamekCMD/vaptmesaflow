# Vapt Auth, Multi-Tenant & Onboarding V2 — Codex Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

> **Manual pgTAP convention:** every SQL test intended for the Supabase SQL Editor must collect `plan()`, every assertion and `finish()` into a temporary results table, then return one final ordered `select sequence, result`. If the test changes to `authenticated` or `anon`, grant those roles `insert` on the temporary results table. The editor otherwise exposes only the final result set and hides the failing assertion.

**Goal:** Replace the current fragile authentication/onboarding flow with a secure, resumable, multi-tenant-ready architecture based on Supabase Auth, Organizations, Memberships, Restaurants, Resend, server-side abuse controls, and deterministic account routing.

**Architecture:** A user belongs to one or more organizations through memberships. Organizations own restaurants and subscriptions. Authentication stays in Supabase Auth. A single account bootstrap determines whether the user must verify email, create/finish a restaurant, choose a restaurant, or enter the dashboard. Onboarding is persisted server-side and finalized idempotently. Public restaurant data is separated from private billing/provider data.

**Tech Stack:** React 18, React Router 6, TypeScript, Vite, TanStack Query, Supabase JS, Supabase Postgres/RLS/Storage/Auth, Fastify 5, Vitest, Node test runner, Resend, Cloudflare Turnstile.

**Spec:** `Vapt_Auth_Multitenant_Onboarding_V2_Architecture_and_Action_Plan.docx`

## Global Constraints

- Keep Supabase Auth; do not create a custom password database or custom password login endpoint.
- Multi-tenant is a first-class design requirement: users may belong to multiple organizations and organizations may own multiple restaurants.
- Subscription/plan ownership belongs to the organization, not the user and not an individual restaurant.
- Preserve public menu access while preventing anonymous access to private billing/provider fields.
- Never store passwords outside Supabase Auth and never persist pending passwords in localStorage/sessionStorage.
- Use one canonical Supabase client in the frontend.
- Use TanStack Query for server state; do not introduce new module-level global caches for account/restaurant/subscription data.
- Enable Supabase email confirmation and Cloudflare Turnstile before exposing the new signup flow publicly.
- Initial custom SMTP provider: Resend. Initial Supabase project-wide auth-email target: 10 emails/hour; keep 60-second per-recipient resend/recovery cooldown.
- Treat 429 as an expected UI state with retry guidance; never auto-retry email-triggering auth calls in a loop.
- Generic password-recovery responses must not reveal whether an account exists.
- Trial start/end and onboarding completion timestamps are server-side values.
- No task may mark onboarding complete before all required finalization work succeeds.
- All migrations must be backward-safe until corresponding application reads have migrated.
- TDD: each behavioral change begins with a failing test, then minimal implementation, then passing tests.
- Run `npm test`, `npm run lint`, and `npm run build` in `vaptmesaflow` before a frontend PR is declared complete.
- Run `npm test` and `npm run build` in `vapt-api` before an API PR is declared complete.

---

## Target state machine

```text
VISITOR
  -> SIGNUP_PENDING_VERIFICATION
  -> AUTHENTICATED
  -> ACCOUNT_BOOTSTRAP
       -> NO_ORGANIZATION      -> ORGANIZATION/RESTAURANT ONBOARDING
       -> NO_RESTAURANT        -> RESTAURANT ONBOARDING
       -> RESTAURANT_DRAFT     -> RESUME ONBOARDING
       -> MULTIPLE_RESTAURANTS -> RESTAURANT SELECTOR / LAST VALID SELECTION
       -> READY                -> DASHBOARD

PASSWORD_RECOVERY is a separate temporary flow and must override normal dashboard routing until password update completes.
```

## File map

### Frontend — existing files to modify
- `src/contexts/AuthContext.tsx` — session primitives only; remove page-specific redirect assumptions.
- `src/pages/auth/SignupPage.tsx` — signup request; route to verification state, never directly to dashboard/onboarding.
- `src/pages/auth/LoginPage.tsx` — login + forgot-password entry; route through bootstrap.
- `src/components/ProtectedRoute.tsx` — replace binary user/no-user behavior with account bootstrap-aware gates.
- `src/App.tsx` — add verify, forgot-password, recovery/new-password, restaurant-selection routes.
- `src/pages/onboarding/OnboardingPage.tsx` — split into resumable server-persisted onboarding.
- `src/lib/onboarding.ts` — remove account-bound localStorage as source of truth.
- `src/components/dashboard/OnboardingGuideCard.tsx` — consume persisted activation progress.
- `src/contexts/RestaurantContext.tsx` — remove TODO/local-only source-of-truth behavior or reduce to view state.
- `src/lib/restaurants.ts` — remove heuristic "best restaurant" selection.
- `src/components/DashboardLayout.tsx` — use canonical current restaurant query; no no-restaurant -> subscription redirect.
- `src/hooks/useSubscription.ts` — eliminate module-level singleton cache and key subscription by organization.
- `src/pages/dashboard/Overview.tsx` — consume canonical account/restaurant/activation queries.
- `src/lib/supabase.ts` and `src/integrations/supabase/client.ts` — converge to one client.
- `src/test/onboarding-flow.test.tsx` — replace contradictory assumptions and add resumability/atomicity coverage.

### Frontend — recommended new files
- `src/features/auth/auth-service.ts`
- `src/features/auth/AccountBootstrap.tsx`
- `src/features/auth/account-bootstrap-query.ts`
- `src/features/auth/VerifyEmailPage.tsx`
- `src/features/auth/ForgotPasswordPage.tsx`
- `src/features/auth/ResetPasswordPage.tsx`
- `src/features/auth/auth-errors.ts`
- `src/features/restaurants/current-restaurant.ts`
- `src/features/restaurants/RestaurantSelectorPage.tsx`
- `src/features/onboarding/onboarding-service.ts`
- `src/features/onboarding/onboarding-query.ts`
- `src/features/onboarding/steps/RestaurantBasicsStep.tsx`
- `src/features/onboarding/steps/OperationStep.tsx`
- `src/features/onboarding/steps/ReadyStep.tsx`
- `src/features/activation/activation-progress.ts`

### Supabase migrations — recommended sequence
- `supabase/migrations/<timestamp>_create_organizations_and_memberships.sql`
- `supabase/migrations/<timestamp>_move_subscription_to_organization.sql`
- `supabase/migrations/<timestamp>_harden_restaurant_public_private_access.sql`
- `supabase/migrations/<timestamp>_add_resumable_onboarding.sql`
- `supabase/migrations/<timestamp>_harden_storage_policies.sql`
- `supabase/migrations/<timestamp>_add_activation_progress.sql`

### API — existing files to modify
- `src/lib/jwt.ts` — replace manual HMAC verification with JOSE/JWKS verification and issuer/audience checks.
- `src/plugins/auth.ts` — consume verified claims from the new verifier.
- `src/modules/auth/routes.ts` — keep access endpoints; make organization membership the authorization primitive.
- `package.json` — add `jose` and, if chosen for API-side generic limits, `@fastify/rate-limit`.

---

## Phase 1 — Schema and authorization foundation

### Task 1: Create organizations and memberships
**Deliverable:** Existing users/restaurants are backfilled into organizations without breaking current reads.

- [ ] Write a migration test/query that counts distinct current `restaurants.owner_id` values and proves every current restaurant can be assigned to exactly one generated organization.
- [ ] Create `organizations(id uuid primary key, name text not null, created_by uuid not null, created_at timestamptz, updated_at timestamptz)`.
- [ ] Create `organization_members(organization_id uuid, user_id uuid, role text, status text, created_at timestamptz)` with unique `(organization_id,user_id)`.
- [ ] Restrict `role` to `owner|admin|manager|staff` and `status` to `active|invited|disabled`.
- [ ] Add nullable `organization_id` to `restaurants`.
- [ ] Backfill one organization per distinct legacy owner, create owner membership, attach all that owner's restaurants.
- [ ] Add foreign key and `NOT NULL` to `restaurants.organization_id` only after backfill validation.
- [ ] Keep `owner_id` temporarily for compatibility; mark it deprecated in migration comments.
- [ ] Add indexes on membership user/org columns and `restaurants.organization_id`.
- [ ] Verify: no restaurant has null organization; every legacy owner is an active owner member of the assigned organization.
- [ ] Commit schema foundation.

### Task 2: Move subscription ownership to organization
**Deliverable:** Plan/trial/provider state is organization-scoped and no longer drives restaurant identity selection.

- [ ] Create `organization_subscriptions` with `organization_id` unique, `plan_type`, `plan_status`, `trial_ends_at`, provider identifiers/status/error fields and timestamps.
- [ ] Backfill organization subscription state from the highest-priority valid legacy subscription among that organization's restaurants, logging conflicts for manual review instead of silently overwriting inconsistent provider IDs.
- [ ] Keep legacy restaurant columns during compatibility window; stop writing them from new code.
- [ ] Define plan entitlement lookup with at minimum a maximum-restaurants value; do not encode pricing in frontend components.
- [ ] Add database/RPC validation that creating another restaurant fails when the organization has reached its entitlement.
- [ ] Verify one subscription record per organization and no current billing flow loses data.
- [ ] Commit organization subscription migration.

### Task 3: Harden public/private data access
**Deliverable:** Anonymous users can read only public restaurant presentation/menu data; billing/provider metadata is never exposed through broad `SELECT` policies.

- [ ] Add RLS helper functions for `is_organization_member`, `has_organization_role`, and restaurant membership resolution.
- [ ] Replace `restaurants ... USING (true)` public/authenticated policies with owner/member-scoped private policies.
- [ ] Create an explicit public projection (view/RPC/table) exposing only fields needed by the public menu: id, slug, name, logo URL, public branding/contact/configuration.
- [ ] Update public menu reads to consume the public projection.
- [ ] Ensure `organization_subscriptions` has no anonymous access and only appropriate organization roles can read it.
- [ ] Add RLS tests proving User A cannot select/update User B's private restaurant rows and anonymous requests cannot access billing/provider values.
- [ ] Commit RLS hardening.

### Task 4: Harden Storage ownership
**Deliverable:** An authenticated user cannot upload/overwrite/delete assets belonging to another organization/restaurant.

- [ ] Define object path convention: `organizations/{organizationId}/restaurants/{restaurantId}/{assetType}/{uuid}.{ext}`.
- [ ] Replace bucket-wide authenticated INSERT/UPDATE/DELETE policies with path + membership checks.
- [ ] Keep read public only for assets intentionally used in public menus; otherwise use authenticated/private access.
- [ ] Add policy tests for cross-organization denial.
- [ ] Commit storage hardening.

---

## Phase 2 — Canonical account state and current restaurant

### Task 5: Converge to one Supabase client
**Deliverable:** Only one runtime Supabase client/storage key exists.

- [ ] Add a test/import check demonstrating which client is canonical.
- [ ] Migrate imports from the generated duplicate client to `src/lib/supabase.ts` (or choose the generated client and migrate the inverse; never keep both active).
- [ ] Remove or convert the unused duplicate to a re-export so two `createClient` calls cannot initialize independently.
- [ ] Run full frontend test/lint/build.
- [ ] Commit client convergence.

### Task 6: Implement account bootstrap query
**Deliverable:** Every authenticated route receives one deterministic account state.

**Produces:**
```ts
type AccountBootstrap = {
  userId: string;
  organizations: Array<{ id: string; name: string; role: 'owner'|'admin'|'manager'|'staff' }>;
  currentOrganizationId: string | null;
  restaurants: Array<{ id: string; organizationId: string; name: string; slug: string; onboardingStatus: 'draft'|'complete' }>;
  currentRestaurantId: string | null;
  destination: 'onboarding'|'select-restaurant'|'dashboard';
};
```

- [ ] Write tests for no organization, organization/no restaurant, draft restaurant, one ready restaurant, multiple restaurants, stale saved restaurant ID, and cross-org saved ID.
- [ ] Implement a TanStack Query keyed by authenticated `user.id`.
- [ ] Persist last valid organization/restaurant selection in a user preference row or equivalent server-side preference; URL restaurant ID remains authoritative when present.
- [ ] Remove `fetchOwnedRestaurant` heuristic selection from routing decisions.
- [ ] Commit account bootstrap.

### Task 7: Replace scattered restaurant/subscription state
**Deliverable:** DashboardLayout, Overview and subscription UI consume organization/current-restaurant queries instead of independently fetching and caching.

- [ ] Write regression test: authenticated user with no restaurant is routed to onboarding, never subscription.
- [ ] Write regression test: logout User A -> login User B does not reuse User A's restaurant/subscription snapshot.
- [ ] Remove module-level singleton `subscriptionSnapshot`, `inFlightFetch`, `listeners` from `useSubscription.ts`.
- [ ] Key subscription query by organization ID.
- [ ] Update DashboardLayout/Overview/RestaurantContext consumers.
- [ ] Commit canonical server state.

---

## Phase 3 — Authentication, email confirmation, recovery and abuse prevention

### Task 8: Add abuse protection configuration
**Deliverable:** Automated scripts cannot cheaply consume auth email quota through the normal Supabase Auth path.

- [ ] Configure Resend as custom SMTP for Supabase Auth and verify sender domain SPF/DKIM/DMARC.
- [ ] Configure Supabase Auth project-wide email-send rate to 10 emails/hour initially.
- [ ] Keep signup confirmation and password recovery cooldown at 60 seconds per recipient.
- [ ] Enable Cloudflare Turnstile in Supabase Auth Bot and Abuse Protection.
- [ ] Add Turnstile token generation to signup, login, and password reset forms using the Supabase-supported captcha token option.
- [ ] Do not create frontend-only "security limits" and call them enforcement; frontend cooldowns are UX only.
- [ ] Add a standardized 429 mapper that shows retry guidance and never automatically replays an email send.
- [ ] Add generic recovery success copy independent of account existence.
- [ ] Document an emergency runbook: disable email signup temporarily, lower email rate, inspect Auth logs/Resend events, rotate compromised keys if needed.
- [ ] Commit abuse protection configuration/code.

### Task 9: Fix signup state machine and add email-code verification
**Deliverable:** Signup can no longer race between `/dashboard` and `/onboarding`, and confirmed email is mandatory before onboarding.

- [ ] Write failing integration test: signup with confirmation required returns no session and lands on verify-email page.
- [ ] Write failing test: SignupPage must not have an effect that redirects merely because `user` becomes truthy during submit.
- [ ] Implement `auth-service.ts` methods: `signUp`, `verifySignupOtp`, `resendSignupOtp`, `signIn`, `signOut`.
- [ ] Never persist the password; persist only normalized pending email when necessary to survive refresh.
- [ ] Add VerifyEmailPage using the configured Supabase email token/OTP flow.
- [ ] Add 60-second resend UX countdown; backend remains the authority.
- [ ] Valid verification -> session -> AccountBootstrap.
- [ ] Invalid/expired code -> remain on verification page with clear retry/resend action.
- [ ] Commit verified signup flow.

### Task 10: Add forgot-password and password recovery
**Deliverable:** Password recovery is secure, enumeration-resistant, and does not accidentally route to dashboard mid-flow.

- [ ] Write tests for request reset, unknown email generic success, 429, invalid/expired recovery code, valid code, password mismatch, successful password update.
- [ ] Add `/forgot-password` and `/reset-password` routes.
- [ ] Implement `requestPasswordReset`, recovery verification, and `updateUser({ password })` via Supabase Auth.
- [ ] Recovery state temporarily overrides normal authenticated dashboard redirects until the password has been updated or the flow is canceled.
- [ ] After success, clear recovery state and route through account bootstrap.
- [ ] Commit recovery flow.

### Task 11: Refactor route guards around bootstrap
**Deliverable:** Login/signup/onboarding/dashboard all use one routing policy.

- [ ] Tests: unauthenticated protected route -> login; verified/no restaurant -> onboarding; draft -> resume onboarding; ready -> dashboard; multiple ready -> last valid restaurant or selector; pending recovery -> reset page.
- [ ] Replace binary ProtectedRoute logic with auth + bootstrap gates.
- [ ] Remove page-local blind `navigate('/dashboard')` effects from LoginPage/SignupPage.
- [ ] Commit deterministic routing.

---

## Phase 4 — Resumable, atomic onboarding

### Task 12: Persist onboarding draft server-side
**Deliverable:** Refresh/device changes do not erase onboarding progress.

- [ ] Add onboarding status/step fields to restaurants or a dedicated restaurant onboarding table. Use statuses `draft|complete`; store `onboarding_step` and `onboarding_updated_at`.
- [ ] First onboarding save creates organization if necessary and a draft restaurant if none exists; subsequent saves update the same restaurant id.
- [ ] Save each step idempotently.
- [ ] Do not start trial or mark completion from browser-generated timestamps.
- [ ] Test refresh/resume and duplicate submit.
- [ ] Commit draft persistence.

### Task 13: Split onboarding UI into three focused steps
**Deliverable:** A shorter professional flow with progressive setup rather than forced busywork.

1. Restaurant basics — name, slug, WhatsApp.
2. Operation — operational mode/table count and only information needed to make the system usable.
3. Ready — review and finalize.

- [ ] Extract step components and a small controller/query layer.
- [ ] Branding and first dish become optional activation tasks after onboarding rather than blockers.
- [ ] Back/next navigation saves before moving.
- [ ] Validation errors are field-level and server conflicts (e.g. slug) get human copy.
- [ ] Commit onboarding UI split.

### Task 14: Make finalization atomic/idempotent
**Deliverable:** A menu insert or secondary failure can never leave a restaurant falsely marked complete.

- [ ] Create a Postgres RPC/transaction for onboarding finalization.
- [ ] Validate caller membership and restaurant ownership in the database.
- [ ] Create required initial operational records.
- [ ] Set server-side trial timestamps if trial starts at first completed restaurant.
- [ ] Set `onboarding_status='complete'` and completion timestamp last inside the transaction.
- [ ] Re-running finalization returns the already-complete restaurant safely instead of duplicating rows.
- [ ] Add failure injection test proving rollback.
- [ ] Commit atomic finalization.

### Task 15: Implement real logo upload
**Deliverable:** Logo preview is backed by Storage and persists across devices.

- [ ] Validate content type and size client-side for UX and server-side/policy-side where possible.
- [ ] Upload to organization/restaurant-scoped path.
- [ ] Persist returned path/public URL in restaurant branding state.
- [ ] Remove FileReader-only behavior as the final source of truth.
- [ ] Test storage error without losing onboarding draft.
- [ ] Commit logo persistence.

---

## Phase 5 — Activation guide and multi-restaurant UX

### Task 16: Replace localStorage guide progress
**Deliverable:** Activation progress belongs to a restaurant and never leaks between accounts/browsers.

- [ ] Create `restaurant_activation_progress(restaurant_id, module_key, completed_at, completed_by)` unique by restaurant/module.
- [ ] Migrate guide reads/writes to Supabase.
- [ ] Do not mark all modules complete at onboarding finalization.
- [ ] Success screen may offer "go to dashboard" and the guide reflects actual incomplete modules.
- [ ] Test Account A/B isolation and cross-device persistence.
- [ ] Commit activation persistence.

### Task 17: Add restaurant selector and plan entitlement behavior
**Deliverable:** Multi-restaurant is explicit and safe even before high-tier sales are enabled broadly.

- [ ] Add restaurant switcher visible when organization has >1 accessible restaurant.
- [ ] Add selector page for ambiguous bootstrap state.
- [ ] Enforce create-restaurant entitlement server-side; frontend only reflects the result.
- [ ] Add organization role checks for who may create restaurants.
- [ ] Test multiple restaurants, multiple organizations and staff access subsets.
- [ ] Commit multi-restaurant UX.

---

## Phase 6 — Backend JWT/security modernization

### Task 18: Replace manual HS256 verifier with JOSE/JWKS
**Deliverable:** `vapt-api` validates Supabase tokens using standard cryptographic verification and explicit claims.

- [ ] Add `jose` dependency.
- [ ] Write Node tests for valid token, expired token, bad issuer, bad audience, unknown key, tampered signature.
- [ ] Implement remote JWKS verification for the Supabase project signing keys.
- [ ] Validate `iss`, `aud`, `exp`, and `sub`.
- [ ] Remove handwritten JWT signature/JSON parsing logic.
- [ ] Update auth plugin and routes to use typed verified claims.
- [ ] Run API test/build.
- [ ] Commit JWT modernization.

### Task 19: Authorize API access by membership
**Deliverable:** API access no longer assumes restaurant.owner_id is the only relationship.

- [ ] Write tests for owner/admin/manager/staff access and non-member denial.
- [ ] Resolve restaurant -> organization -> active membership.
- [ ] Use role/permission checks for privileged API operations.
- [ ] Keep authorization server-side even if UI hides restricted actions.
- [ ] Commit multi-tenant API authorization.

---

## Phase 7 — End-to-end verification and cleanup

### Task 20: Full regression suite
**Must cover:**
- signup -> code -> verified session -> onboarding -> dashboard;
- signup resend cooldown and 429;
- recovery request -> recovery code -> password update;
- login to complete account;
- login to incomplete account;
- onboarding reload/resume;
- onboarding finalization failure rollback;
- duplicate slug;
- real logo persistence;
- User A/B activation isolation;
- organization with multiple restaurants;
- user in multiple organizations;
- no-restaurant never routes to subscription;
- logout/login no stale subscription data;
- RLS cross-tenant denial;
- anonymous public menu still works;
- anonymous billing/provider fields inaccessible;
- Storage cross-tenant denial;
- valid/invalid API JWT cases.

- [ ] `vaptmesaflow`: `npm test`
- [ ] `vaptmesaflow`: `npm run lint`
- [ ] `vaptmesaflow`: `npm run build`
- [ ] `vapt-api`: `npm test`
- [ ] `vapt-api`: `npm run build`
- [ ] Manual smoke test in a clean browser profile.
- [ ] Manual smoke test Account A logout -> Account B login.
- [ ] Review Supabase Auth logs and Resend delivery/bounce behavior.
- [ ] Commit final cleanup only after all gates pass.

## Recommended PR boundaries

1. `schema/organizations-memberships-security`
2. `frontend/account-bootstrap-state`
3. `auth/email-verification-recovery-abuse-protection`
4. `onboarding/resumable-atomic-v2`
5. `activation/multi-restaurant-ux`
6. `api/jwks-membership-authz`
7. `qa/end-to-end-regression-cleanup`

Do not combine all phases into one PR. Each PR must leave the product in a coherent, testable state and include migrations + compatible application code when required.
