# Stripe Billing Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Use `superpowers:test-driven-development` for every behavior change and `superpowers:verification-before-completion` before each completion claim. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidar integralmente o billing SaaS do Vapt dentro da API, substituindo os workflows Stripe do n8n por `stripe-node`, Checkout hospedado, Customer Portal e webhooks idempotentes que reconciliam o estado no Neon. Preview usa Stripe Test Mode; nenhuma cobrança real ou ativação Stripe Live faz parte desta fase.

**Architecture:** A API cria ou reutiliza um Stripe Customer por restaurante e abre uma Checkout Session hospedada para novas assinaturas. Assinaturas existentes são gerenciadas pelo Customer Portal. O retorno do navegador é apenas UX: somente webhooks Stripe verificados podem alterar o estado persistido. Cada evento é reservado no Neon, reconciliado contra o estado atual da Stripe e concluído de forma reentrante. Comunicações de billing são transformadas em intents deduplicadas na outbox; a entrega por Cloudflare Queue + Resend pertence à Fase 8.

**Tech Stack:** Node.js 24, TypeScript/ESM, Fastify 5, Stripe Node SDK 22.6.2, PostgreSQL 18/Neon, `pg` 8.23.0, React/Vite, Node test runner, Vitest/Testing Library.

**Primary spec:** [`docs/infra-migration-plan.md`](../../infra-migration-plan.md), seções 13–15.

## Chosen flow

```text
Frontend autenticado
  ├─ POST /billing/stripe/checkout ──> API ──> Stripe Checkout hospedado
  ├─ POST /billing/stripe/portal ────> API ──> Stripe Customer Portal
  └─ GET  /billing/stripe/subscription ──────> Neon

Stripe
  └─ POST /webhooks/stripe
       ├─ verificar assinatura sobre raw body
       ├─ reservar/reivindicar evento no Neon
       ├─ buscar estado atual na Stripe
       ├─ reconciliar restaurants
       ├─ gravar intent de email deduplicada
       └─ marcar evento processed
```

Checkout será `mode=subscription` e `ui_mode=hosted_page`. Esta escolha cumpre a exigência de criar Checkout Sessions, reduz código PCI-sensitive no frontend e remove a necessidade de manter Payment Element para o billing do Vapt. A Stripe documenta que Checkout em modo subscription cria/reutiliza Customer conforme o identificador fornecido e recebe recurring Prices em `line_items`.

O Customer Portal será a única UI de troca de plano, meio de pagamento, histórico e cancelamento de uma assinatura existente. Os endpoints atuais de mudança/cancelamento, que existem apenas para encaminhar ao n8n e ainda não atendem clientes reais, serão removidos junto com essa dependência.

## Global Constraints

- Não usar n8n para criar Customer, Checkout, alterar/cancelar assinatura ou processar webhook Stripe.
- Não criar microserviço de billing; tudo permanece no módulo Stripe da API.
- Não confiar em retorno do Checkout, query string do frontend ou clique de UI para ativar plano.
- Não aceitar email, Price ID, Customer ID, Subscription ID, valor ou status vindos do navegador.
- O navegador envia somente `restaurantId`, `planType` e `Idempotency-Key`; a API deriva email da sessão e Price ID do catálogo confiável.
- Não expor `STRIPE_SECRET_KEY`, webhook secret, Customer ID ou Subscription ID ao frontend.
- Não chamar Resend sincronicamente dentro do webhook. A Fase 7 grava intents; a Fase 8 conecta Queue + Resend.
- Não implementar REST manual da Stripe preventivamente. Usar primeiro `stripe-node` com transporte Fetch e verificação assíncrona compatíveis com o futuro Worker.
- Não portar Fastify/Node para Workers nem configurar Hyperdrive neste plano.
- Não alterar DNS, Vercel, Coolify, Easypanel ou Hetzner.
- Não fazer cobrança Stripe Live. Produção recebe somente o schema versionado; secrets, Prices, Portal e webhook live serão ativados na futura implantação Worker.
- Não copiar usuários, UUIDs ou dados de teste. Todo smoke remoto usa identidades sintéticas descartáveis em preview.
- Não versionar secrets, cookies, payloads reais de webhook ou dados de cartão.
- Manter `docs/implementation-references/` intocado.
- Trabalhar nos branches existentes `codex/infra-foundation`; commits locais por tarefa, sem push ou PR sem autorização explícita.

## Review Focus

- O estado persistido muda somente por webhook, nunca pelo resultado síncrono de Checkout/Portal.
- Tenant isolation: toda rota autenticada verifica `request.auth.userId` contra `restaurants.owner_id`.
- Um restaurante não pode vincular Customer ou Subscription pertencente a outro restaurante.
- Customer é criado uma única vez mesmo sob retries/concorrência.
- Checkout, mudanças no Portal e webhooks duplicados não repetem efeitos.
- Eventos falhos podem ser reprocessados; uma linha `pending_retry` nunca é tratada como duplicata concluída.
- Estado fora de ordem é reconciliado consultando a Subscription atual na Stripe antes de persistir.
- Evento desconhecido é auditado e marcado `ignored`, sem alterar plano nem gerar email.
- O raw body chega intacto a `constructEventAsync`.
- Logs contêm `stripeEventId`, `eventType`, `restaurantId` quando resolvido e resultado; nunca secret, assinatura completa, email, URL de Checkout/Portal ou payload integral.
- Checkout e Portal retornam apenas URLs HTTPS criadas pela Stripe.
- Preview aceita somente recursos Test Mode; nenhum teste alcança Stripe Live.
- Todo objeto retornado pela Stripe deve ter `livemode` coerente com `STRIPE_ENVIRONMENT`; divergência falha fechada.
- A Subscription deve conter exatamente um item recorrente com Price configurado. `currentPeriodEnd` vem do `SubscriptionItem.current_period_end`, pois a API Stripe atual não mantém esse campo no topo da Subscription.
- A outbox não gera mensagens redundantes para a compra inicial.

## Repository Map

### Frontend / infraestrutura — `D:\Projetos\vaptmesaflow`

- `infra/neon/005_stripe_billing.sql`: nova migration aditiva para estado e idempotência de billing.
- `infra/neon/verify-stripe-billing.sql`: verificador específico da Fase 7.
- `infra/neon/verify-baseline.sql` e `infra/neon/verify-integrity.sql`: inventário completo após a migration.
- `src/lib/billing-client.ts`: novo cliente autenticado de billing.
- `src/pages/dashboard/SubscriptionPage.tsx`: redirect para Checkout/Portal e exibição do estado reconciliado.
- `src/components/dashboard/StripeCheckoutModal.tsx`: removido; Payment Element deixa de ser usado para assinatura Vapt.
- `src/lib/n8n-client.ts`: removido depois de mover o único método não-Stripe restante.
- `src/lib/push-notifications.ts`: passa a chamar a API Vapt diretamente.
- `src/hooks/useSubscription.ts`: consome o snapshot seguro de billing da API.
- `src/test/stripe-billing.test.tsx`: novo contrato de UI/cliente.

### API — `D:\Projetos\vaptmesaflow\.worktrees\vapt-api-infra-foundation`

- `src/lib/config.ts`: configuração Stripe tipada e remoção da configuração n8n.
- `src/modules/billing/stripe/client.ts`: boundary sobre `stripe-node`.
- `src/modules/billing/stripe/service.ts`: checkout, portal e consulta autorizada.
- `src/modules/billing/stripe/repository.ts`: lock por restaurante e leitura segura do snapshot.
- `src/modules/billing/stripe/webhook-service.ts`: redução/reconciliação de eventos.
- `src/modules/billing/stripe/webhook-repository.ts`: claim/retry/idempotência/outbox.
- `src/modules/billing/stripe/routes.ts`: rotas autenticadas.
- `src/modules/billing/stripe/webhook-routes.ts`: `POST /webhooks/stripe`.
- `src/modules/billing/stripe/*.test.ts`: testes de contrato, serviço, repositório e webhook.
- `src/modules/webhooks/`: removido após a rota Stripe migrar para o domínio de billing.
- `src/modules/n8n/`: removido após o último consumidor desaparecer.
- `src/app.ts`: composição das novas dependências.

## Runtime contracts

### Configuration

```ts
type StripeEnvironment = "test" | "live";

type StripeBillingConfig = {
  secretKey: string;
  webhookSecret: string;
  webhookToleranceSeconds: number;
  environment: StripeEnvironment;
  portalConfigurationId: string;
  prices: Record<"starter" | "pro" | "business", string>;
};
```

Required environment variables:

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_ENVIRONMENT=test|live
STRIPE_PORTAL_CONFIGURATION_ID
STRIPE_PRICE_STARTER
STRIPE_PRICE_PRO
STRIPE_PRICE_BUSINESS
FRONTEND_URL
```

`STRIPE_WEBHOOK_SIGNING_SECRET` is replaced by the canonical `STRIPE_WEBHOOK_SECRET`. `N8N_BASE_URL`, `N8N_TIMEOUT_MS`, `VAPT_APP_ENDPOINT_SECRET` and `VAPT_ADMIN_ENDPOINT_SECRET` leave the runtime when Task 7 proves there are no remaining consumers.

### HTTP surface

```text
POST /billing/stripe/checkout
Header: Idempotency-Key: UUID
Body: { restaurantId, planType }
Response: { checkoutSessionId, url }

POST /billing/stripe/portal
Body: { restaurantId }
Response: { url }

GET /billing/stripe/subscription?restaurantId=...
Response: {
  planType,
  planStatus,
  trialEndsAt,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  requiresBillingAction,
  canManageBilling
}

POST /webhooks/stripe
Header: Stripe-Signature
Response: { received, duplicate, ignored, providerEventId }
```

The following development-only forwarding contracts are removed:

```text
POST /billing/stripe/subscription/change
POST /billing/stripe/subscription/cancel
```

### Local plan status

```ts
type StripePlanStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "incomplete"
  | "unpaid"
  | "paused"
  | "expired"
  | "cancelled";
```

Stripe `canceled` maps to local `cancelled`; `incomplete_expired` maps to `expired`. Only `trialing` and `active` grant access. `canManageBilling` is true only when a Stripe Customer exists. A free local trial without Customer can open Checkout; a Stripe-backed trial opens Portal. `past_due`, `incomplete`, `unpaid` and `paused` set `requiresBillingAction=true`; terminal `expired`/`cancelled` can start a new Checkout.

### Email ownership and deduplication

| Stripe event | Billing state | Email intent owner |
|---|---|---|
| `checkout.session.completed` | Resolve IDs and reconcile Subscription | none |
| `checkout.session.expired` | Clear the matching pending Checkout | none |
| `invoice.paid` + `billing_reason=subscription_create` | Reconcile active state | `subscription_activated` |
| `invoice.paid` + `billing_reason=subscription_cycle` | Reconcile active state | `subscription_renewed` |
| `invoice.payment_failed` | Reconcile failure state | `payment_failed` |
| `customer.subscription.updated` | Reconcile plan/status/cancel date | none |
| `customer.subscription.deleted` | Persist `cancelled` | `subscription_cancelled` |

Unique `(provider_event_id, email_kind)` prevents duplicate intents. A compra inicial never emits both “activated” and a generic “payment confirmed” email.

## Dependency order

```text
Task 0
  ↓
Task 1 → Task 2 → Task 3 → Task 4
                         ├──────→ Task 5
                         └──────→ Task 6
Task 5 + Task 6 → Task 7 → Task 8 → Task 9 → Task 10
```

---

### Task 0: Record the current Stripe boundary and acceptance matrix

**Files:**

- Create: `docs/infra-migration-phase-7-stripe.md`
- Read only: API `src/modules/billing/stripe/**`
- Read only: API `src/modules/webhooks/**`
- Read only: API `src/modules/n8n/**`
- Read only: frontend `src/components/dashboard/StripeCheckoutModal.tsx`
- Read only: frontend `src/lib/n8n-client.ts`

**Interfaces:** No runtime change.

- [ ] **Step 1: Capture the RED baseline**

Record that checkout/change/cancel and webhook processing instantiate `createN8nClient`, the API lacks `STRIPE_SECRET_KEY`, no Portal route exists, and the browser currently waits for `clientSecret` from the forwarding workflow.

Run in the API worktree:

```powershell
rg -n "createN8nClient|forwardWebhook|subscriptionChange|subscriptionCancel|STRIPE_SECRET_KEY" src .env.example README.md
```

Expected: n8n consumers are present and `STRIPE_SECRET_KEY` is absent.

- [ ] **Step 2: Inventory Test Mode resources without mutating them**

In Stripe Test Mode, record only non-secret identifiers and configuration state:

- product and Price IDs for Starter, Pro and Business;
- active, recurring monthly, `brl`, respectively `9700`, `19700`, `34700` cents;
- Customer Portal configuration ID and enabled capabilities;
- registered webhook endpoints and selected events;
- whether current resources are test or live.

Never copy secret keys or webhook signing secrets into the report.

- [ ] **Step 3: Write the binary acceptance matrix**

The report must define these gates:

```text
GREEN-CODE: no Stripe path imports or calls n8n.
GREEN-STATE: UI success never activates a plan; signed webhook is the only billing writer.
GREEN-PREVIEW: a real Test Mode checkout, webhook, Portal session and cleanup pass against Neon preview.
GREEN-PRODUCTION-SCHEMA: the exact reviewed migration passes in Neon production while all billing rows remain empty.
DEFERRED-LIVE: live keys, Prices and webhook endpoint wait for the Cloudflare Worker deployment.
```

- [ ] **Step 4: Commit**

```powershell
git add docs/infra-migration-phase-7-stripe.md
git commit -m "docs: inventory Stripe billing boundary"
```

---

### Task 1: Pin stripe-node and introduce Worker-ready typed configuration

**Files:**

- Modify: API `package.json`
- Modify: API `package-lock.json`
- Modify: API `src/lib/config.ts`
- Modify: API `src/lib/config.test.ts`
- Modify: API `src/lib/config-mercado-pago.test.ts`
- Modify: API every test fixture containing `AppConfig`
- Create: API `src/modules/billing/stripe/client.ts`
- Create: API `src/modules/billing/stripe/client.test.ts`
- Modify: API `.env.example`
- Modify: API `README.md`

**Interfaces:** Add `stripe: StripeBillingConfig`; make `frontendUrl: URL` required. Preserve `apiPublicUrl` as optional until the Worker/deploy phase.

- [ ] **Step 1: Write failing config tests**

Test every required variable, valid `test|live`, credential-free absolute HTTPS `FRONTEND_URL` outside local development, a non-empty `bpc_...` Portal configuration ID, and mapping to `config.stripe`. Assert `STRIPE_WEBHOOK_SIGNING_SECRET` alone no longer satisfies configuration.

Run:

```powershell
npx tsx --test src/lib/config.test.ts src/lib/config-mercado-pago.test.ts
```

Expected: FAIL because the new keys and shape do not exist.

- [ ] **Step 2: Install the reviewed official SDK exactly**

```powershell
npm install --save-exact stripe@22.6.2
```

Do not add an HTTP wrapper or manual Stripe REST client.

- [ ] **Step 3: Implement and document configuration**

Parse the canonical variables, update all `AppConfig` fixtures and replace the webhook-secret name. Document Test Mode versus Live Mode. Secrets remain placeholders in `.env.example`.

- [ ] **Step 4: Add a Worker-compatible client factory test**

Create `src/modules/billing/stripe/client.test.ts` first. The factory must inject `Stripe.createFetchHttpClient()` and expose async webhook construction via `Stripe.createSubtleCryptoProvider()`/`constructEventAsync`, while allowing a fake Stripe gateway in unit tests.

Implement the minimal factory in `client.ts` after the test fails. Pin the SDK default API version in test evidence and require the remote webhook endpoint to use that same version. This is portability preparation only; do not add Wrangler or port Fastify.

- [ ] **Step 5: Verify and commit**

```powershell
npx tsx --test src/lib/config.test.ts src/lib/config-mercado-pago.test.ts src/modules/billing/stripe/client.test.ts
npm run build
git add package.json package-lock.json src/lib src/modules/billing/stripe/client.ts src/modules/billing/stripe/client.test.ts .env.example README.md
git commit -m "build: add Stripe billing runtime"
```

---

### Task 2: Version the Neon billing state machine and outbox

**Files:**

- Create: `infra/neon/005_stripe_billing.sql`
- Create: `infra/neon/verify-stripe-billing.sql`
- Modify: `infra/neon/verify-baseline.sql`
- Modify: `infra/neon/verify-integrity.sql`
- Modify: `infra/neon/smoke-preview.sql`
- Modify: `docs/infra-migration-phase-4-neon.md`

**Schema changes:**

`public.restaurants` gains:

```text
stripe_subscription_item_id text null
stripe_current_period_end timestamptz null
stripe_cancel_at_period_end boolean not null default false
stripe_state_updated_at timestamptz null
stripe_checkout_session_id text null
stripe_checkout_plan_type text null
stripe_checkout_expires_at timestamptz null
```

Add partial unique indexes for non-null `stripe_customer_id` and `stripe_subscription_id`, plus a check constraint covering the local status union.

`public.billing_provider_events` gains an explicit retryable lifecycle:

```text
processing_status received|processing|processed|pending_retry|ignored
attempt_count integer >= 0
processing_started_at timestamptz null
last_error text null
processed_at timestamptz null
```

Drop the old `processed_at NOT NULL DEFAULT now()` behavior. Preserve existing payloads and map already-processed legacy rows to `processed` in the migration.

Create `public.billing_email_outbox` with FK to restaurant, Stripe provider event ID, `email_kind`, safe JSON payload, delivery status, attempts/timestamps and unique `(provider_event_id, email_kind)`. It stores no secret and no card data. Queue delivery remains unimplemented.

- [ ] **Step 1: Write the failing verifier first**

`verify-stripe-billing.sql` must fail unless all new columns, constraints, indexes and table exist, `processed_at` is nullable, and PUBLIC has no access to the new table.

Do not apply or run it remotely in this task. Task 9 must execute this verifier before the migration and capture the expected RED evidence.

- [ ] **Step 2: Write the additive transaction-safe migration**

Use `begin`/`commit`, named constraints/indexes and no destructive table rebuild. Do not edit `001_business_schema.sql`; `005` is the immutable forward migration for already-created branches.

- [ ] **Step 3: Update global verifiers**

Add `billing_email_outbox` to expected tables and the new critical columns/indexes/constraints to integrity checks. Ensure the public restaurant lookup still exposes none of the Stripe fields.

- [ ] **Step 4: Static verify and commit without applying remotely yet**

```powershell
git diff --check
git add infra/neon docs/infra-migration-phase-4-neon.md
git commit -m "feat: version Stripe billing state"
```

---

### Task 3: Build the owner-scoped billing repository and event claim protocol

**Files:**

- Modify: API `src/modules/billing/stripe/repository.ts`
- Modify: API `src/modules/billing/stripe/stripe.test.ts`
- Create: API `src/modules/billing/stripe/webhook-repository.ts`
- Create: API `src/modules/billing/stripe/webhook-repository.test.ts`

**Interfaces:**

```ts
type BillingScope = {
  userId: string;
  restaurantId: string;
  planType: StripePlanType;
  planStatus: StripePlanStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

type BillingEventClaim =
  | { kind: "claimed"; attemptCount: number }
  | { kind: "duplicate_processed" }
  | { kind: "in_flight" };
```

- [ ] **Step 1: Write failing repository tests**

Cover:

- owner-scoped reads and writes;
- no Stripe IDs in the public status DTO;
- transaction/row lock around first Customer association;
- compare-and-set persistence of Customer ID;
- unique-conflict mapping without leaking SQL/credentials;
- claim of a new event;
- duplicate processed event;
- retry of `pending_retry`;
- reclaim after an expired processing lease;
- no reclaim while another worker owns an unexpired lease;
- exactly-once outbox insertion per event/email kind.

- [ ] **Step 2: Implement the repository transaction boundary**

Use `Database.connect()` and `SELECT ... FOR UPDATE` for the short customer-association critical section. The Stripe network call is injected into the transaction callback only for first Customer creation; its deterministic Stripe idempotency key is `vapt:customer:<restaurantId>`.

All other API calls happen outside database locks.

- [ ] **Step 3: Implement retryable event claims**

Claim with one atomic SQL statement/transaction. A `pending_retry` row must be claimable again; `processed` and `ignored` are terminal; an unexpired `processing` lease returns `in_flight`. Store a sanitized error code/message, not a raw Stripe response.

- [ ] **Step 4: Verify and commit**

```powershell
npx tsx --test src/modules/billing/stripe/stripe.test.ts src/modules/billing/stripe/webhook-repository.test.ts
npm run build
git add src/modules/billing/stripe
git commit -m "feat: add durable Stripe billing repository"
```

---

### Task 4: Replace n8n checkout operations with the Stripe gateway

**Files:**

- Modify: API `src/modules/billing/stripe/client.ts`
- Create: API `src/modules/billing/stripe/types.ts`
- Modify: API `src/modules/billing/stripe/service.ts`
- Modify: API `src/modules/billing/stripe/schemas.ts`
- Modify: API `src/modules/billing/stripe/routes.ts`
- Modify: API `src/modules/billing/stripe/stripe.test.ts`
- Modify: API `src/app.ts`

**Stripe calls:**

- `customers.create` only when the locked restaurant has no Customer;
- `customers.search` by exact server-owned restaurant metadata before first creation, reusing one match and failing closed if more than one exists;
- `checkout.sessions.create` with `mode=subscription`, trusted Price, quantity 1, Customer, `success_url`, `cancel_url`, `client_reference_id`, and Vapt metadata;
- `checkout.sessions.retrieve` to reuse an unexpired open Session for the same plan;
- `billingPortal.sessions.create` with Customer, configured Portal ID and server-built return URL;
- `subscriptions.retrieve` for server reconciliation.

- [ ] **Step 1: Write failing service tests with a fake gateway**

Cover unauthorized tenant, browser-controlled fields rejected, trusted Price selection, existing Customer reuse, metadata-search recovery, multiple-customer fail-closed behavior, first Customer creation, deterministic Customer idempotency, request-scoped Checkout idempotency, same-plan open Checkout reuse, different-plan open Checkout conflict, HTTPS URLs only, non-terminal Stripe Subscription checkout conflict, local trial without Customer allowed to subscribe, missing Customer Portal conflict and sanitized provider errors.

- [ ] **Step 2: Implement `StripeGateway`**

Keep Stripe SDK types at the adapter boundary. Domain/service tests receive a small fake interface. Pass Stripe request idempotency keys as request options, not metadata.

Create/reuse the Customer and create/reuse the pending Checkout Session while holding the restaurant billing lock. Persist the pending Session ID, plan and expiration before releasing the lock. This prevents two tabs/processes from opening parallel Sessions that could create duplicate subscriptions. An expired Session is replaceable; an open Session for another plan returns conflict instead of creating a second one.

Create metadata owned by the server:

```text
vapt_restaurant_id
vapt_owner_id
vapt_plan_type
```

Copy the same metadata into the Checkout Session and `subscription_data.metadata`.

- [ ] **Step 3: Preserve and add routes**

- Keep `POST /billing/stripe/checkout`, changing its success response to `{ checkoutSessionId, url }`.
- Add `POST /billing/stripe/portal`.
- Keep `GET /billing/stripe/subscription` with the safe DTO.
- Remove the change/cancel route registration only after Task 5 removes frontend callers.

All routes keep Better Auth, rate limiting and ownership checks.

- [ ] **Step 4: Verify and commit**

```powershell
npx tsx --test src/modules/billing/stripe/client.test.ts src/modules/billing/stripe/stripe.test.ts
npm run build
git add src/app.ts src/modules/billing/stripe
git commit -m "feat: run Stripe checkout inside the API"
```

---

### Task 5: Move the frontend to hosted Checkout and Customer Portal

**Files:**

- Create: `src/lib/billing-client.ts`
- Create: `src/test/stripe-billing.test.tsx`
- Modify: `src/pages/dashboard/SubscriptionPage.tsx`
- Modify: `src/hooks/useSubscription.ts`
- Modify: `src/test/api-cookie-credentials.test.ts`
- Delete: `src/components/dashboard/StripeCheckoutModal.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Modify: `src/lib/env.ts`
- Modify: `src/lib/constants.ts`

**Behavior:** Inactive/trial-expired/cancelled users select a plan and redirect to hosted Checkout. Active/trialing/past-due users see “Gerenciar cobrança”, which requests a short-lived Portal URL. The page refetches the server snapshot after returning but never infers success from `?subscribed=true`.

- [ ] **Step 1: Write failing client tests**

Assert cookie-authenticated requests, UUID `Idempotency-Key`, allowed request bodies, typed provider errors and no bearer token. The client rejects a non-HTTPS redirect URL.

- [ ] **Step 2: Write failing page tests**

Cover:

- checkout click requests `{ restaurantId, planType }` and redirects;
- active plan opens Portal rather than invoking local change/cancel;
- no optimistic `planStatus=active` after Checkout return;
- past-due state shows an action-required message and Portal button;
- request failure leaves the user on the page with a retryable error;
- buttons disable during request to prevent duplicate clicks.

- [ ] **Step 3: Implement the hosted flow**

Use `crypto.randomUUID()` for each user-initiated Checkout attempt and pass it through `billing-client`. Keep the URL returned by the API out of logs/toasts.

Delete Payment Element code and remove exact dependencies:

```powershell
npm uninstall @stripe/react-stripe-js @stripe/stripe-js
```

Remove `VITE_STRIPE_PUBLISHABLE_KEY`; hosted Checkout needs no publishable key in the Vapt bundle.

- [ ] **Step 4: Remove frontend calls to change/cancel**

After tests pass, delete those methods from the frontend client surface. The corresponding API routes remain temporarily until Task 7 removes their last n8n-backed implementation in the API repository.

- [ ] **Step 5: Verify and commit**

```powershell
npm test -- src/test/stripe-billing.test.tsx src/test/api-cookie-credentials.test.ts
npm run build
npx tsc --noEmit
git add package.json package-lock.json src .env.example
git commit -m "feat: use hosted Stripe billing flows"
```

---

### Task 6: Process Stripe webhooks locally and emit durable email intents

**Files:**

- Create: API `src/modules/billing/stripe/webhook-service.ts`
- Create: API `src/modules/billing/stripe/webhook-service.test.ts`
- Create: API `src/modules/billing/stripe/webhook-routes.ts`
- Create: API `src/modules/billing/stripe/webhook-routes.test.ts`
- Modify: API `src/app.ts`
- Delete after parity: API `src/modules/webhooks/routes.ts`
- Delete after parity: API `src/modules/webhooks/service.ts`
- Delete after parity: API `src/modules/webhooks/repository.ts`
- Delete after parity: API `src/modules/webhooks/signature.ts`
- Delete after parity: API tests under `src/modules/webhooks/`

**Handled events:**

```text
checkout.session.completed
checkout.session.expired
invoice.paid
invoice.payment_failed
customer.subscription.updated
customer.subscription.deleted
```

- [ ] **Step 1: Write failing signature/route tests**

Use an injected webhook constructor for route tests and the official SDK with generated signatures for adapter tests. Assert raw-body preservation, missing/invalid signature rejection, tolerance handling, and that no parsed/re-serialized body reaches verification.

- [ ] **Step 2: Write failing reducer tests for every event**

For each event cover normal processing, duplicate delivery, pending retry, unknown restaurant/customer/subscription, mismatched metadata, unsupported event, provider retrieval failure, database failure and sanitized logging.

Every supported event with a Subscription retrieves its current state from Stripe before updating Neon. `customer.subscription.deleted` can use the signed event object and persists terminal `cancelled`; `checkout.session.expired` only clears the matching pending Session.

The reducer rejects zero/multiple subscription items or an unknown Price instead of guessing a plan. It persists the matched Subscription Item ID and reads the billing period from that item.

- [ ] **Step 3: Implement canonical reconciliation**

Resolve restaurant in this order:

1. unique local `stripe_subscription_id`;
2. unique local `stripe_customer_id`;
3. server-created `vapt_restaurant_id` metadata for first Checkout association.

When metadata is used, assert any already-persisted Customer/Subscription IDs are null or equal before binding. Validate Price ID maps to exactly one configured plan.

- [ ] **Step 4: Implement the email outbox mapping**

Insert the table-defined intent in the same database transaction as billing reconciliation and event completion. Do not import Resend and do not send a queue message yet.

- [ ] **Step 5: Define responses and retries**

- `processed`, `ignored`, and duplicate terminal events return HTTP 200.
- a concurrent unexpired claim returns HTTP 200 with `duplicate=true`.
- transient Stripe/Neon processing failure records `pending_retry` and returns HTTP 500 so Stripe retries.
- invalid signature/body returns 400/401 and is not persisted.

- [ ] **Step 6: Verify and commit**

```powershell
npx tsx --test src/modules/billing/stripe/webhook-*.test.ts
npm run build
git add src/app.ts src/modules/billing/stripe src/modules/webhooks
git commit -m "feat: reconcile Stripe webhooks in the API"
```

---

### Task 7: Remove the now-dead n8n runtime boundary

**Files:**

- Delete: API `src/modules/n8n/client.ts`
- Delete: API `src/modules/n8n/client.test.ts`
- Delete: API `src/modules/n8n/contracts.ts`
- Delete: API `src/modules/n8n/errors.ts`
- Delete: API `src/modules/n8n/index.ts`
- Modify: API `src/lib/config.ts`
- Modify: API configuration tests/fixtures
- Modify: API `src/modules/billing/stripe/routes.ts`
- Modify: API `src/modules/billing/stripe/service.ts`
- Modify: API `src/modules/billing/stripe/stripe.test.ts`
- Modify: API `.env.example`
- Modify: API `README.md`
- Modify: API `docs/backend-context.md`
- Modify: frontend `src/lib/push-notifications.ts`
- Modify: frontend `src/test/api-cookie-credentials.test.ts`
- Modify: frontend `src/test/n8n-operational-writers.test.ts`
- Delete: frontend `src/lib/n8n-client.ts`

- [ ] **Step 1: Move the last non-Stripe frontend method**

Change push subscription registration to call `vaptApiRequest` directly at `ingest/push-subscription`; preserve cookies and the existing payload/response type.

- [ ] **Step 2: Remove the obsolete change/cancel routes**

Delete `POST /billing/stripe/subscription/change` and `POST /billing/stripe/subscription/cancel` plus their n8n-backed service methods and tests. The hosted Portal is now the tested replacement for both user capabilities.

- [ ] **Step 3: Prove no code consumer remains**

Run both repositories:

```powershell
rg -n "createN8nClient|N8nClient|n8nClient|n8nContracts|N8N_BASE_URL|N8N_TIMEOUT_MS|VAPT_APP_ENDPOINT_SECRET|VAPT_ADMIN_ENDPOINT_SECRET" src .env.example README.md docs
```

Expected before deletion: only files scheduled in this task. Expected after deletion: no runtime occurrence. Historical migration/audit documents may retain factual references.

- [ ] **Step 4: Delete the API boundary and config**

Remove only n8n runtime code, tests and environment variables. Do not rewrite historical docs that describe the legacy architecture.

- [ ] **Step 5: Verify and commit separately**

API:

```powershell
npm test
npm run build
git add -A src/modules/n8n src/modules/billing/stripe src/lib .env.example README.md docs/backend-context.md
git commit -m "refactor: remove n8n billing runtime"
```

Frontend:

```powershell
npm test
npm run build
npx tsc --noEmit
git add -A src
git commit -m "refactor: remove legacy n8n client"
```

---

### Task 8: Run the complete local quality gate and review

**Files:** All changed files from Tasks 1–7.

- [ ] **Step 1: API full verification**

```powershell
npm test
npm run build
git diff --check
```

- [ ] **Step 2: Frontend full verification**

```powershell
npm test
npm run build
npx tsc --noEmit
git diff --check
```

- [ ] **Step 3: Static security inventory**

```powershell
rg -n "STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|sk_(test|live)_|whsec_" src docs infra .env.example
rg -n "createN8nClient|forwardWebhook|subscriptionChange|subscriptionCancel" src
```

Expected: only variable names/placeholders and no literal secret; no n8n Stripe runtime symbol.

- [ ] **Step 4: Focused code review**

Use `superpowers:requesting-code-review`. Review tenant isolation, external-call idempotency, event claim/retry, out-of-order reconciliation, raw-body verification, secret leakage, email deduplication and removal completeness. Fix every Critical/Important finding, rerun the affected tests, then rerun both full suites.

---

### Task 9: Apply preview-first and validate real Stripe Test Mode

**Files:**

- Modify: `docs/infra-migration-phase-7-stripe.md`
- Modify: `docs/infra-migration-phase-4-neon.md`
- Modify: `docs/superpowers/plans/2026-09-27-stripe-billing-consolidation.md` checkboxes only after evidence exists

**Remote scope:** Neon preview branch and Stripe Test Mode only. No DNS, deployment platform or live charge.

- [ ] **Step 1: Prove RED on Neon preview**

Run `verify-stripe-billing.sql` against `preview.vapt` before applying `005`; record the missing objects without recording the connection string.

- [ ] **Step 2: Apply the exact migration and all verifiers**

Apply only the reviewed bytes of `005_stripe_billing.sql`. Then run:

```text
verify-baseline.sql
verify-routines.sql
verify-integrity.sql
verify-better-auth.sql
verify-stripe-billing.sql
```

Record SHA-256 for the migration and every verifier.

- [ ] **Step 3: Validate or create Stripe Test Mode resources**

Reuse existing Test Mode resources only when they match the contract. If a Product, Price or Portal configuration is missing/incompatible, create a clean Test Mode replacement through the official API and store only its non-secret ID in the local environment. Retrieve all configured Prices through the gateway and assert active, recurring monthly, BRL and expected amounts. Retrieve the configured Portal configuration and assert payment-method update, invoice history, plan switching among the three configured Prices and cancel-at-period-end are enabled. Do not create or modify Live Mode resources.

- [ ] **Step 4: Run a real synthetic checkout**

Use one disposable Better Auth user and restaurant in Neon preview. Start the API locally with preview database credentials and Stripe Test Mode credentials. Use Stripe CLI forwarding or another official test-mode webhook path to reach the local `POST /webhooks/stripe`; do not change public DNS.

Complete hosted Checkout with Stripe test data and prove:

- Checkout redirect is HTTPS and Test Mode;
- `checkout.session.completed` and initial `invoice.paid` are accepted;
- `restaurants` contains the correct Customer, Subscription, plan and `active` state;
- one and only one `subscription_activated` outbox row exists;
- replaying the same Stripe event returns success without a second state write/outbox row;
- authenticated status returns the safe snapshot without Stripe IDs.

- [ ] **Step 5: Validate Portal and cancellation lifecycle**

Create a Portal session for the same restaurant, prove the URL is short-lived/Test Mode, change plan or schedule cancel-at-period-end, and confirm the resulting webhook updates Neon. Unit/integration tests remain the required proof for `invoice.payment_failed`; use a Stripe Test Clock remotely only if it can be completed without creating persistent noise.

- [ ] **Step 6: Clean all synthetic state**

Delete/cancel the Test Mode Customer/Subscription created for the smoke and delete the synthetic Better Auth/business/billing rows from preview. Re-run counts and all Neon verifiers. Production stays untouched in this step.

- [ ] **Step 7: Record evidence and commit**

Record red/green outputs, non-secret Stripe object IDs, event IDs, row counts, cleanup and exact commits. Never record secret keys, signatures, checkout URLs or customer email.

```powershell
git add docs/infra-migration-phase-7-stripe.md docs/infra-migration-phase-4-neon.md docs/superpowers/plans/2026-09-27-stripe-billing-consolidation.md
git commit -m "docs: validate Stripe billing in preview"
```

---

### Task 10: Promote the schema and close Phase 7 without premature live activation

**Files:**

- Modify: `docs/infra-migration-phase-7-stripe.md`
- Modify: `docs/infra-migration-phase-4-neon.md`
- Modify: `docs/infra-migration-plan.md` checklist/status only

- [ ] **Step 1: Prove production RED, then apply the identical migration**

Run `verify-stripe-billing.sql` against `production.vapt`, capture RED, compare the local migration SHA-256 with preview evidence, apply the identical file, and run the complete verifier set.

- [ ] **Step 2: Confirm production remains empty**

Assert zero production rows in Better Auth, restaurants, billing events and billing email outbox. Do not copy the preview user, Stripe IDs or events.

- [ ] **Step 3: Document the deployment gate**

Mark code, preview and production schema GREEN. Mark Stripe Live activation explicitly deferred until the Cloudflare Worker has a stable API URL and secret store. The later deployment must provide live key, live Price IDs, live Portal configuration and a live webhook endpoint selecting exactly the handled events.

- [ ] **Step 4: Document rollback**

Rollback before live activation is code-only: redeploy the previous API/frontend commit. Keep migration `005` in place because it is additive and empty; do not drop billing audit/outbox tables. If preview processing misbehaves, disable the Test Mode webhook destination and restore the previous code while preserving events for diagnosis.

- [ ] **Step 5: Final verification and commit**

```powershell
git diff --check
git status --short
git -C .worktrees/vapt-api-infra-foundation status --short
```

Commit documentation only after every claimed gate has current evidence.

---

## Exit criteria

- [ ] No API or frontend runtime path depends on n8n.
- [ ] API uses pinned official `stripe-node`; REST fallback was not introduced.
- [ ] New subscriptions use hosted Checkout Sessions.
- [ ] Existing subscriptions use Customer Portal.
- [ ] Browser-controlled Price/email/Stripe IDs are rejected.
- [ ] State changes only through verified webhooks.
- [ ] All five minimum event types are handled and tested.
- [ ] Duplicate, retry and concurrent webhook behavior is proven.
- [ ] Customer and Subscription IDs are unique per restaurant binding.
- [ ] Email intents are durable and deduplicated; no Resend call occurs in the webhook.
- [ ] Preview real Test Mode checkout/Portal flow passed and was cleaned.
- [ ] Production has the identical schema and zero test data.
- [ ] Stripe Live activation is deferred to the Worker deployment, not silently pointed at the current legacy runtime.
- [ ] API and frontend full tests/build/typecheck pass.
- [ ] Critical/Important review findings are zero.

## Official references used for the design

- [Stripe Checkout Session API](https://docs.stripe.com/api/checkout/sessions/create)
- [Stripe Customer Portal session API](https://docs.stripe.com/api/customer_portal/sessions/create)
- [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Stripe webhook signature verification](https://docs.stripe.com/webhooks/signature)
- [Stripe subscription update and proration behavior](https://docs.stripe.com/api/subscriptions/update)
- [Official stripe-node repository](https://github.com/stripe/stripe-node)
- [Official stripe-node Cloudflare Worker template](https://github.com/stripe-samples/stripe-node-cloudflare-worker-template)
