# Etapa 13 — ciclo Stripe Test e emails reais de billing

## Resultado observado — 08/10/2026

Gate concluído nos recursos production existentes, com cobranças exclusivamente simuladas no Stripe Test e destinatário sintético oficial do Resend. API `94fffd63-f759-43c3-9f6a-0387e14e8c73`, frontend `916951fb-b0a8-43a2-ab7a-ba4923064425` e billing Worker `1f578bc6-586a-46ca-b180-0301057b2cc8` não foram reimplantados. Nenhum secret, schema, binding, DNS, main, plano pago ou Stripe Live alterado.

Preflight verificou billing production com os dois secrets por nome, Cron `* * * * *`, Queue `vapt-emails-production`, consumer único batch10/retries3/delay60 e DLQ própria, sem URLs públicas. Outbox estava vazia. O campo do consumer na API Cloudflare é `script`; uma suposição local de `script_name` foi corrigida antes de qualquer fixture/escrita. API continua sem Cron; o Cron ativo pertence ao Worker de emails.

## Simulação descartável e eventos

Owner `010ab0f6-c4b2-4b6c-9e97-80a8f65486b1`, restaurante `92ef5e81-eafb-4fe7-8e1e-b72cb4033fd0`, tag `stage13-lifecycle-20261008-010ab0f6`, sink `delivered+stage13-lifecycle-20261008-010ab0f6@resend.dev`. SQL criou apenas user/restaurante Starter/trialing, sem conta de autenticação, senha ou sessão e sem escrever estado financeiro/outbox.

Test Clock `clock_1UOP4rQYNWCekS7FnRkHASex`, Customer `cus_VPDVwVSkVG3EQa` e Subscription `sub_1UOP4tQYNWCekS7FuXt7Lxrh`, todos Test e próprios. Price Pro existente19700BRL/mês. PaymentMethods publicados `pm_card_visa` e `pm_card_chargeCustomerFail`, sem cartão real ou dados de cartão enviados à API. Cada ciclo avançou primeiro ao fim do período e depois mais uma hora, conforme a [simulação oficial de renovação Stripe](https://docs.stripe.com/billing/testing/test-clocks/api-advanced-usage).

| Transição real do sandbox | Evento assinado processado, tentativa1 | Evidência canônica |
| --- | --- | --- |
| Ativação | `evt_1UOP4vQYNWCekS7FWB8tlujS` — invoice.paid | `in_1UOP4tQYNWCekS7Fejsk9yi7`, paid19700; Pro/active |
| Renovação | `evt_1UOP6EQYNWCekS7FgTdGJNfZ` — invoice.paid | `in_1UOP5zQYNWCekS7Fsym8u13o`, subscription_cycle/paid19700; Pro/active |
| Falha | `evt_1UOP7KQYNWCekS7F8QTdkPIN` — invoice.payment_failed | `in_1UOP72QYNWCekS7F2eePwRfT`, open/attempted/paid0; Pro/past_due |
| Cancelamento | `evt_1UOP82QYNWCekS7FPcssRlTd` — customer.subscription.deleted | Subscription canceled; SQL Pro/cancelled |

Quatro subscription.updated adicionais também terminaram processed/attempt1. O endpoint Test existente foi habilitado somente durante esse ensaio. Não houve evento fabricado, assinatura local, patch financeiro SQL ou chamada manual de envio.

## Cron → Queue → Resend

Os quatro intents foram entregues pelo Cron/consumer production existentes. Cada outbox: sent, attempt_count1, last_error null, destinatário próprio, alias correto e snapshot congelado com exatamente RESTAURANT_NAME=tag, PLAN_NAME=Pro e BILLING_URL=`https://vapt.app.br/dashboard/subscription`.

| Alias publicado | ID Resend, conferido Delivered na UI |
| --- | --- |
| billing-subscription-activated | `01a11d78-7372-71c4-8e39-7697bb9831ae` |
| billing-subscription-renewed | `01a11d79-5804-7a2f-8f13-017fab404d1e` |
| billing-payment-failed | `01a11d7a-6567-71f6-b64f-c33e6aa7fd12` |
| billing-subscription-cancelled | `01a11d7b-9831-70a4-b879-3a7bf5af88c6` |

Detalhes dos quatro emails confirmaram template, saudação própria, Pro e link fixo; lista filtrada mostrou exatamente quatro Delivered. Screenshot local `billing-lifecycle-four-delivered.png` no scratch da Etapa13. Não foi criada chave de leitura nem ampliado o acesso da chave Sending-only. Mais75segundos de Cron conservaram exatamente os mesmos quatro IDs/attempts, sem duplicata espontânea observada; isso não é prova de replay ou concorrência.

## Limpeza, verificações e limites

Endpoint Test restaurado disabled **antes** da limpeza. Clock identificado por ID/nome/livemodefalse; listagem com test_clock confirmou apenas Customer/Subscription próprios antes da exclusão. Clock removido/ausente e Customer deleted conferidos; Subscription já havia sido cancelada. [A exclusão da simulação encerra os objetos de teste associados](https://docs.stripe.com/api/test_clocks/delete); histórico do provedor e logs Delivered do Resend não foram apagados. SQL transacional removeu somente a fixture/eventos/outbox próprios e confirmou zero em seis tabelas; pool encerrado, operador exit0. Sem purge de Queue, replay de DLQ ou limpeza alheia.

Readbacks pré/pós preservaram o par público, CPU1000, oito secrets da API por nome, recursos/flags e R2 privado/realtimefalse/StripeTest. Guards relacionados11/11 e sintaxe do operador passaram; testes locais billing45pass/2Postgres integration skip/0fail, TypeScript exit0. Os dois testes integration exigem ambiente preview e não foram executados contra production. Nenhuma nova certificação das suítes históricas completas API/frontend é atribuída a este gate.

Continuação posterior em `docs/infra-migration-phase-13-billing-recovery.md` aprovou recuperação do protocolo SQL em production (claims pontuais concorrentes/fencing/retry/leases/reservas/attemptcap/uncertainty), sem provider sends. Não substitui prova do transporte externo. Etapa13/cutover seguem abertos: replay/out-of-order de webhook real, falhas e recuperação do transporte Queue/DLQ, mutações Portal, imagens públicas deliberadas, realtime production, observabilidade/capacidade e estabilidade. Não ativar permanentemente endpoint Test, Stripe Live, merge main ou desligamento da VPS por inferência destes ensaios.
