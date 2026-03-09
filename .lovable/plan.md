

# Sprint: Integração Stripe Elements — Assinaturas

## Contexto

O projeto ja tem `usePlan` hook, `TrialBanner`, `FeatureGate`, e `PricingPage` com checkout via redirect n8n. O pedido e migrar para Stripe Elements inline com modal, criar `useSubscription`, nova pagina `/dashboard/subscription`, badge na sidebar, e pos-pagamento.

A maior parte da logica ja existe em `use-plan.ts`. O novo `useSubscription` sera essencialmente um wrapper/evolucao dele com a interface pedida.

## Dependencias

Instalar `@stripe/stripe-js` e `@stripe/react-stripe-js`.

## Arquivos a criar/modificar

### 1. `src/hooks/useSubscription.ts` (criar)
- Reutiliza a logica de `use-plan.ts` mas com a interface pedida
- `featureAccess` map com `cashier`, `open_tab`, `metrics`, `whatsapp`, `multi_user`, `advanced_reports`
- `canAccess(feature: string)` — trial = acesso total
- Exporta `planType`, `planStatus`, `trialEndsAt`, `trialDaysLeft`, `isTrialing`, `canAccess`, `restaurantId`, `loading`, `refetch`

### 2. `src/pages/dashboard/SubscriptionPage.tsx` (criar)
- 3 cards usando `PLANS` de `lib/plans.ts`
- Badge "Mais Popular" no Pro, "Plano Atual" no plano ativo
- Botao "Assinar" abre modal de checkout (estado local `selectedPlan`)
- Usa `useSubscription` para detectar plano atual

### 3. `src/components/dashboard/StripeCheckoutModal.tsx` (criar)
- Dialog com nome do plano + preco no topo
- Ao abrir: POST para `VITE_N8N_STRIPE_WEBHOOK` com `{ action: 'create_checkout_session', restaurant_id, email, price_id, plan_type }`
- Recebe `clientSecret`, renderiza `<Elements>` + `<PaymentElement>`
- `CheckoutForm` interno com `stripe.confirmPayment` e `return_url: /dashboard?subscribed=true`
- Loading, erro inline, nota de seguranca
- `loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)`

### 4. `src/components/DashboardLayout.tsx` (modificar)
- Importar `useSubscription` em vez de `usePlan`
- Adicionar nav item `{ title: "Assinatura", icon: CreditCard, path: "/dashboard/subscription" }`
- Sidebar footer: badge clicavel com plano atual (Trial cinza, Starter branco, Pro verde, Business dourado)
- Trial banner ja existe, atualizar para usar `useSubscription` e linkar para `/dashboard/subscription`

### 5. `src/components/dashboard/TrialBanner.tsx` (modificar)
- Trocar `usePlan` por `useSubscription`
- Link aponta para `/dashboard/subscription` em vez de `/pricing`

### 6. `src/components/FeatureGate.tsx` (modificar)
- Trocar `usePlan` por `useSubscription`
- Link aponta para `/dashboard/subscription`

### 7. `src/App.tsx` (modificar)
- Adicionar rota `<Route path="subscription" element={<SubscriptionPage />} />`

### 8. `src/pages/dashboard/Overview.tsx` (modificar)
- Detectar `?subscribed=true` query param
- Mostrar toast de sucesso, chamar `refetch()` do subscription, limpar query param

### 9. Paginas gated (`CashierPage`, `WhatsAppIntegration`)
- Ja usam `FeatureGate` que sera atualizado automaticamente

## Fluxo do checkout

```text
User clica "Assinar Pro"
  → Modal abre, POST para n8n webhook
  → n8n cria Stripe subscription, retorna clientSecret
  → Modal renderiza PaymentElement
  → User preenche cartao, confirma
  → Stripe redireciona para /dashboard?subscribed=true
  → Overview detecta param, mostra toast, refetch plano
```

## Badge na sidebar

| Status | Visual |
|---|---|
| Trial | `bg-muted text-muted-foreground` "Trial · X dias" |
| Starter | `bg-secondary` "Starter" |
| Pro | `bg-green-500/10 text-green-500 border-green-500/30` "Pro" |
| Business | `bg-yellow-500/10 text-yellow-500 border-yellow-500/30` "Business" |

## Notas
- Todas as chaves/IDs via `import.meta.env.VITE_*` (ja configuradas em `lib/plans.ts`)
- `use-plan.ts` sera mantido para retrocompatibilidade mas componentes migram para `useSubscription`
- O redirecionamento de trial expirado no DashboardLayout sera atualizado para apontar `/dashboard/subscription` em vez de `/pricing`

