# Consolidação da migração — situação e integração

Checkpoint local: 16/10/2026. Este documento organiza a execução já aprovada; não autoriza merge, push, deploy, nova contratação ou cancelamento de serviço. Referências: [plano principal](infra-migration-plan.md), [plano do catálogo](infra-migration-public-catalog-event-driven-plan.md) e [inventário de writers](infra-migration-public-catalog-writers.md).

## Quanto falta

O plano principal continua na **Etapa 13**, consolidação/validação do destino. Não é necessário recriar em production todas as funcionalidades desenvolvidas em preview: o código é compartilhado, mas bindings, credenciais, dados e gates são próprios de cada ambiente.

O desvio de redução de consultas tem dez tarefas. No início desta continuação, cinco estavam formalmente concluídas localmente (1, 3, 4, 6 e 7); 2, 5 e 8 tinham implementação parcial, e 9/10 ainda não estavam encerradas. Isso não representa percentual de migração concluída nem redução financeira já medida. O checkpoint atualizado fica no inventário de writers.

Atualização desta continuação: **6/10 concluídas localmente**, incluindo a tarefa8 (`e7647be`, suíte final281/281). As quatro ainda abertas são2(prova PostgreSQL real),5(cobertura dos writers ativos),9(gates finais de runtime/deploy/CPU/privacidade) e10(bootstrap/ativação controlada). A tarefa9 avançou com293 testes frontend,660 API,29 workerd e25 guards aprovados, mas não está encerrada. A leitura remota confirmou o bucket preview público e exige ajuste aprovado do desenho; foi solicitada separação dos snapshots em buckets privados, sem criar recursos. Nenhum número significa produção já ativada.

Restam como gates do desvio: integração das telas e imagens; prova PostgreSQL real do journal; validação de runtime, CPU, flags/rollback e privacidade; bootstrap controlado; comprovação de que os writers ativos usam o protocolo; revisão final e ativação controlada. Testes locais não substituem esses gates.

Depois retomamos os gates ainda abertos da Etapa 13, incluindo a consolidação/reteste do billing e a verificação conjunta do produto. As etapas finais são:

| Etapa | O que precisa acontecer |
| --- | --- |
| 14 | Estabilidade sem dependência da VPS, com observação de erros e consumo real. |
| 15 | Workers Paid **já ativado**; não contratar novamente. Não constitui teto de fatura. |
| 16 | Backup final e identificação do procedimento de restauração. |
| 17 | Desligar somente componentes antigos que ainda existam e tenham dependência zero comprovada. Não procurar Easypanel, que não existe mais. |
| 18 | Cancelar Hetzner após confirmação de ausência de responsabilidades e backup. |
| 19 | Confirmar remoção do legado Vercel, se ainda houver algo pertinente; não refazer DNS já migrado. |

Não há base para prometer prazo em horas ou um percentual global. Orçamento informado: confortável US$10–15/mês, limite pessoal US$20; limites técnicos e alertas reduzem exposição, mas não garantem teto de cobrança.

## Dois repositórios, duas integrações

Frontend: `SamekCMD/vaptmesaflow`, checkout `D:/Projetos/vaptmesaflow`. API: `SamekCMD/vapt-api`, checkout `D:/Projetos/vaptmesaflow/.worktrees/vapt-api-infra-foundation`. Ambos estão em `codex/infra-foundation`, mas possuem históricos, PRs e mains separados. Um commit/push na main **não inclui outras branches automaticamente**.

Snapshot de refs locais em 16/10, sem fetch: as branches abaixo não são ancestrais de `codex/infra-foundation`. Isso não prova que todas as suas alterações estejam ausentes: pode haver cherry-picks, versões substitutas e commits equivalentes.

| Repositório | Branch a conferir | Tip local |
| --- | --- | --- |
| Frontend | `codex/e2e-regression-cleanup` | `8e02d4d` |
| Frontend | `codex/infrastructure-recovery` | `c9fcc17` |
| Frontend | `codex/multitenant-v2` | `4299d94` |
| Frontend | `codex/payment-effects-stage7-db` | `a427867` |
| API | `codex/infrastructure-recovery` | `25d7642` |
| API | `codex/jwks-auth-transition` | `8b13337` |
| API | `codex/membership-authorization` | `d378780` |
| API | `codex/mercado-pago-oauth-stage8-workspace` | `4e3db74` |
| API | `codex/payment-effects-stage7-work` | `16db546` |

Branches já ancestrais também precisam ter o comportamento final conferido: presença no histórico não garante que uma mudança posterior não tenha removido algo. Billing, pagamentos, auth, multi-restaurante e autorização entram na matriz funcional. Referências Supabase/Vercel antigas não devem substituir a arquitetura atual por simples merge histórico.

## Procedimento final

1. Preservar alterações locais do usuário e registrar os SHAs de recuperação dos dois repositórios. Atualizar refs remotas na hora da integração e conferir PRs/checks reais; este snapshot não certifica estado remoto.
2. Criar matriz **funcionalidade → commits/branch → implementação atual → testes → decisão**. Comparar ancestralidade e equivalência de patches (`merge-base`, `log --left-right --cherry-pick`, diffs). Identificar trabalho útil exclusivo antes de escolher merge ou cherry-pick; não juntar todas as branches cegamente.
3. Consolidar nas branches candidatas, mantendo compatibilidade API/frontend e migrações versionadas. Resolver conflitos por comportamento desejado, não por preferência automática de um lado. Conferir especialmente `multitenant-v2`/membership e billing em conjunto com o fluxo atual.
4. Executar testes, builds, checagem TypeScript real do app, revisão final e preview **pareado**. O comando antigo de typecheck do frontend não verifica sozinho o projeto referenciado; seus diagnósticos existentes precisam de resolução antes de declarar esse gate verde.
5. Validar catálogo, imagens, pedidos local/delivery, cozinha/caixa, auth, isolamento de tenants e billing Test, sem ativar Stripe Live. Flags permanecem desligadas até bootstrap e gates aprovados. Reader e writer precisam de controles independentes para rollback seguro.
6. Com os gates satisfeitos e a integração autorizada, integrar os dois PRs/mains em ordem compatível: API compatível antes do frontend consumidor, flags ativadas por etapa. Merge/push e publicação são operações distintas: conferir o artefato/SHA efetivamente publicado em cada ambiente.
7. Rodar smoke e observar estabilidade/consumo. Em falha, reverter reader/frontend sem interromper o processamento de operações já aceitas; manter versões compatíveis para rollback da API. Não apagar namespaces/buckets/journal para simular rollback.
8. Somente após estabilidade, backup e zero dependências, encerrar serviços antigos. Arquivar branches/worktrees apenas depois de comprovar que trabalho útil e alterações locais foram preservados; não apagar checkouts antigos automaticamente.

Resultado esperado: todas as funcionalidades **válidas e pretendidas** reconciliadas nos dois históricos principais e verificadas no produto, com exceções explícitas. Nenhuma promessa de que “todas as branches entram” por um único push.
