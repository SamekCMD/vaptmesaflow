# Consolidação da migração — situação e integração

Atualização24/10: [canários de publicação/leitura encerrados](infra-migration-catalog-reader-canary-2026-10-24.md), Preview36 fechado/CPU1000 e produção intacta. [Bootstrap atual sem carga](infra-migration-catalog-bootstrap-readiness-2026-10-24.md): preview0restaurantes/itens/journal/revisions e produção0restaurantes nos agregados conferidos; não criar dados sintéticos só para migrar UUIDs. Produção ainda sem seis tabelas-marcadoras canônicas; próximo gate é backup/restauração e promoção pareada de schema/API/B/F, não merge ou publicação automática. Nenhum PR/push/main foi alterado nesta conferência; histórico opção2 abaixo permanece válido.

## Continuação22/10 — opção2 executada

Os PRs canônicos [frontend#4](https://github.com/SamekCMD/vaptmesaflow/pull/4) e [API#1](https://github.com/SamekCMD/vapt-api/pull/1) receberam F`a4eb545`/A`7d5604f`; CI de push e PR aprovado nos dois SHAs. Billing#3 foi encerrado como incorporado e Vercel Analytics#2 como legado, ambos sem merge e com branches/worktrees preservados. Main continua F`9b576c1`/A`cebaed4`; não houve publicação por esta opção. Histórico dos PRs preservado em seção própria, sem novos PRs sobrepostos.

Retomada local do plano: reconciliados inventário de writers e receita de bootstrap com o código tenant. [Readiness e evidências](infra-migration-promotion-readiness-2026-10-22.md) separa gates locais já cumpridos dos remotos ainda bloqueados. Atualizar documentos/PR não substitui liberar capacidade do Neon, validar schema/grants/CPU/writers implantados ou autorizar promoção. Não reiniciar a restauração de paridade já encerrada.

## Atualização22/10 — paridade antes da integração

Tarefas1–16 do plano de paridade foram implementadas e verificadas nos dois repositórios, incluindo multi-restaurante/equipe, billing por organização, onboarding retomável, ativação, logoR2/quota compartilhada e slug pontual. A revisão independente encontrou dois Important (privacidade do DTO operacional e retorno de provedores); ambos foram corrigidos com regressões RED→GREEN e suítes completas. [Manifesto pareado, matrizP01–P10, resultados e procedimento de promoção](infra-migration-tenant-parity-verification.md).

Não é preciso recriar o código em production: a promoção futura usa os artefatos F/A/B pareados e aplica schema/grants/bindings apropriados. Entretanto, um push de frontend não publica a API do outro repositório nem incorpora automaticamente WIPs de branches divergentes. Integração será seletiva por comportamento, preservando alterações alheias e sem reintroduzir infra substituída. Main/merge/push/deploy não foram executados.

O plano principal segue na Etapa13; estabilidade/backup/desligamento/cancelamento continuam gates posteriores. Não há novo readback remoto de capacidade; o diagnóstico18/10 continua apenas a última evidência conhecida. Os números abaixo são checkpoints históricos, não os resultados atuais da paridade.

Checkpoint local: 17/10/2026. Este documento organiza a execução já aprovada; não autoriza merge, push, deploy, nova contratação ou cancelamento de serviço. Referências: [plano principal](infra-migration-plan.md), [plano do catálogo](infra-migration-public-catalog-event-driven-plan.md) e [inventário de writers](infra-migration-public-catalog-writers.md).

## Quanto falta

Atualização18/10: os seis problemas importantes da revisão do catálogo foram corrigidos/testados na passagem única local, incluindo retry da mesma lease e reconciliação manual segura de imagens abandonadas. Frontend313/313, API670/670, PostgreSQL11/11 e workerd29/29; typecheck/builds aprovados, lint frontend sem erros/quatro avisos anteriores. [Parecer, decisões e alcance](infra-migration-public-catalog-review.md). Não é aprovação de merge/ativação nem revisão das demais funcionalidades históricas; os gates remotos de5/9/10 continuam abertos.

O plano principal continua na **Etapa 13**, consolidação/validação do destino. Não é necessário recriar em production todas as funcionalidades desenvolvidas em preview: o código é compartilhado, mas bindings, credenciais, dados e gates são próprios de cada ambiente.

Avanço remoto autorizado18/10: Preview existente recebeu preparação inerte do catálogo (namespace SQLite, binding privado e CPU configurada1000ms conferidos), com reader/writerfalse. Deployments de produção/frontend e top-level paralelo não mudaram. Não houve SQL/schema, bootstrap, flags, secrets ou plano novo. [Rollout e limites](infra-migration-public-catalog-rollout.md). Isso avança a tarefa9 sem encerrá-la: faltam workload/CPU real e demais gates de5/9/10; total7/10, sem merge/push/main automático.

O desvio de redução de consultas tem dez tarefas. No início desta continuação, cinco estavam formalmente concluídas localmente (1, 3, 4, 6 e 7); 2, 5 e 8 tinham implementação parcial, e 9/10 ainda não estavam encerradas. Isso não representa percentual de migração concluída nem redução financeira já medida. O checkpoint atualizado fica no inventário de writers.

Atualização desta continuação: **7/10 concluídas localmente**, incluindo a tarefa2, validada em PostgreSQL18.6 real e descartável: dez testes no checkpoint mais recente (incluindo corridas imagem/SQL), ambos os grants009 aplicados sem edição, sem Neon ou serviço Windows. API663/663 e build aprovados. As três ainda abertas são5(cobertura dos writers ativos),9(gates finais de runtime/deploy/CPU) e10(bootstrap/ativação controlada). A tarefa9 avançou com293 testes frontend,29 workerd,51 guards/operador API e18 guards frontend aprovados nos checkpoints anteriores, mas não está encerrada. Em17/10, após autorização separada, os dois buckets privados de catálogo foram criados e conferidos: r2.dev desativado, nenhum custom domain e vazios no readback. Imagens não foram alteradas; bindings/namespace e ativação continuam pendentes. Nenhum número significa produção já ativada.

Restam como gates do desvio: validação final de runtime, CPU, deploy/rollback e revalidação da privacidade no cutover; bootstrap controlado; comprovação de que os writers ativos usam o protocolo; revisão final e ativação controlada. A prova PostgreSQL local do journal e o readback inicial dos buckets privados estão concluídos, sem certificar Hyperdrive, permissões remotas ou bindings implantados. Integração local das telas/imagens foi concluída na tarefa8. Testes locais não substituem os gates remotos.

Qualidade frontend revalidada em17/10: comando de typecheck corrigido para verificar app e node/Vite, ambos exit0;293/293 testes, build local e18/18 guards aprovados. Lint geral agora exit0 com zero erros e quatro avisos de hooks anteriores, ainda sujeitos à revisão. [Diagnóstico e evidências](infra-migration-public-catalog-frontend-verification.md). Substitui o gate vermelho de tipos/erros de lint dos checkpoints anteriores; não certifica CI remoto ou implantação.

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

Continuação19/10: usuário aprovou seguir com a abordagem de restauração seletiva e confirmou continuar após receber a [especificação de paridade](superpowers/specs/2026-10-19-tenant-parity-restoration-design.md). O [plano com16tarefas](superpowers/plans/2026-10-19-tenant-parity-restoration.md) foi preparado para revisão, com execução direta preservada; não há implementação nova ou aprovação de schema/deploy/main. Múltiplos restaurantes e equipe continuam gates de integração, junto com as demais lacunas da auditoria.

Conferência posterior18/10: [matriz de reconciliação local](infra-migration-branch-reconciliation.md) registra ancestralidade, três pares de patches equivalentes que não precisam ser reaplicados, famílias divergentes sobrepostas e alterações não commitadas em outros worktrees. O usuário confirmou que multi-restaurante/membership é requisito existente a preservar, não uma decisão nova ou redução de escopo aprovada. O contrato atual de um restaurante por dono ainda precisa ser corrigido. A [auditoria funcional](infra-migration-functional-parity-audit-2026-10-18.md) registra outras lacunas de onboarding, ativação, assinatura e marca; não representa correção implementada nem certificação de paridade completa. Não integrar/descartar branches ou prometer cobertura total antes dessa reconciliação. [Readback Neon](infra-migration-capacity-readback-2026-10-18.md): Free,114,81CU-h neste ciclo até1Nov, sem evidência de capacidade restaurada; nenhum SQL/upgrade executado.

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
4. Executar testes, builds, checagem TypeScript real do app, revisão final e preview **pareado**. `npm run typecheck` agora verifica explicitamente app e node/Vite; os21 diagnósticos anteriores foram resolvidos localmente, sem casts de sessão. Repetir a verificação sobre o estado final consolidado; isso não substitui revisão, preview ou CI remoto.
5. Validar catálogo, imagens, pedidos local/delivery, cozinha/caixa, auth, isolamento de tenants e billing Test, sem ativar Stripe Live. Flags permanecem desligadas até bootstrap e gates aprovados. Reader e writer precisam de controles independentes para rollback seguro.
6. Com os gates satisfeitos e a integração autorizada, integrar os dois PRs/mains em ordem compatível: API compatível antes do frontend consumidor, flags ativadas por etapa. Merge/push e publicação são operações distintas: conferir o artefato/SHA efetivamente publicado em cada ambiente.
7. Rodar smoke e observar estabilidade/consumo. Em falha, reverter reader/frontend sem interromper o processamento de operações já aceitas; manter versões compatíveis para rollback da API. Não apagar namespaces/buckets/journal para simular rollback.
8. Somente após estabilidade, backup e zero dependências, encerrar serviços antigos. Arquivar branches/worktrees apenas depois de comprovar que trabalho útil e alterações locais foram preservados; não apagar checkouts antigos automaticamente.

Resultado esperado: todas as funcionalidades **válidas e pretendidas** reconciliadas nos dois históricos principais e verificadas no produto, com exceções explícitas. Nenhuma promessa de que “todas as branches entram” por um único push.
