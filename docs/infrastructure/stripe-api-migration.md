# Stripe direto na API — trabalho futuro

**Não implementado nesta recuperação.** Não há clientes ou assinaturas reais a migrar. O n8n não foi restaurado e billing Stripe está indisponível, sem impedir Auth, onboarding, dashboard e Mercado Pago. A baseline não contém novo `stripe_customer_id`, `stripe_subscription_id`, `billing_provider_events` ou modelo de idempotência futuro.

## Estado histórico e lacuna

Frontend `StripeCheckoutModal`/`n8nClient.stripe` chamava `/billing/stripe/*` na vapt-api. A API autenticava/autorizava e encaminhava ao workflow `docs/integrations/n8n/stripe/Vapt Stripe.json`; o webhook Stripe entrava em `/webhooks/stripe`, validava assinatura, reservava evento e era encaminhado ao workflow para atualizar billing. Esse fluxo não pode ser usado sem n8n. O checkout atual só mostra indisponibilidade e requer a trava explícita `VITE_LEGACY_STRIPE_ENABLED=true` além das credenciais; na recuperação ela permanece `false`, portanto variáveis antigas não o reativam. O plano/trial organizacional necessário ao desenvolvimento permanece em `organization_subscriptions`, independente do redesign Stripe.

## Estado alvo a projetar em outra tarefa

Frontend → vapt-api (checkout/alteração/cancelamento/status) → Stripe; Stripe webhook → vapt-api → Supabase/Postgres. Toda secret key, webhook secret e atualização de plano são server-only. A API deve resolver organização autorizada, usar idempotency keys do provider, persistir evento/processamento de forma transacional e tolerar retries/out-of-order. Frontend só recebe publishable key, price IDs públicos e client secret de sessão permitido. A tabela/event model exata será desenhada com testes nessa tarefa; **não** antecipá-la nesta baseline.

Plano futuro: inventariar payloads/estados do workflow exportado; definir contrato dos endpoints e autorização multitenant; escolher schema mínimo conforme consumo real; implementar Stripe SDK na API e webhook direto com assinatura/idempotência; migrar frontend; testar checkout, atualização, cancelamento, retries, eventos fora de ordem e rejeição cross-tenant; só então remover cliente/workflows/config n8n legados. Nenhum endpoint Stripe deve estar exposto no deploy atual.
