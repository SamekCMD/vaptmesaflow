# Three-Step Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current four-step onboarding with a focused, server-persisted three-step wizard for restaurant basics, operation, and review.

**Architecture:** Extend the existing draft RPC with operational flags, keep TanStack Query as the server-state boundary, and reduce `OnboardingPage` to a controller over three focused step components. Field validation and database-error mapping remain pure functions so they can be tested without rendering the full page.

**Tech Stack:** React 18, TypeScript, React Router 6, TanStack Query 5, Supabase JS/Postgres, Vitest, Testing Library, pgTAP.

---

## File Map

- Create `supabase/migrations/20260831220000_add_onboarding_operation_draft.sql`: add operation flags to the draft RPC while preserving the old overload during deployment.
- Modify `supabase/tests/resumable_onboarding_test.sql`: verify the operation-aware RPC and permissions.
- Modify `src/features/onboarding/onboarding-service.ts`: include `localEnabled` and `deliveryEnabled` in draft reads/writes.
- Modify `src/features/onboarding/use-onboarding-draft.ts`: retain query/mutation ownership and cache updates.
- Create `src/features/onboarding/onboarding-form.ts`: form model, slug generation, validation, and Postgres error mapping.
- Create `src/features/onboarding/steps/RestaurantBasicsStep.tsx`: step-one fields and field errors.
- Create `src/features/onboarding/steps/OperationStep.tsx`: mode selector and conditional table count.
- Create `src/features/onboarding/steps/ReadyStep.tsx`: read-only review.
- Modify `src/pages/onboarding/OnboardingPage.tsx`: three-step controller and save-before-navigation behavior.
- Modify `src/test/onboarding-service.test.ts`: operation payload contract.
- Create `src/test/onboarding-form.test.ts`: pure validation/error tests.
- Modify `src/test/onboarding-flow.test.tsx`: wizard behavior, resume, navigation, and duplicate-submit tests.

### Task 1: Persist the operational mode in onboarding drafts

**Files:**
- Create: `supabase/migrations/20260831220000_add_onboarding_operation_draft.sql`
- Modify: `supabase/tests/resumable_onboarding_test.sql`
- Modify: `src/features/onboarding/onboarding-service.ts`
- Modify: `src/integrations/supabase/types.ts`
- Test: `src/test/onboarding-service.test.ts`

- [ ] **Step 1: Write failing service assertions**

Extend the existing test input and RPC expectation with:

```ts
localEnabled: true,
deliveryEnabled: true,
// RPC payload
p_local_enabled: true,
p_delivery_enabled: true,
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- src/test/onboarding-service.test.ts`

Expected: failure because the service does not send operation flags.

- [ ] **Step 3: Extend the TypeScript draft contract**

Add to `OnboardingDraft` and `SaveOnboardingDraftInput`:

```ts
localEnabled: boolean;
deliveryEnabled: boolean;
```

Select/map `local_enabled` and `delivery_enabled`, then send `p_local_enabled` and `p_delivery_enabled` to the RPC.

- [ ] **Step 4: Add the backward-compatible RPC overload**

Create a migration defining an operation-aware overload with the existing parameters plus:

```sql
p_local_enabled boolean default true,
p_delivery_enabled boolean default false
```

The function must reject both flags being false, reuse the authenticated draft, update `local_enabled`/`delivery_enabled`, retain advisory locking, revoke `anon`, and grant only `authenticated`. Keep the old overload until frontend deployment is complete.

- [ ] **Step 5: Extend pgTAP coverage**

Increase the plan count and assert that the new signature exists, `authenticated` can execute it, and `anon` cannot execute it. Preserve the accumulated result table so every assertion remains visible in Supabase SQL Editor.

- [ ] **Step 6: Run focused frontend tests**

Run: `npm test -- src/test/onboarding-service.test.ts`

Expected: all tests pass.

- [ ] **Step 7: Commit operation persistence**

```bash
git add supabase/migrations/20260831220000_add_onboarding_operation_draft.sql supabase/tests/resumable_onboarding_test.sql src/features/onboarding/onboarding-service.ts src/integrations/supabase/types.ts src/test/onboarding-service.test.ts
git commit -m "feat: persist onboarding operation mode"
```

### Task 2: Add the form model and focused step components

**Files:**
- Create: `src/features/onboarding/onboarding-form.ts`
- Create: `src/features/onboarding/steps/RestaurantBasicsStep.tsx`
- Create: `src/features/onboarding/steps/OperationStep.tsx`
- Create: `src/features/onboarding/steps/ReadyStep.tsx`
- Test: `src/test/onboarding-form.test.ts`

- [ ] **Step 1: Write failing pure-function tests**

Cover these exact cases:

```ts
expect(validateBasics({ name: "", slug: "" })).toEqual({
  name: "Informe o nome do restaurante.",
  slug: "Informe o endereço do cardápio.",
});
expect(validateOperation({ localEnabled: false, deliveryEnabled: false, totalTables: 1 }))
  .toHaveProperty("operationMode");
expect(getOperationMode(true, false)).toBe("local");
expect(getOperationMode(false, true)).toBe("delivery");
expect(getOperationMode(true, true)).toBe("both");
expect(mapOnboardingSaveError({ code: "23505" })).toEqual({
  field: "slug",
  message: "Este endereço de cardápio já está em uso.",
});
```

- [ ] **Step 2: Run pure tests and confirm RED**

Run: `npm test -- src/test/onboarding-form.test.ts`

Expected: module-not-found failure.

- [ ] **Step 3: Implement the pure form model**

Define `OnboardingForm`, `OnboardingFieldErrors`, `OperationMode`, `createSlug`, `getOperationMode`, `applyOperationMode`, `validateBasics`, `validateOperation`, and `mapOnboardingSaveError`. Do not import React or Supabase into this file.

- [ ] **Step 4: Implement `RestaurantBasicsStep`**

Render name, slug, and optional WhatsApp using controlled props. Associate error text with inputs using `aria-describedby`; generating a slug from name must stop once the user edits the slug manually.

- [ ] **Step 5: Implement `OperationStep`**

Render three explicit selectable cards: `Salão`, `Delivery`, and `Ambos`. Render table count only when `localEnabled` is true and expose `operationMode` and `totalTables` errors near their controls.

- [ ] **Step 6: Implement `ReadyStep`**

Render the restaurant name, public menu path, WhatsApp when present, operation label, and table count only for local operation. Do not render logo, colors, or first-product fields.

- [ ] **Step 7: Run pure tests and lint new files**

Run: `npm test -- src/test/onboarding-form.test.ts`

Run: `npm run lint`

Expected: both commands pass.

- [ ] **Step 8: Commit form and steps**

```bash
git add src/features/onboarding/onboarding-form.ts src/features/onboarding/steps src/test/onboarding-form.test.ts
git commit -m "feat: add focused onboarding steps"
```

### Task 3: Refactor the page into a save-before-navigation controller

**Files:**
- Modify: `src/pages/onboarding/OnboardingPage.tsx`
- Modify: `src/test/onboarding-flow.test.tsx`

- [ ] **Step 1: Replace legacy flow expectations with failing wizard tests**

Test that the page:

```text
starts on Dados básicos
saves and then opens Operação
shows table count for Salão/Ambos and hides it for Delivery
saves before returning to Dados básicos
restores the persisted step and operation flags
shows Pronto as the third step
contains no required branding, logo, or first-product inputs
keeps the current step when saving fails
disables navigation while a save is pending
maps Postgres 23505 to the slug field
```

- [ ] **Step 2: Run the flow tests and confirm RED**

Run: `npm test -- src/test/onboarding-flow.test.tsx`

Expected: failures against the four-step page.

- [ ] **Step 3: Reduce `OnboardingPage` to controller state**

Use one `OnboardingForm` state object, one field-error state object, current visual step `0..2`, `restaurantId`, and the existing draft/bootstrap hooks. Remove FileReader, color state, dish state, and their markup.

- [ ] **Step 4: Implement save-before-next and save-before-back**

Validate the current step, call `persistDraft(targetStep)`, and update visual navigation only after success. When going back, persist the form while the RPC retains the highest server-side step.

- [ ] **Step 5: Map expected and unexpected errors**

For `23505`, remain on basics and set only the slug error. For other failures, preserve all inputs, remain on the current step, and show the existing destructive toast.

- [ ] **Step 6: Keep finalization behind the existing boundary**

The third-step action may call the current completion sequence temporarily, but it must operate on the persisted restaurant ID and must not restore browser-generated timestamps. Task 14 will replace this sequence with one transactional RPC.

- [ ] **Step 7: Run focused onboarding tests**

Run: `npm test -- src/test/onboarding-form.test.ts src/test/onboarding-service.test.ts src/test/onboarding-flow.test.tsx`

Expected: all focused tests pass.

- [ ] **Step 8: Commit the controller refactor**

```bash
git add src/pages/onboarding/OnboardingPage.tsx src/test/onboarding-flow.test.tsx
git commit -m "refactor: focus onboarding into three steps"
```

### Task 4: Verify the complete frontend and prepare database validation

**Files:**
- Modify only if verification exposes a defect in Task 1-3 files.

- [ ] **Step 1: Run the full frontend suite**

Run: `npm test`

Expected: all tests pass; existing React Router/`act` warnings may remain but no failed tests.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: exit code 0.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: successful Vite build; existing bundle-size warning may remain.

- [ ] **Step 4: Run migration and pgTAP manually on self-hosted Supabase**

Apply `20260831220000_add_onboarding_operation_draft.sql`, then run the updated `resumable_onboarding_test.sql`. Every displayed assertion must start with `ok` and the final summary must contain no failure.

- [ ] **Step 5: Publish only after database approval**

Push `codex/multitenant-v2` only after the self-hosted database accepts the migration and pgTAP suite.
