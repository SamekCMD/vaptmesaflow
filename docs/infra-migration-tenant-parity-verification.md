# Paridade tenant — verificação pareada local

22/10/2026. Execução do [plano de 16 tarefas](superpowers/plans/2026-10-19-tenant-parity-restoration.md), conforme a [especificação aprovada](superpowers/specs/2026-10-19-tenant-parity-restoration-design.md). **16/16 tarefas locais concluídas; revisão independente realizada e dois achados importantes corrigidos/testados na passagem única. Não é aprovação de merge, deploy, SQL remoto ou ativação.**

## Manifesto funcional

| Componente | Checkout usado | Base deste plano | Último checkpoint funcional |
| --- | --- | --- | --- |
| F: frontend e migrations | `D:/Projetos/vaptmesaflow` | `0cb286d` | `9f67679` |
| A: API, outro repositório | `D:/Projetos/vaptmesaflow/.worktrees/vapt-api-infra-foundation` | `ab24eb0` | `7d5604f` |
| B: consumidor de billing, versionado em F | `infra/cloudflare/billing-email-worker` | base F | `be66c15`, preservado nos checkpoints seguintes |

As alterações/testes de reconciliação da tarefa16 foram registrados em F `960cedf` e A `031e5ec`; o helper da tarefa16 confirmou F376/376 antes da revisão. A passagem única posterior está nos checkpoints funcionais F `9f67679` / A `7d5604f`, com F383/383, A701/701, PG92/92 e workerd30/30. As duas candidatas continuam em `codex/infra-foundation`. Não houve criação de worktree, fetch, checkout, cherry-pick, merge ou push nesta execução. Main F permanece `9b576c1`; main A, `cebaed4`. A lista completa das refs e os WIPs preservados ficam na [reconciliação](infra-migration-branch-reconciliation.md); as decisões e checkpoints, no [registro durável](infra-migration-tenant-parity-decisions.md).

## Aceites P01–P10

As referências abaixo apontam para arquivos reais nos dois checkouts. Cobertura composta não é um teste de serviços remotos: frontend usa HTTP sintético; PostgreSQL e SQLite são reais e descartáveis; R2/provedores são adaptadores controlados; workerd roda localmente.

| Aceite | Implementação / commits principais | Evidência local |
| --- | --- | --- |
| P01 organizações e quatro papéis | F `1f4270f`, A `fccae97`/`e7f8182`; `infra/neon/010_tenant_foundation.sql`, A `src/modules/tenancy/` | schema/authorization/restaurant-scope PostgreSQL; invited/disabled/unknown/cross-org negados, sem owner como bypass |
| P02 bootstrap, preferência, seleção | F `986f8cc`/`a38f04a`/`182f76e`, A `72790c7`/`afcb5ed`; `src/features/auth/`, `src/features/restaurants/` | account-onboarding PostgreSQL; account-bootstrap, restaurant-switcher e tenant-routing frontend; duas abas com seleções distintas |
| P03 limites 1/1/25 e trial1 | migration010 e criação restrita012; A authorization/onboarding | concorrência no último slot, drafts contam, downgrade não apaga dados; smoke integrado atinge25 e nega26; trial de3dias inicia uma vez |
| P04 billing SaaS por organização | F `cdb55bc`/`be66c15`, A `09a6463`/`5625109`; migration011, Stripe repository/webhook e B outbox | organização compartilha Customer/Subscription; identidade histórica imutável, claim/retry, request de email congelado e três testes reais do consumidor no gate PG; nenhuma chamada Stripe/Resend |
| P05 onboarding retomável | F `ab1ee96`, A `72790c7`/`81310cd`, migration012 | três etapas, reload com novo QueryClient, primeiro prato/logo opcionais, save falho não avança, rollback e repetição não iniciam outro trial nem revisão de catálogo |
| P06 ativação por restaurante | F `ab1ee96`, A onboarding/012 | progresso compartilhado no servidor; concluir CaixaA não conclui menuA/B; localStorage global ignorado; navegação só após confirmação |
| P07 logo persistente e quota única | F `0afad5a`, A `fd7a6fd`; `src/lib/restaurant-assets.ts`, A image-budget/service | URL R2 verificada, nunca blob persistido; JPEG/PNG/WebP até5MiB, saída até1MiB/1200px; WebP preferido com fallback alpha;100MiB total, lease/bytes estáveis, upgrade SQLite preserva fences; referências retidas/pending impedem retirada |
| P08 slug pontual | F `0c94394`, A `986e4c4` | blur/presave sem polling; manager autorizado/staff negado; resposta antiga não valida novo valor/tenant;409 inline conserva edição; banco decide corrida; cabeçalho/seletor atualizados só após confirmação, sem refetch extra |
| P09 isolamento de estado | F `a38f04a`/`182f76e`/`4c1d36b`; contexto e continuação por identidade/organização/restaurante | leitura/save/arquivo/provider/payment/billing A tardios não afetam B; modal preserva estado da mesma sessão; logout limpa cache privado e sockets sem apagar carrinho público |
| P10 fronteiras privilegiadas | A `5a43925`/`b40c8c9`/`c834c23`/`79a8028`; locks comuns, applier, OAuth, manual e realtime | rota+serviço+transação; membership revogada nega novo apply/leitura privada, mas projeção pública aceita recupera; staff opera sem billing.read; revalidação realtime em lote sem SQL por ping |

O smoke adicional A `src/modules/tenancy/parity.pg-integration.ts` une duas organizações,25 restaurantes Business, quatro papéis, draft/finalização, catálogo público, pedidos local/delivery, cozinha, caixa, pagamento manual, rename e dedup SaaS/email. O smoke F `src/test/tenant-parity.test.tsx` une retomada→ativação→troca explícita→saída da UI autenticada. Auth/signup/reset e OAuth com fakes, R2/leases e crashes entre commit/projeção continuam nos respectivos testes especializados; não se simula um único teste end-to-end de cloud.

## Verificação final

Gates completos finais, após a passagem de correção, com saída lida: F383/383; A701/701; PostgreSQL92/92 sem skips; workerd30/30; guards frontend18/18; configuração de catálogo69/69; scripts179/179. Builds/typechecks exit0; lint sem erros e um aviso preexistente em TableSessionModal. B isolado48pass/3skip; os três casos exigem PG e executaram sem skip no harness completo. A revisão independente identificou dois Important e nenhum Critical/Minor; ambos foram reproduzidos e corrigidos em uma passagem, sem re-revisão. [Parecer e tratamento](infra-migration-tenant-parity-review.md).

Comandos finais obrigatórios: F `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:production-deploy`; B `npm test`, `npm run typecheck`; A `npm test`, `npm run build`, `npm run test:worker`, `npm run test:tenant-pg`, `npm run test:catalog-config`, `node --test scripts/*.test.mjs`. Testes de scripts usam portas falsas; nenhum `apply` ou deploy foi executado. O selector de PG `--only=parity` serve apenas à iteração, nunca substitui o gate completo.

## Preservação e limites

- Mantidos Better Auth próprio, cookies verificados, pg/Hyperdrive/Neon, R2, Stripe Checkout/Portal e realtime/eventos. Nenhuma reintrodução de Supabase/JWKS/n8n/Redis, Vercel ou Easypanel.
- Não foi comprovada uma UI histórica completa de convites/gestão de equipe. A entrega restaura os papéis/memberships e suas capabilities, não inventa um sistema de convites nem declara essa UI pronta.
- As famílias antigas divergentes foram reconciliadas por comportamento. Não se promete importar todos os commits: auth SMTP/JWKS e infraestrutura substituída não devem voltar. Três patches equivalentes não são duplicados.
- Preservados documentos financeiros/main-plan e `docs/implementation-references/`, WIPs de outras sessões e registros antigos de worktrees C:. Nenhum deles foi removido, movido ou incorporado silenciosamente.
- Os operadores futuros agora usam restaurante explícito, draft canônico e organizações sintéticas; os SQLs de seed/cleanup de preview/production foram ensaiados em PG local. Isso não executou fixtures remotas nem certificou identidade/ACL/bindings reais. O cleanup externo do smoke Preview deve reconhecer `organizationId` e comprovar resíduo zero antes de autorizar uma execução.
- Orçamento continua confortável US$10–15 e limite pessoal US$20; nenhum serviço/plano foi contratado. Limites técnicos não garantem teto de fatura. Workers Paid já estava ativo; não contratar de novo.

## Integração futura — não executada

1. Usar os SHAs F/A/B pareados e o parecer/correções locais; revisar os WIPs separadamente. Preparar PRs/merge por repositório só após autorização, sem cherry-pick integral das famílias antigas.
2. Capacidade revalidada posteriormente22/10: upgrade Launch realizado pelo usuário, cota conjunta60CU-h e ambos os endpoints0,25CU aprovados/aplicados com readback; SQL READ ONLY conectou nos dois ambientes. [Checkpoint atual e limites](infra-migration-promotion-readiness-2026-10-22.md); não criar projeto substituto nem presumir teto global de cobrança.
3. Backup/restauração ensaiados; conferir baseline001–008. O readback posterior22/10 não encontrou objetos009 nem010–012 nos dois ambientes: aplicar009 original e grants antes de010–012, na ordem e sob gate próprio, primeiro preview. Não editar históricos nem usar o baseline Supabase.
4. Bloquear admissões incompatíveis e pausar consumidores antigos; drenar claims/comandos duráveis, sem apagar journal, namespace, leases ou assets para simular rollback. Um webhook ainda não aceito deve continuar retentável.
5. Promover API e consumidor canônicos com schema/grants compatíveis; depois frontend pareado. Readback de roles, Hyperdrive, bindings, CPU, secrets, CORS/cookies e flags por ambiente, sem imprimir credenciais.
6. Smoke negativo e sintético por ambiente, limpeza verificada; reader/writer continuam false até os gates próprios5/9/10 do catálogo. Bootstrap usa alvo explícito e nunca habilita reader automaticamente.
7. Rollback de código apenas para uma versão compatível com o schema tenant e os comandos já aceitos. **Nunca retornar a owner-only após dados multi-tenant.** Manter drain/recuperação da projeção pública e os requests de email congelados.
8. Só depois retomar as etapas principais14–19: observação de estabilidade/consumo, backup final, dependência zero e cancelamento da Hetzner autorizado. Workers Paid já ativo; Vercel é legado e DNS já migrado não será refeito. Easypanel não existe.

Conclusão: restauração local e passagem de correção encerradas com as evidências acima; promoção remota, integração em main e gates de estabilidade/consumo **não realizados**. A revisão não certifica o ambiente implantado.
