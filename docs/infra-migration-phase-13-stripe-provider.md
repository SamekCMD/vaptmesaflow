# Etapa 13 — entrega Stripe Test no Worker

## Escopo e resultado — 08/10/2026

Ensaio real do provedor no sandbox existente `acct_1UKK2EQYNWCekS7F`, usando a API production já publicada em `api.vapt.app.br`. Não houve mudança de runtime, secret, schema, recurso Cloudflare, DNS, main, plano pago ou Stripe Live.

O endpoint existente `we_1UNjPKQYNWCekS7FvWV2SZuo` foi conferido desativado, temporariamente habilitado para o ensaio e restaurado a **disabled** antes da limpeza. URL exata `https://api.vapt.app.br/webhooks/stripe`, API version `2026-08-26.dahlia`, livemode=false e os mesmos seis eventos tratados pelo código, sem wildcard. [Stripe permite atualizar o estado do endpoint existente](https://docs.stripe.com/api/webhook_endpoints/update).

### Fixture e segurança

- Owner descartável `8946e8fb-0aa9-4f57-8d8f-d2cd119ddc4b`; restaurante `f80fef58-a7be-40c9-820b-885428d40997`, tag `stage13-stripe-20261008-8946e8fb`.
- Destinatário sintético `delivered+stage13-stripe-20261008-8946e8fb@resend.dev`; não houve destinatário de cliente. Entrega de email de billing não foi certificada.
- Bootstrap SQL somente desses metadados, user não verificado, sem senha, account ou session; não prova signup/login/autorização ou Checkout autenticado. Estado inicial Starter/trialing; estado Stripe escrito pelo Worker, nunca pelo operador SQL.
- Customer `cus_VP9pxIxkJLJb2Z`; Subscription `sub_1UOLVyQYNWCekS7FOCrcHKPz`, trial de sete dias no Price Pro existente. Nenhum método de pagamento fornecido. GET final confirmou a fatura inicial paid, amount_due=0, amount_paid=0 e total=0. Não é pagamento real nem prova de invoice paga de valor positivo. [Stripe separa os recursos de teste dos pagamentos reais](https://docs.stripe.com/testing).
- Credenciais usadas somente em memória pelo SDK já instalado; valores e erros brutos não foram registrados. Operador restrito ao account/endpoint/project/branch/host/database/role existentes e aos UUIDs/metadados próprios.

### Eventos recebidos e estado no Neon

| Evento real, enviado e assinado pelo Stripe | Estado observado pelo SQL de inspeção | Intent próprio |
| --- | --- | --- |
| `invoice.paid` — `evt_1UOLVzQYNWCekS7FpBJgyTos` | Pro/trialing, Customer e Subscription associados, cancel-at-period-end=false | subscription_activated: 1 |
| `customer.subscription.updated` — `evt_1UOLW3QYNWCekS7FF5cFPcYb` | Pro/trialing, cancel-at-period-end=true | activation manteve 1 |
| `customer.subscription.deleted` — `evt_1UOLW6QYNWCekS7FLZ1RBm6T` | Pro/cancelled, cancel-at-period-end=false | subscription_cancelled: 1; activation: 1 |

Os três provider events ficaram processed, attempt_count=1. Nenhuma assinatura de webhook foi fabricada ou lida do secret da Cloudflare; a entrega automática real do Stripe acionou o handler e seu gateway canônico no Worker/Hyperdrive. Não inferir replay, concorrência ou comportamento fora de ordem desta sequência.

### Verificação e limpeza

Guards do operador: três falhas esperadas RED por guards ausentes, depois três GREEN, com novos GREEN antes da execução. O primeiro comando local foi bloqueado por spawn EPERM; esse erro ambiental não foi contado como RED funcional.

A primeira transação de preparação falhou antes de habilitar o endpoint/criar Customer: o operador usava `trial`, mas o schema 005 existente exige `trialing`. Diagnóstico filtrado reproduziu SQLSTATE23514/`restaurants_plan_status_check`; ajuste somente no operador, sem migration ou mudança de API. Ambas as falhas fizeram rollback e conferiram zero resíduos. Execução corrigida completou a sequência real acima e encerrou com exit0.

Cleanup restaurou primeiro o endpoint disabled; cancelou a Subscription e excluiu somente seu Customer, conferidos novamente por GET. SQL transacional removeu somente os três events com ambos os UUIDs próprios/test payload e os metadados exatos de owner/restaurante; cascade removeu seus intents. Zero resíduos em seis tabelas: user/account/session/restaurants/billing_email_outbox/billing_provider_events; pool fechado. Nenhum dado alheio removido ou backup dos dados descartáveis criado. Fatura/events/Subscription cancelada permanecem como histórico normal do Stripe; não afirmar zero objetos no provedor.

Readbacks Cloudflare pré/pós passaram: API `94fffd63-f759-43c3-9f6a-0387e14e8c73` e frontend `916951fb-b0a8-43a2-ab7a-ba4923064425` a100%, CPU1000, mesmos oito nomes de secrets/HD/R2/DO/domínios/flags, Cron0 na API, realtimefalse, StripeTest, R2privado, API workers.dev/VersionURLs off. Leitura Stripe independente pós-cleanup confirmou endpoint disabled, Subscription canceled, Customer deleted, sem cartão e fatura inicial de valor zero.

## Limites e próxima continuidade

Este gate comprova entrega assinada real, reconciliação canônica de trial/cancelamento, persistência e os dois intents, no destino Worker production. Não certifica Checkout/Portal autenticados no Worker, pagamento Test de valor positivo, renewal/payment_failed/expired Checkout, replay/out-of-order/concorrência remotos, entrega Queue/Resend, capacidade ou Stripe Live. A prova anterior de Checkout/Portal/replay no preview/local consta em `infra-migration-phase-7-stripe.md`, não substitui esses gates remotos.

Etapa13/cutover seguem abertos. Não reativar o endpoint permanentemente, ativar Stripe Live, tornar R2 público, alterar main ou desligar a VPS por inferência desse resultado. Próximos gates permanecem ciclo Checkout/Portal completo no destino, imagens públicas deliberadas, realtime production, observabilidade/capacidade e recuperação/cutover conforme o plano.
