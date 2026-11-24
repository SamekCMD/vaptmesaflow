# Vapt Restaurant Suite

**Infrastructure migration: COMPLETE (2026-11-24).** Frontend/API/billing run on Cloudflare, data on Neon/R2, realtime on Durable Objects; migration changes merged into main. Stripe Live payments and payouts enabled. [Final status and evidence](docs/infra-migration-closure-status-2026-11-24.md).

Vapt is an operational system for restaurants.  
It connects menu, tables, kitchen, cashier, and metrics in one flow.

## Stack

- React 18 + TypeScript + Vite
- Tailwind + shadcn/ui
- Neon Postgres + Better Auth
- Stripe
- Backend API: `vapt-api`

## Required frontend environment variables

Create `.env.local` in this project root with:

```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_or_live_key

VITE_VAPT_API_BASE_URL=https://your-vapt-api-host
VITE_PAYMENT_ENVIRONMENT=production
VITE_VAPID_PUBLIC_KEY=your-web-push-public-key
```

Important:

- `VITE_VAPT_API_BASE_URL` is a **frontend** variable, so yes, it must be in `.env.local` for local dev.
- `VITE_PAYMENT_ENVIRONMENT` accepts `sandbox` for test deployments and defaults to `production` when omitted.
- Production hosting is Cloudflare Workers Static Assets; configure each environment through its versioned Cloudflare profile. Vercel is retired infrastructure.
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
