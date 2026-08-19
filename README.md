# Vapt Restaurant Suite

Vapt is an operational system for restaurants.  
It connects menu, tables, kitchen, cashier, and metrics in one flow.

## Stack

- React 18 + TypeScript + Vite
- Tailwind + shadcn/ui
- Supabase
- Stripe
- Backend API: `vapt-api`

## Required frontend environment variables

Create `.env.local` in this project root with:

```bash
VITE_SUPABASE_URL=https://your-supabase-host
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

VITE_STRIPE_PUBLISHABLE_KEY=pk_test_or_live_key
VITE_STRIPE_PRICE_STARTER=price_starter
VITE_STRIPE_PRICE_PRO=price_pro
VITE_STRIPE_PRICE_BUSINESS=price_business

VITE_VAPT_API_BASE_URL=https://your-vapt-api-host
VITE_PAYMENT_ENVIRONMENT=production
VITE_VAPID_PUBLIC_KEY=your-web-push-public-key
```

Important:

- `VITE_VAPT_API_BASE_URL` is a **frontend** variable, so yes, it must be in `.env.local` for local dev.
- `VITE_PAYMENT_ENVIRONMENT` accepts `sandbox` for test deployments and defaults to `production` when omitted.
- On Vercel, add the same variables in Project Settings -> Environment Variables.
- Never hardcode keys/URLs in source files.

## Local run

```bash
npm install
npm run dev
```

## Validation

```bash
npm run lint
npm test
npm run build
```

For backend:

```bash
cd vapt-api
npm test
npm run build
```
