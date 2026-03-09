
# Plano: Pagina de Precos + Stripe Checkout via n8n + Trial + Feature Gating

## Resumo

Criar uma pagina dedicada `/pricing` com os 3 planos (Starter R$97, Pro R$197, Business R$347), integrar com Stripe Checkout via webhook n8n, implementar trial de 3 dias no onboarding, e bloquear funcionalidades por plano no dashboard.

---

## 1. Banco de Dados - Migracoes SQL

Adicionar colunas na tabela `restaurants`:

```sql
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'starter' CHECK (plan_type IN ('starter', 'pro', 'business')),
  ADD COLUMN IF NOT EXISTS plan_status TEXT NOT NULL DEFAULT 'trialing' CHECK (plan_status IN ('trialing', 'active', 'expired', 'cancelled')),
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
```

No onboarding (INSERT do restaurante), setar `trial_ends_at = now() + interval '3 days'` e `plan_status = 'trialing'`.

---

## 2. Arquivos a Criar

| Arquivo | Descricao |
|---|---|
| `src/pages/PricingPage.tsx` | Pagina publica/autenticada de planos e precos com botoes de checkout |
| `src/hooks/use-plan.ts` | Hook centralizado que expoe `planType`, `planStatus`, `trialEndsAt`, `isFeatureAllowed(feature)`, `trialRemainingLabel` |
| `src/components/FeatureGate.tsx` | Wrapper que mostra overlay com cadeado + link para /pricing quando funcionalidade esta bloqueada |
| `src/components/dashboard/TrialBanner.tsx` | Banner no topo do dashboard mostrando dias restantes do trial |

## 3. Arquivos a Modificar

| Arquivo | Mudanca |
|---|---|
| `src/App.tsx` | Adicionar rota `/pricing` |
| `src/components/landing/Pricing.tsx` | Atualizar planos (Starter/Pro/Business) e linkar para `/pricing` |
| `src/components/landing/Navbar.tsx` | Link "Planos" aponta para `/pricing` |
| `src/pages/onboarding/OnboardingPage.tsx` | Setar `trial_ends_at` no INSERT |
| `src/components/DashboardLayout.tsx` | Importar `TrialBanner` e `usePlan`; mostrar banner de trial |
| `src/pages/dashboard/CashierPage.tsx` | Envolver com `FeatureGate` (requer Pro+) |
| `src/pages/dashboard/WhatsAppIntegration.tsx` | Envolver com `FeatureGate` (requer Business) |
| `src/lib/constants.ts` | Adicionar URL do webhook de checkout n8n |

---

## 4. Detalhes Tecnicos

### 4.1 Definicao dos Planos

```typescript
export const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 97,
    priceId: "price_XXXX", // Stripe Price ID - usuario configura
    features: [
      "Cardapio digital ilimitado",
      "QR Codes para mesas",
      "KDS - Monitor de Cozinha",
      "Pedidos ilimitados",
      "Suporte por e-mail",
    ],
    blocked: ["cashier", "open_tab", "whatsapp_bot", "multi_users"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 197,
    priceId: "price_YYYY",
    features: [
      "Tudo do Starter",
      "Caixa e Comanda Aberta",
      "Dashboard de metricas",
      "Suporte prioritario",
    ],
    blocked: ["whatsapp_bot", "multi_users"],
  },
  {
    id: "business",
    name: "Business",
    price: 347,
    priceId: "price_ZZZZ",
    features: [
      "Tudo do Pro",
      "WhatsApp Bot com IA",
      "Multi-usuarios",
      "Relatorios avancados",
      "Gerente de conta dedicado",
    ],
    blocked: [],
  },
];
```

### 4.2 Hook `usePlan`

Busca `plan_type`, `plan_status` e `trial_ends_at` da tabela `restaurants` pelo `owner_id` do usuario autenticado. Expoe:

- `planType`: "starter" | "pro" | "business"
- `planStatus`: "trialing" | "active" | "expired" | "cancelled"
- `isActive`: true se `plan_status === 'active'` OU (`plan_status === 'trialing'` E `trial_ends_at > now()`)
- `trialDaysLeft`: numero de dias restantes (ou 0)
- `trialLabel`: string formatada "X dias restantes"
- `canAccess(feature: string)`: retorna true se o plano atual permite a feature

### 4.3 Pagina `/pricing` (PricingPage.tsx)

- Se usuario NAO esta logado: mostra a pagina normalmente com botao "Assinar" que redireciona para `/login?redirect=/pricing`
- Se usuario esta logado:
  - Mostra o plano atual com badge "Plano Atual"
  - Botao "Assinar" dispara POST para webhook n8n com `{ restaurant_id, email, price_id }`
  - n8n cria Stripe Checkout Session e retorna `{ url }`
  - Frontend redireciona para `url` (Stripe Checkout)
  - Apos pagamento, Stripe webhook no n8n atualiza `plan_type`, `plan_status = 'active'` e `stripe_*` no Supabase

Design: 3 cards com animacao framer-motion, cores do tema, badge "Mais Popular" no Pro, check marks nas features, X vermelho nas bloqueadas.

### 4.4 Fluxo de Checkout

```text
Usuario clica "Assinar Pro"
  -> POST para N8N_CHECKOUT_WEBHOOK_URL
     body: { restaurant_id, email, price_id, success_url, cancel_url }
  -> n8n cria Stripe Checkout Session
  -> retorna { url }
  -> window.location.href = url (redireciona para Stripe)
  -> Stripe processa pagamento
  -> Stripe webhook -> n8n -> UPDATE restaurants SET plan_type, plan_status='active'
  -> Usuario volta para success_url (/dashboard?checkout=success)
```

### 4.5 TrialBanner

Componente que aparece no topo do dashboard quando `plan_status === 'trialing'`:

- Verde: "Voce tem X dias de teste gratuito. [Assinar Plano]"
- Amarelo: "Seu teste expira amanha! [Assinar Agora]"  
- Vermelho: "Seu teste expirou. [Assinar para continuar]"

### 4.6 FeatureGate

```tsx
<FeatureGate feature="cashier" requiredPlan="pro">
  <CashierPage />
</FeatureGate>
```

Quando bloqueado: renderiza overlay semi-transparente com icone de cadeado e texto "Disponivel no Plano Pro" + botao para `/pricing`.

### 4.7 Bloqueio por Plano

| Feature | Starter | Pro | Business |
|---|---|---|---|
| Cardapio digital | OK | OK | OK |
| KDS Cozinha | OK | OK | OK |
| Configuracoes | OK | OK | OK |
| Caixa / Comanda Aberta | Bloqueado | OK | OK |
| Dashboard metricas | OK | OK | OK |
| WhatsApp Bot | Bloqueado | Bloqueado | OK |
| Multi-usuarios | Bloqueado | Bloqueado | OK |

### 4.8 Bloqueio total quando trial expira

No `ProtectedRoute` ou no `DashboardLayout`, verificar:
- Se `plan_status !== 'active'` E (`plan_status !== 'trialing'` OU `trial_ends_at < now()`):
  - Redirecionar para `/pricing` com mensagem de que o acesso expirou
  - Permitir apenas a pagina de `/pricing` e `/dashboard/settings`

### 4.9 Onboarding - Trial automatico

No `handleFinish` do `OnboardingPage.tsx`, adicionar ao INSERT:

```typescript
trial_ends_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
plan_status: 'trialing',
plan_type: 'starter',
```

### 4.10 Constantes n8n

Adicionar em `constants.ts`:

```typescript
export const N8N_CHECKOUT_WEBHOOK_URL = import.meta.env.VITE_N8N_CHECKOUT_WEBHOOK_URL 
  || "https://samuel-n8n.br8r5p.easypanel.host/webhook/stripe-checkout-vapt";
```

---

## 5. Fluxo Resumido

```text
ONBOARDING:
  1. Usuario cria conta e restaurante
  2. trial_ends_at = now + 3 dias, plan_status = 'trialing'
  3. Acesso total por 3 dias

DASHBOARD (durante trial):
  1. Banner verde: "X dias de teste restantes"
  2. Todas as funcionalidades liberadas durante o trial

TRIAL EXPIRADO:
  1. Banner vermelho + redirect para /pricing
  2. Apenas /pricing e /settings acessiveis

CHECKOUT:
  1. /pricing -> Clica "Assinar Pro"
  2. POST n8n -> Stripe Checkout -> Redirect
  3. Pagamento -> n8n atualiza Supabase
  4. plan_status = 'active', plan_type = 'pro'

POS-ASSINATURA:
  1. Features liberadas conforme plano
  2. Features bloqueadas mostram overlay + cadeado
```

---

## 6. Secao Tecnica - Resumo de Mudancas

### Migracoes SQL:
- Adicionar colunas `plan_type`, `plan_status`, `trial_ends_at`, `stripe_customer_id`, `stripe_subscription_id` em `restaurants`

### Novos arquivos (4):
- `src/pages/PricingPage.tsx`
- `src/hooks/use-plan.ts`
- `src/components/FeatureGate.tsx`
- `src/components/dashboard/TrialBanner.tsx`

### Arquivos modificados (8):
- `src/App.tsx` - rota /pricing
- `src/lib/constants.ts` - webhook URL
- `src/components/landing/Pricing.tsx` - novos planos
- `src/components/landing/Navbar.tsx` - link para /pricing
- `src/pages/onboarding/OnboardingPage.tsx` - trial_ends_at no INSERT
- `src/components/DashboardLayout.tsx` - TrialBanner + bloqueio trial expirado
- `src/pages/dashboard/CashierPage.tsx` - FeatureGate pro
- `src/pages/dashboard/WhatsAppIntegration.tsx` - FeatureGate business

### Configuracao necessaria pelo usuario:
- Criar 3 produtos/precos no Stripe (Starter, Pro, Business)
- Configurar workflow no n8n para receber POST, criar Checkout Session e retornar URL
- Configurar webhook do Stripe no n8n para atualizar `plan_status` no Supabase apos pagamento
- Definir os `price_id` do Stripe nos planos (pode ser via env vars ou hardcoded)
