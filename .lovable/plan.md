

## Plan: Upgrade Confirmation Modal + autoCharged Handling

### Overview
Two changes to `SubscriptionPage.tsx` and `StripeCheckoutModal.tsx`: add a confirmation dialog for active subscribers upgrading, and handle `autoCharged`/null `clientSecret` responses from n8n.

### Changes

**1. `src/pages/dashboard/SubscriptionPage.tsx`**
- Import `PLANS` label lookup helper and `AlertDialog` components.
- When user clicks "Assinar" and `planStatus === 'active'`, open a confirmation `AlertDialog` instead of directly opening `StripeCheckoutModal`.
- Confirmation modal shows: title "Confirmar troca de plano", body with current plan name → new plan name + price, green "Confirmar" button, gray "Cancelar" button.
- On confirm, set `selectedPlan` which opens `StripeCheckoutModal` (existing flow).
- If `planStatus !== 'active'`, open `StripeCheckoutModal` directly (no confirmation step).
- Add state: `pendingPlan` (for confirmation dialog) separate from `selectedPlan` (for Stripe modal).

**2. `src/components/dashboard/StripeCheckoutModal.tsx`**
- Accept new prop `onAutoCharged: () => void` callback.
- In the `createSession` fetch response handler:
  - If `data.autoCharged === true` or `data.clientSecret` is falsy → don't set `clientSecret`, call `onAutoCharged()`, close modal.
  - If `data.clientSecret` starts with `seti_` or `pi_` → set `clientSecret` as before (Stripe Elements flow).
- Back in `SubscriptionPage.tsx`, pass `onAutoCharged` that shows a success toast ("Plano atualizado com sucesso!") and calls `refetch()` from `useSubscription`.

### Files Modified
- `src/pages/dashboard/SubscriptionPage.tsx`
- `src/components/dashboard/StripeCheckoutModal.tsx`

No other files changed.

