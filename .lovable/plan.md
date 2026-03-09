

## Plan: Centralize All Config Keys in constants.ts

All Stripe publishable keys and n8n webhook URLs will be hardcoded in `src/lib/constants.ts`, replacing every `import.meta.env.VITE_STRIPE_*` and `import.meta.env.VITE_N8N_*` reference across 4 files.

Note: The Stripe key is a **publishable** test key (`pk_test_*`), so it's safe to store in the codebase.

### Changes

**1. `src/lib/constants.ts`** — Replace contents with all constants:
- `STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`
- `N8N_CHECKOUT_WEBHOOK_URL`, `N8N_WEBHOOK_URL`

**2. `src/lib/plans.ts`** — Import `STRIPE_PRICE_*` from constants, replace the 3 `import.meta.env` references in `priceId` fields.

**3. `src/components/dashboard/StripeCheckoutModal.tsx`** — Import `STRIPE_PUBLISHABLE_KEY` and `N8N_CHECKOUT_WEBHOOK_URL` from constants, remove the two `import.meta.env` lines (lines 17-18). Use `N8N_CHECKOUT_WEBHOOK_URL` instead of `N8N_STRIPE_WEBHOOK`.

**4. `src/components/menu/OrderSummaryDrawer.tsx`** — Import `N8N_WEBHOOK_URL` from constants, replace the `import.meta.env.VITE_N8N_WEBHOOK_URL` on line 175.

**5. `src/pages/PricingPage.tsx`** — Already imports `N8N_CHECKOUT_WEBHOOK_URL` from constants. No change needed.

### No other logic changes. No new files.

