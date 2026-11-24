# Operação, diagnóstico privado e recuperação — 24/11/2026

## Estado comprovado e pendências

- Fonte do diagnóstico revisada sem achados; API 720/720, runtime workerd 32/32 e configuração 13/13 aprovados. Billing: 64 passaram, com 3 skips PostgreSQL preexistentes; typechecks e bundles passaram.
- Sonda remota própria aprovada: 7 pontos de enum, 44 colunas verificadas e nenhuma sentinela de request/erro persistida. Sonda removida, transporte encerrado e recursos de negócio preservados; recibo local `.superpowers/ops-closure/probe-result.json`.
- **Diagnósticos publicados:** API versão42 `d18863be-4d77-461c-9cc3-0dabd706b365`, billing versão7 `f16fed43-6763-4dfe-996a-ff536eac2d09`, ambos100%. Código remoto byte a byte, demais bindings/settings/schedules e outros Workers/Preview preservados; [manifesto](infra-migration-closure-status-2026-11-24.md). Não foi induzida falha em produção para emitir pontos.
- Workers Logs, traces e Issues permanecem desligados. Não executar o antigo perfil de Workers Logs reprovado por metadata de URL.
- UI financeira confirmou Workers US$0/US$1 e Durable Objects US$0/US$1 no ciclo24/11–23/12 após salvar ambos com Block usage habilitado. Titular autorizou o email de cobrança já cadastrado para avisos; histórico mostra as duas alterações. OAuth existente retornou403 na leitura Billing; conferência pelo painel autenticado, sem ampliar credenciais.

## Alvos e controles preservados

| Função | Handle original |
| --- | --- |
| API | `vapt-api-production`, domínio `api.vapt.app.br` |
| Frontend | `vapt-web`, domínio `vapt.app.br` |
| Billing | `vapt-billing-email-production` |
| Queue | `vapt-emails-production`, ID`69f033ad5eb6424c99b41d1baa7ff3ad` |
| DLQ | `vapt-emails-production-dlq`, ID`ad6e9115d01f4c63a43a557f18c0a3a9` |
| Consumer | `8fb8e9ad983442aaab49079154d3d799` |

Billing mantém Cron `*/30 * * * *`, batch 10, retries 3 e retry_delay 60s; DLQ separada. Conferir o estado remoto fresco antes de qualquer intervenção. Não tratar fotografias antigas como estado atual nem reexecutar journals consumidos.

## Consultar falhas sem acessar o banco

Dataset previsto: `vapt_operational_diagnostics_production`, binding `DIAGNOSTICS` somente nos produtores de produção. Ponto permitido: index derivado dos enums, blob1=componente, blob2=código, double1=1. Nenhuma URL, header, cookie, payload, identidade ou mensagem de exceção integra o contrato.

Executar no SQL API privado do Analytics Engine, com acesso já existente, sem colocar token em arquivo/argumento/log. Esta consulta fixa não consulta nem acorda o Neon:

```sql
SELECT blob1 AS component, blob2 AS code,
       SUM(_sample_interval * double1) AS failures
FROM vapt_operational_diagnostics_production
WHERE timestamp >= NOW() - INTERVAL '1' DAY
GROUP BY blob1, blob2
ORDER BY component, code
```

| Componente | Códigos permitidos e interpretação |
| --- | --- |
| `api` | `config_invalid`: configuração inválida; `http_5xx`: resposta 5xx; `fetch_failed`: handler falhou; `scheduled_failed`: handler agendado falhou |
| `billing` | `scheduled_failed`: despacho falhou; `queue_failed`: consumer falhou; `queue_retry_requested`: processamento solicitou retry |

Os contadores são por código e invocação, deduplicados; códigos diferentes podem descrever a mesma falha. Não somar como número de incidentes, emails perdidos ou requests únicos. Retry solicitado não prova esgotamento de tentativas ou chegada à DLQ.

Dataset inexistente antes da primeira falha escrita é **ausência de evidência**, não zero falhas. Não injetar falha em produção para criá-lo. Resultado vazio, 403 ou indisponibilidade também não certificam saúde. Métricas agregadas cobrem falhas que impeçam a emissão; outcome de execução `success` não garante HTTP 2xx ou entrega de negócio.

Analytics Engine usa amostragem adaptativa: manter o peso `_sample_interval`; retenção documentada de 3 meses. Não é trilha completa de auditoria, recibo de entrega ou alerta contínuo. [Estrutura/SQL](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/), [amostragem](https://developers.cloudflare.com/analytics/analytics-engine/sampling/), [retenção](https://developers.cloudflare.com/analytics/analytics-engine/limits/).

## Diagnóstico e recuperação

1. Anotar horárioUTC, componente, código fixo, contagem e janela. Conferir deployment/configuração do handle original; usar métricas agregadas de invocações/erros/CPU e estado dos provedores. Não habilitar logs brutos ou exportar dados de cliente.
2. API: para `config_invalid`, conferir presença dos nomes de bindings/secrets e flags, sem ler valores. Para 5xx/fetch, correlacionar versão, CPU/quota e disponibilidade de dependências. Se houve regressão de publicação, preparar rollback para versão comprovadamente compatível, preservando bindings/CPU/rates/ingress e verificando readback; não trocar versão ou configuração por palpite.
3. Billing: confirmar Cron de 30min, entrega habilitada, consumer/retries/DLQ e backlog agregado. Backlog é aproximado; zero não exclui mensagens em trânsito. Aguardar o próximo slot natural e a latência da telemetria; não disparar Cron/email/mensagem para testar produção.
4. Se backlog/DLQ cresce, conter apenas o writer/consumer afetado mediante procedimento autorizado e corrigir a causa. Não dar ack, purge, replay, reenvio em massa ou mudar retries automaticamente. Preservar mensagens e evidência agregada; inspeção de corpo/identidade exige necessidade e escopo específicos.
5. Antes de reprocessar, reconciliar a outbox e o efeito externo no Resend/Stripe, com IDs e autorização do caso. Resultado ambíguo exige reconciliação; não resetar status/leases para forçar entrega. DLQ Cloudflare e `dead_letter` SQL são estados distintos. [Recuperação da outbox](infra-migration-phase-13-billing-recovery.md), [prova Queue→DLQ](infra-migration-phase-13-billing-queue-dlq.md).
6. Neon: verificar primeiro quota/endpoint no control plane. Quota do projeto 216000s=60CUh; snapshot 24/11: 182284s usados no período 01/11–01/12. Endpoint 0,25CU, autosuspend 5min. Suspensão por quota não se resolve com loop de conexão; preservar orçamento e investigar atividade que impede idle, sem upgrade automático ou consulta de saúde que acorde o banco.
7. Perda de dados: preservar a origem e conter writers antes de planejar recuperação isolada. Backup/restauração de 10/11 já comprovou 30 tabelas; não repetir ensaio ou restaurar produção por rotina. Restore SQL não desfaz email/pagamento e pode ressuscitar sessões; reconciliar efeitos e revogações antes de promover uma recuperação. [Backup verificado](infra-migration-production-backup-2026-11-10.md).

## Custo e limites nativos

Orçamento informado: US$10–15/mês, máximo desejado US$20, sem planos novos. Workers Paid base US$5 e compute Neon limitado a 60CUh não cobrem todos os itens da fatura. O controle abaixo reduz exposição, mas **não garante teto global de US$20**.

- Workers: limite planejado US$1 de excesso de requests/CPU após franquia, aplicado à conta inteira. Exclui base US$5 e demais produtos; pode bloquear API, Cron, consumidores Queue e chamadas Worker→Worker.
- Durable Objects: limite separado planejado US$1 de operações/duração/leituras/escritas; **armazenamento fica excluído e pode continuar cobrado durante pausa**. Dependências podem falhar quando outro produto está bloqueado.
- Medição e bloqueio têm atraso; trabalho em andamento/falhas de enforcement podem exceder o limite. O ciclo é o da assinatura, não necessariamente mês civil. Limite habilitado persiste no próximo ciclo; pausar/despausar não zera gasto.
- Antes de aplicar: conferir saldo e policies existentes, obter destinatário autorizado exigido pela UI, preservar controles e fazer readback de produto/action `usage_block`/enabled/threshold 100 centavos. Não provocar gasto para testar bloqueio. Status habilitado ou threshold alcançado não comprova propagação na borda.

[Preço Workers](https://developers.cloudflare.com/workers/platform/pricing/), [limite Workers](https://developers.cloudflare.com/workers/platform/spend-management/), [limite Durable Objects](https://developers.cloudflare.com/durable-objects/platform/spend-management/), [semântica financeira](https://developers.cloudflare.com/billing/manage/spend-management/), [CLI/permissões Billing](https://developers.cloudflare.com/billing/manage/spend-management/cli/).

Analytics Engine informa uso atualmente não faturado e publica franquias/preços futuros; não assumir gratuidade permanente. Logs Workers mudam de modelo em 01/12/2026, mas continuam desligados neste desenho. [Preço Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/pricing/), [preço Observability](https://developers.cloudflare.com/observability/pricing/).

## Fechamento e próximos registros

Publicação e limites foram conferidos acima. Avisos financeiros usam o destinatário autorizado. Alertas contínuos de falha/backlog não foram configurados; o diagnóstico aqui é consulta privada sob demanda. Manter registro agregado de incidentes e intervenções efetivamente verificadas.

Regularização fiscal é uma frente separada e não é encerrada por saúde técnica ou orçamento: [roteiro fiscal pessoa física/DF](infra-migration-fiscal-pessoa-fisica-df.md).
