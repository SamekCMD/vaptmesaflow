# Fechamento da migração — 24/11/2026

Este é o estado atual. Checklists de outubro e fotografias anteriores são histórico, não instruções para repetir gates concluídos.

## Infraestrutura e integração

A migração principal foi integrada em10/11: [frontend#4](https://github.com/SamekCMD/vaptmesaflow/pull/4) e [API#1](https://github.com/SamekCMD/vapt-api/pull/1). O titular excluiu o servidor Hetzner e o projeto ficou vazio; site/API continuaram funcionando. Não há tarefa de resgatar Vercel, Easypanel, Coolify ou o antigo Supabase.

O delta da nova conta Stripe foi integrado: [API#2](https://github.com/SamekCMD/vapt-api/pull/2), main`c15a07b532918696e76c86b89f895897249bee39`, e [frontend/docs#5](https://github.com/SamekCMD/vaptmesaflow/pull/5), main`8b597e8a12e47c3b817b7a8ef975033b6467a132`, com CI aprovado. Os diagnósticos da API foram integrados no [PR#3](https://github.com/SamekCMD/vapt-api/pull/3), main`d4660e27a606f0a4190445c0fc9e1368daa6c622`; push/PR do SHA`d1fa9ed` passaram nos runs45334187208/45334287270. Este último delta de billing e documentação corresponde ao [frontend#6](https://github.com/SamekCMD/vaptmesaflow/pull/6). Seu merge encerra a integração técnica; para continuidade, consultar o status desse PR, sem reabrir os merges anteriores.

| Frente | Evidência |
| --- | --- |
| Cloudflare/Neon/Hyperdrive/Better Auth | Produção na nova arquitetura; ambientes separados |
| R2/imagens/catálogo/realtime | Reader/writer/realtime ligados; compressão automática e quota100MiB por restaurante; gates anteriores preservados |
| Billing | Queue/consumer/DLQ existentes; Cron30min e retry preservados |
| Backup/restauração | Dump10/11 restaurado e comparado em30tabelas; hash/tamanho conferidos novamente sem repetir restore |
| Stripe Test | Checkout Pro, estado Neon/API, webhooks reais e cancelamento comprovados |
| Stripe Live | Conexão instalada, endpoint habilitado, entrega real de evento comprovada; nenhuma cobrança real |
| Diagnóstico privado | API e billing publicados com códigos fixos no Analytics Engine; logs/traces/Issues desligados |
| Proteção de custo | Limites nativos de US$1 de excedente Workers e US$1 Durable Objects salvos e conferidos no painel |

## Manifesto publicado

| Produtor | Versão | Deployment | SHA256 do módulo |
| --- | --- | --- | --- |
| API `vapt-api-production` |42, `d18863be-4d77-461c-9cc3-0dabd706b365` | `05c38e62-fac4-440e-b3ac-d080ac767f45` | `3be50f2c47a61892978c37f4c8e1616b1f9ecd9f73f7bd0c006cf9a0bf8cd495` |
| Billing `vapt-billing-email-production` |7, `f16fed43-6763-4dfe-996a-ff536eac2d09` | `fa31894f-f1de-40ea-a3ee-38f0b78146e4` | `4183c93d458720ebf17c5a2ca6920b3d40bc025e1d8b9e741de502b432098983` |

Publicação100% com comparação das versões, código remoto byte a byte, bindings/secrets opacos preservados, settings/schedules conferidos e outros Workers/Preview inalterados. O primeiro upload parou antes do deploy porque a comparação da resposta do PATCH não passou; GETs completos comprovaram o delta restrito e a versão42 foi retomada sem novo upload. Recibo local ignorado `.superpowers/ops-closure/publication-result.json` aprovado.

Validação: API720/720, runtime workerd32/32, perfil13/13, billing64passou/3skips PostgreSQL preexistentes, TypeScript e dry-runs aprovados. Revisão independente sem achados no código; melhoria do recibo parcial do operador aplicada antes da publicação. Sonda privada comprovou7pontos e44colunas sem sentinelas de request/erro e foi removida. Readback final confirmou ambos deployments, logs desligados, Preview isolado, site/health200, webhook sem assinatura401 e consulta privada disponível com resultado vazio. Não induzir falhas em produção; resultado vazio não certifica zero falhas.

## Custo e recuperação

Painel Cloudflare: ciclo24/11–23/12, WorkersUS$0/US$1 e DurableObjectsUS$0/US$1 após salvar os bloqueios. Titular autorizou o email de cobrança já cadastrado para avisos. Não houve contratação nem carga artificial para testar o bloqueio. Mensalidade WorkersUS$5 e outros produtos ficam fora do limite Workers; armazenamento DO fica fora do limite DO. Medição/enforcement têm atraso. **Não existe teto global deUS$20 comprovado.**

Neon Launch já contratado: quota216000segundos=60CUh, contador182284 no ciclo01/11–01/12UTC; endpoints idle, min=max0,25CU, autosuspend padrão5min. Quota não foi elevada. Controles reduzem exposição e não transformam orçamento em garantia financeira. Meta do titularUS$10–15, capacidade máximaUS$20.

Consultas privadas, interpretação dos códigos, backlog/DLQ, incidentes, quota e recuperação: [runbook operacional](infra-migration-operational-runbook-2026-11-24.md). Não habilitar logs brutos nem replay, purge ou restore automático. [Backup verificado](infra-migration-production-backup-2026-11-10.md).

## Pendências externas para cobrança comercial

1. **Análise cadastral Stripe.** Cadastro enviado; nenhum campo atualmente devido, seis verificações pendentes; `charges_enabled=false`, `payouts_enabled=false`. Liberação depende da Stripe. Evento Live real`evt_1UfBrhH4hY0s7wXrZWai0MGV` foi entregue e registrado como`ignored`, tentativa1, sem associação de negócio/outbox; comprova transporte/assinatura, não assinatura paga. Não criar cobrança real automaticamente.
2. **Regularização fiscal.** Titular informou pessoa física no DF, sem ISS/CFDF nem orientação. Categoria técnica`txcd_10103001` aplicada nos seis produtos; todos os15preços Test/Live inclusivos. `automatic_tax` não habilitado; nenhum cadastro/alíquota/recolhimento inventado. [Roteiro fiscal com consulta pronta e fontes oficiais](infra-migration-fiscal-pessoa-fisica-df.md). Enquadramento PF/PJ, ISS, cadastro e emissão precisam ser definidos fora do código.

Essas pendências não reabrem a migração. Preços futuros trimestrais/semestrais/anuais continuam inativos em Test; oferecê-los na UI é expansão futura. Não declarar UI completa de convites de equipe restaurada sem comprovação.
