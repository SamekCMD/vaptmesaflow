# n8n desativado na nova infraestrutura

Decisão: **não restaurar n8n no Coolify**. Os exports e documentos antigos ficam preservados em `docs/integrations/n8n/` e `docs/integrations/n8n-contracts.md` apenas como referência; os textos desses arquivos descrevem a arquitetura histórica, não um runbook de deploy atual.

| Workflow versionado | O que fazia | Callers identificados | Recuperação |
| --- | --- | --- | --- |
| `stripe/Vapt Stripe.json` | Criar/alterar/cancelar assinatura, consultar status e processar webhook | Frontend `src/lib/n8n-client.ts`/`StripeCheckoutModal.tsx` → API `modules/billing/stripe`; API `modules/webhooks` → n8n | LEGACY / NOT RESTORED. Rotas não registradas sem n8n; modal indisponível. Stripe direto na API será outra tarefa. |
| `ingest/Vapt Ingest.json` — feedback | Upsert de avaliação de pedido | Frontend `order-feedback.ts` e API `/ingest/order-feedback` | SUBSTITUÍDO no fluxo atual: frontend chama RPC `submit_order_feedback`; a função exige o token privado do pedido, valida que ele foi entregue e aceita somente a primeira avaliação, sem abrir a tabela ao cliente anônimo. Rota antiga não registrada. |
| `ingest/Vapt Ingest.json` — push | Upsert de endpoint/assinatura de push | Frontend `push-notifications.ts` → API `/ingest/push-subscription` | LEGACY / NÃO CORE AGORA. Deixar `VITE_VAPID_PUBLIC_KEY` ausente; portar persistência segura para API ou banco em tarefa separada antes de ativar. |
| `asaas/Vapt Asaas.json` | Setup, Pix, webhook e estado do provider antigo | Fluxos Asaas históricos | SUPERSEDED pelo payment providers v2 e MP/manual direto na API. Não entra na baseline nem no runtime. |

As rotas Stripe e ingest da API são registradas só se a configuração n8n histórica completa estiver presente; o deploy de recuperação omite `N8N_BASE_URL`, `N8N_TIMEOUT_MS` e `VAPT_APP_ENDPOINT_SECRET`. `VAPT_ADMIN_ENDPOINT_SECRET` permanece porque protege o reconciliador próprio de pagamentos, **não** para manter n8n. O código do cliente legado permanece em Git para referência e testes, sem processo n8n ativo. Não apagar exports antes de concluir a futura substituição Stripe/push.

Próxima tarefa, fora desta recuperação: implementar Stripe direto API e trocar callers; portar push se o produto voltar a ativá-lo; então retirar `src/lib/n8n-client.ts`, `src/modules/n8n`, routes/dead tests e envs legadas em uma revisão isolada. Não misturar essa remoção com o WIP Auth/Resend.
