# Public Catalog by Event Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Atualizar os cardápios local e delivery por evento, eliminando polling de catálogo e leituras Postgres nas visitas com projeção publicada.

**Architecture:** Postgres continua transacional; um comando SQLite durável precede a mutação e um journal SQL permite retomá-la sem duplicação. `PublicCatalogCoordinator` publica DTOs versionados no R2 e sinaliza por WebSocket público hibernável, separado dos pedidos. Um controlador frontend compartilha leitura por recurso e não consulta catálogo periodicamente.

**Tech Stack:** TypeScript, React18/Vite/Vitest, Hono, node-postgres/Hyperdrive, Cloudflare Workers/SQLite Durable Objects/R2; testes API com node:test/tsx e workerd existente. Sem biblioteca de fila, Redis, CDC ou novo driver.

**Spec:** [desenho aprovado](D:/Projetos/vaptmesaflow/docs/infra-migration-public-catalog-event-driven-design.md). Ler também a [pesquisa](D:/Projetos/vaptmesaflow/docs/infra-migration-query-reduction-research-2026-10-15.md).

## Global Constraints

- Escopo: somente catálogo público e seus writers. Pedidos, autenticação existente, realtime privado, pagamento e Cron billing30min conservam comportamento.
- Meta:0SQL de catálogo por visita/evento de versão/heartbeat com projeção pronta;0SQL de recuperação sem comandos pendentes;0GET periódico de catálogo em aba estável.
- Até10 tentativas automáticas por fase; espaçamento mínimo5s e máximo300s; máximo100 intenções pendentes por restaurante; uma aplicação SQL por vez.
- Preservar limite HTTP atual1MiB e limites existentes dos schemas; snapshot8MiB serializados; frames públicos até512bytes; máximo200 sockets por restaurante.
- Intenção privada no máximo24h, inclusive blocked; metadata de deduplicação/resultados até7dias; retenção lógica SQL7dias, limpeza oportunística sem Cron vazio.
- Heartbeat60s/deadline10s, auto-response sem timerJS noDO; reconexão1–60s, até5 tentativas consecutivas; sem fallback4/8/30/60s de catálogo.
- Versão monotônica Postgres como string decimal; não relógio/socketsequence. Apenas DTO público nos snapshots/frames, nunca DTO administrativo.
- Leitura externa no-store; nenhuma ativação global de Workers Cache. Manter somente revisão atual e uma anterior; não apagar objeto referenciado.
- Flags de writer/projeção e reader desligadas por padrão. Rollback do reader não interrompe trabalho já aceito pelo writer.
- Reutilizar recursos existentes e driver; novo namespace apenas no gate remoto. CPU atual1000ms não será ampliada automaticamente.
- Neon Free está sem capacidade no último readback: não executar SQL remoto nem contratar Paid para destravar testes. Nenhuma garantia de teto global US$20; confortoUS$10–15 não é limite técnico.
- Sem main/merge/push, DNS, secrets, coleta de logs reprovada, StripeLive, ZeroTrust pago ou aposentadoria de Hetzner nesta execução por inferência.

## Review Focus

- Retry de onboarding depois de resposta perdida: mesmo restaurante/primeiro item e mesma operação, mesmo antes de existir journal SQL — testeT1/T2/T4.
- Versão acima de Number.MAX_SAFE_INTEGER: comparação e serialização sem arredondamento — testeT1/T7.
- Sessão revogada enquanto o comando espera: rejeitar antes do commit; depois dele, publicar sem exigir credenciais retidas — testeT2/T4.
- Exclusão de imagem ainda referenciada pelo snapshot: fluxo não deve quebrar catálogo publicado por limpeza antecipada — testeT5/T8.
- Canal desligado ou mudança de slug durante fetch: não manter pedidos/carrinho com estado de navegação de outro restaurante — testeT7/T8.

## Workspace e sequência

Execução **direta/inline**, já escolhida pelo usuário. Não criar agentes por tarefa nem novo worktree emC:. Usar `superpowers:executing-plans`, TDD e verificação antes de conclusão; ler instruções aplicáveis antes de implementar.

- **F** = `D:/Projetos/vaptmesaflow` (frontend + SQL e docs de infra).
- **A** = `D:/Projetos/vaptmesaflow/.worktrees/vapt-api-infra-foundation` (API existente).
- Caminhos nas tarefas são relativos à raiz indicada; nunca adicionar `.worktrees/` ao GitF. Commits separados por repositório e apenas dos arquivos da tarefa. Não usar `git add .`.
- Reutilizar branches `codex/infra-foundation`. Preflight: status/diff de ambos; preservar alterações financeiras e `docs/implementation-references/` fora destes commits.
- Localização canônica em `docs/`: `docs/superpowers/` é ignorado explicitamente. Não alterar ignore nem forçar inclusão.
- Dependências:T1→T2/T3→T4→T5/T6→T7/T8→T9→T10. Não ativar uma peça isolada remotamente.
- Cada tarefa termina com testes relevantes e commit local de escopo explícito, mensagem indicada. O plancheck não é prova de execução: checkboxes ficam vazios até evidência real.

## Mapa de arquivos e interfaces

| Raiz/arquivo | Responsabilidade |
| --- | --- |
| A `src/modules/catalog-publication/contracts.ts`, `policy.ts` | Comandos, recibos, versões, limites e classificação de campos públicos |
| A `src/modules/catalog-publication/transaction.ts`, `journal.ts` | Aplicação idempotente e snapshot no mesmo commit; recuperação SQL |
| A `src/modules/catalog/repository.ts`; `src/modules/menu/repository.ts`; `src/modules/restaurants/repository.ts` | Extrair operações que aceitam Queryable transacional, sem transações aninhadas |
| A `src/worker/catalog/projection.ts`, `command-store.ts`, `coordinator.ts` | R2/CAS; estado SQLite/alarme; executor RPC e socket hibernável |
| A `src/worker/catalog/admission.ts`, `writer.ts`; `src/worker/routes/catalog.ts` | Políticas públicas e admissão autenticada, rotas de estado/retry/upgrade |
| A `src/worker/environment.ts`, `http.ts`, `app.ts`, `realtime-entry.ts` | Tipos/flags, identidade verificada do comando e registro sem inicializar serviços no GET público |
| F `infra/neon/009_public_catalog_publication.sql`, `009_worker_preview_catalog_grants.sql`, `009_worker_production_catalog_grants.sql`, `verify-public-catalog-publication.sql` | Journal, revisão, grants mínimos e verificações versionados |
| F `src/lib/catalog/{contracts,client,controller}.ts`; `src/hooks/use-public-catalog.ts` | Estado versionado, transporte público e lifecycle compartilhado |
| F `src/lib/catalog-mutations.ts`; `src/lib/menu-items.ts`, `restaurants.ts` | Recibo/idempotência opt-in e consulta manual de publicação |
| F `src/components/menu/CatalogPublicationStatus.tsx`; páginas existentes | Feedback de gravação/publicação e integração sem redesenho visual |
| A `src/worker/catalog.workerd.ts`, `catalog-test-fixture.ts`; `wrangler.worker-catalog-test.jsonc` | R2/SQLite/WebSocket reais locais com SQL instrumentado/injetado |
| A `scripts/verify-catalog-config.mjs`, `scripts/catalog-operator.mjs`, `scripts/bootstrap-public-catalog.ts` | Guard de rollout, operador offline/build sem deploy e bootstrap administrativo controlado |
| F `docs/infra-migration-public-catalog-writers.md`, `docs/infra-migration-public-catalog-rollout.md` | Inventário fechado de writers, gates e rollback |

Novos arquivos menores por responsabilidade, sem remodelar módulos privados. Tests `.test.ts` ao lado dos módulos API; React/controller em `src/test/`. A tarefa que introduz uma dependência define seu tipo concreto e o exporta; não introduzir interfaces sem consumidor.

### Task 1: Contrato público e protocolo de comandos

**Files:** A create `src/modules/catalog-publication/{contracts,policy,contracts.test}.ts`; F create `src/lib/catalog/contracts.ts`, `src/test/catalog-contracts.test.ts`.

**Interfaces:** `CatalogVersion = string` decimal positiva canônica; `CatalogState = {version: CatalogVersion; catalog: PublicCatalogDto}`. `CatalogActor = {userId: string; sessionId: string; sessionExpiresAt: number}`. `CatalogCommand = {operationId: string; restaurantId: string; actor: CatalogActor; mutation: CatalogMutation}`; union `onboarding | restaurant.patch | item.create | item.patch | item.delete | rebuild`, com inputs derivados dos schemas existentes e itemId onde aplicável. `CommandReceipt = {operationId; restaurantId; phase: accepted|committed|projected|ready|blocked; version: string|null; committed: boolean; retryable: boolean}`; tipos iguais em ambos os repositórios por fixtures de contrato, sem pacote compartilhado novo. `CommandOutcome<T> = {receipt: CommandReceipt; result?: T}` é somente autenticado.

Definir também `CommandIdentity = {operationId: string; restaurantId: string; actor: CatalogActor; fingerprint: string}`. Identidade estável do ator para dedup é userId; fingerprint exclui sessionId/expiry para permitir retry da mesma ação depois de renovar sessão. A sessão apresentada em cada nova aplicação/retry é revalidada; não transforma sessão revogada em autoridade. Teste `renewedSessionSameOperation` fixa essas duas condições. Ruling na execuçãoT5: o UUID de onboarding é estável por owner (operationId continua validado e identifica a ação), impedindo salas ilimitadas por troca de chave; nenhum ID existente é alterado.

- [x] Escrever testes `canonicalVersion`, `publicFieldsOnly`, `deterministicOnboardingId`, `mutationFingerprint`: `compareVersion("9007199254740993","9007199254740992") === 1`; rejeitar negativos, expoentes e zeros à esquerda; fingerprint igual para ordem diferente de propriedades de objeto, diferente para ator/payload/operação diferentes. Mesma combinação ator+operationId pré-aloca mesmoUUID, sem UUID fornecido pelo visitante.
- [x] Rodar A `npx tsx --test src/modules/catalog-publication/contracts.test.ts` e F `npm test -- src/test/catalog-contracts.test.ts`; esperar falha por exports ausentes, não ambiente/credencial.
- [x] Implementar `compareVersion(a,b): -1|0|1`, `fingerprintCommand(command): Promise<string>`, `allocateOnboardingRestaurantId(userId,operationId): Promise<string>`, `affectsPublicCatalog(patch): boolean`. Usar BigInt para comparar; hash SHA256 canônico, arrays preservam ordem; UUID derivado no servidor de domínio fixo+ator+operação, bits de UUID válidos, salvo na intenção. Este ID é endereço, não autorização. Allowlist pública igual ao PublicRestaurantDto, excluindo updatedAt isolado, CNPJ e billing. Frames `{protocol:"vapt.catalog.v1",type:"ready"|"catalog_changed",version,canonicalSlug?}`; ping/pong são strings estáticas separadas.
- [x] Reexecutar ambos e conferir limites compartilhados contra spec. Testar patch misto classificado público e private-only sem revisão pública.
- [x] Commit local A/F: `feat: define public catalog publication contracts`, somente novos contratos e testes.

### Task 2: Transação idempotente e journal SQL

Checkpoint17/10: integração PostgreSQL18.6 real em cluster descartável loopback, sete testes aprovados; rollback, concorrência, slugs, revogação durante lock, tamanho UTF8 e retenção limitada. Ambos os grants009 aplicados sem edição em outra base do mesmo cluster local, com DDL/UPDATE do journal/reset da sequência negados. Nenhuma consulta Neon/migração remota ou serviço Windows. Evidência detalhada em A `docs/public-catalog-postgresql-verification.md`; os gates remotos, CPU e writers permanecem independentes.

**Files:** F create os quatro SQLs009/verify do mapa; A create `src/modules/catalog-publication/{journal,transaction,transaction.test}.ts`; modify repositories de menu/restaurants/catalog; create `src/modules/catalog-publication/transaction.pg-integration.ts`.

**Interfaces:** `applyCatalogCommand(database: Database, command: CatalogCommand): Promise<CommittedCommand>`; `CommittedCommand = {receipt: CommandReceipt; result: unknown; state: CatalogState; previousSlug: string|null}`. `findCommittedCommand(database: Database, identity: CommandIdentity): Promise<CommittedCommand|null>` usa T1. `buildPublicCatalog(queryable: Queryable, restaurantId: string): Promise<PublicCatalogDto>` lê na mesma transação. Helpers de mutação recebem Queryable, ator/input e ID pré-alocado; wrappers legados continuam usando as transações existentes.

- [x] Testes `atomicJournalAndDomain`, `duplicateCreateDeleteAndOnboarding`, `revocationBeforeApply`, `publishAfterRevocation`, `oversizeRollback`, `slugSerialization`: sem journal em rollback; dois retries retornam mesmo item; sessão expirada/deletada bloqueia antes de mutar; resultado committed pode ser recuperado depois; bytesUTF8 >8MiB rollback; revisões crescem inclusive rename/reuso de slug concorrentes. Snapshot/result não vêm de conexões independentes. Asserções `domainWrites === 1`, `snapshotBytes <= 8_388_608`, `commits === 0` no oversize.
- [x] Rodar A `npx tsx --test src/modules/catalog-publication/transaction.test.ts`; esperar testes novos falhando. IntegraçãoPG separada e obrigatória para o gate, nunca substituída por mocks.
- [x] Implementar tabela `public.catalog_publication_operations` com unique(actor_id,operation_id), fingerprint, restaurant_id, versão, snapshot/resultado autorizado, slugs e committed_at/expires_at; tabela `public.catalog_publication_revisions` por restaurante e sequence bigint global para fencing entre donos de slug. Locks transacionais ordenados por owner/restaurante/slugs antes de nextval; após locks, reler slugs/ownership e verificar sessão BetterAuth por id/userId/expiry sob row lock compatível com exclusão da sessão. Depois aplicar domínio+journal+snapshot atomicamente. Chave conflitante retorna409; retenção lógica7dias. Resultado não guarda token/cookie. Nova operação após7dias não herda dedup antiga; snapshot committed ainda pendente precisa estar durável no DO antes da expiração SQL (T4).
- [x] Testar helpers legados sem duplaBEGIN; excluir item vira transacional neste fluxo. LimpezaSQL de operações expiradas limitada a100 linhas por aplicação real, sem Cron. Grants para as duas roles: somente tabelas/sequence necessários, sem DDL/admin. Integração usa somente `CATALOG_TEST_DATABASE_URL` loopback explícita e fixture descartável identificada; script recusa URL remota/ausente, não usa DATABASE_URL implicitamente. Com PG local disponível, rodar `npx tsx --test src/modules/catalog-publication/transaction.pg-integration.ts`; se ausente, registrar gatePG bloqueado e seguir testes puros, nunca marcar integração como verde nem conectar Neon esgotado.
- [x] Commit local A `feat: journal catalog mutations atomically`; F `feat: version catalog publication schema and grants`; incluir testes eSQL explícitos. Não aplicar migração remota.

### Task 3: Projeção R2 com fencing e roteamento de slugs

**Files:** A create `src/worker/catalog/{projection,projection.test}.ts`; modify `src/worker/environment.ts` para tipo de bindingR2 com métodos get/head/put/list/delete reais sem enfraquecer o gateway de imagens.

**Interfaces:** `CatalogProjection` com `publish(committed: CommittedCommand): Promise<CatalogState>`, `readBySlug(slug): Promise<CatalogState>`, `readRegistration(restaurantId): Promise<{version; canonicalSlug}>`, `prune(restaurantId, cursor?): Promise<{cursor?: string}>`. Erros tipados unknown404/pending503/storage503. `createCatalogProjection(bucket, environment): CatalogProjection`. Prefixo `catalog/v1/{environment}/`; snapshots`restaurants/{id}/snapshots/{version}.json`, manifest`restaurants/{id}/manifest.json`, slugs`slugs/{slug}.json`.

- [x] Testes `snapshotBeforeManifest`, `latePutCannotRegress`, `slugReuseFenced`, `partialManifestIs503`, `pruneKeepsReferenced`: ordem observável objeto→slug→manifest ready; versão12 nunca vira11; tombstoneA não remove novoB; timeout/404 com PUT antigo em voo não prova falha; DTO não inclui CNPJ/sessionId/email. Erros não viram200 nem cache de sucesso.
- [x] Rodar A `npx tsx --test src/worker/catalog/projection.test.ts`; falha esperada por adapter ausente.
- [x] Implementar objetos imutáveis create-once e manifests com ETagCAS; após412 reler e comparar revisão/identidade, nunca escrever incondicionalmente. Slugtombstone também é escritaCAS, não delete cego. Leitor cruza slug+manifest: só retorna o mesmo restaurante/slug/revisão pronta; estado transitório retorna503, não catálogo de outro dono. Snapshot8MiB é envelope completoCatalogState em bytesUTF8; private-only nunca chega aqui. Nenhum acesso via r2.dev, SQL ou cache de manifest.
- [x] Reexecutar testes incluindo objetos com JSON inválido/truncado e isolamento preview/production. Limpeza só após ready, mantém atual+anterior; não usa lifecycle cego sobre snapshots referenciados. Falhas/ambiguidade de limpeza entram no estado de trabalho localT4 para reconciliação limitada, não loopSQL. Cache interno imutável é opcional: iniciar sem ele; não criar cache global para provar a meta0SQL.
- [x] Commit A `feat: project versioned public catalogs to R2` com adapter/tests/bindingtype.

### Task 4: Executor durável antes do commit e recuperação limitada

**Files:** A create `src/worker/catalog/{command-store,command-store.test,coordinator,coordinator.test}.ts`.

**Interfaces:** `PublicCatalogCoordinator.submit(command): Promise<CommandOutcome<unknown>>`, `status(identity): Promise<CommandReceipt>`, `retry(identity): Promise<CommandReceipt>`, `alarm(): Promise<void>`; identity inclui operationId e ator verificado em T1, validado internamente contra o comando. `SqliteCommandStore` persiste fases, fingerprint, comando pendente, snapshot público e nextAttemptAt. Resultado privado é devolvido ao ator autorizado durante a execução, não mantido no DO após conclusão. Constructor só usa SQLite; SQL de domínio só via T2, R2 só via T3. Métodos de socket entram em T6.

- [x] Testes `persistBeforeApply`, `crashAtEveryBoundary`, `ambiguousSqlLookup`, `blockedAfterTen`, `privateExpiryWhileBlocked`, `emptyHasNoSqlAlarm`: antes de intenção+alarme duráveis `domainWrites === 0`; reabrir armazenamento após cadaawait e convergir; não repetircreate após timeout; até10 tentativas/fase; saturação101 rejeita antesSQL; payloadsome após24h semPG; empty `queries === 0` e alarme null após retenções locais expirarem.
- [x] Rodar A `npx tsx --test src/worker/catalog/command-store.test.ts src/worker/catalog/coordinator.test.ts`; falha por executor/armazenamento ausentes.
- [x] Implementar submissão persistindo comando/ID/fingerprint+nextAttempt antes do SQL. Serializar processamento inclusive através de await; persistir cada avanço antes do próximo efeito. Após erro ambíguo, localizar resultado SQL primeiro, usando locks/idempotência de T2. Backoff `min(300000,5000*2**(attempt-1))`, teto10/fase. HTTP pode responder202 com recibo pendente; não fingir rollback de commit já feito. Manter checkpoint de sinal pendente até o envio em T6, cobrindo crash entre ready e broadcast. Retry de operação concluída recupera resultado autorizado do journal SQL se necessário, mas status só devolve recibo; a UI pode recarregar o recurso autenticado existente.
- [x] Completar testes de expiração: apagar corpo privado imediatamente ao concluir, máximo24h nos demais; após24h não aplicar comando sem corpo, estacionar e manter só metadata segura. Operação committed conserva snapshot público necessário à publicação, não credenciais. Retry autenticado de committed retoma publicação; não ressuscita intenção accepted expirada. Alarmes locais podem expirar metadata7dias semSQL; esgotar retries remove agendaSQL mas não agenda de privacidade. CleanupR2 limitado usa o mesmo estado, sem apagamento aindaambíguo/referenciado.
- [x] Commit A `feat: recover durable catalog commands without idle SQL`.

### Task 5: Admissão autenticada e fechamento de todos os writers

Checkpoint17/10 posterior: adicionada prova PostgreSQL real das corridas imagem/SQL ao entry de integraçãoT2, com helper de testes `src/worker/catalog/image-service.pg-test-support.ts` emA. Exclusão e associação testadas nas duas ordens, snapshots atual/anterior preservam imagens, logout concorre sob row lock real; sem filaJS compartilhada. SQLite de quota real, armazenamento/projeção controlados — não é prova de R2 remoto nem composição integral doDO. Dez testes PG totais aprovados, sem mudança da lógica de produção. Cobertura dos writers/clientes realmente ativos continua pendente; não concluirT5 apenas por essa prova.

**Files:** A create `src/worker/catalog/{writer,writer.test}.ts`; modify `src/worker/routes/restaurant.ts`, `src/worker/http.ts`, `src/worker/app.ts`, `src/worker/environment.ts`; F create `docs/infra-migration-public-catalog-writers.md`. A usar `AuthRuntime` e services existentes, sem cache novo de sessão.

**Interfaces:** `submitCatalogMutation(context, mutation): Promise<CommandOutcome<unknown>>`; `requireCatalogActor(context): Promise<CatalogActor>` resolve sessão vigente e extrai apenas userId/sessionId/expiry, sem persistir headers. `PUBLIC_CATALOG_WRITER_ENABLED` false por padrão; desligada preserva API legada. Novo cliente manda `X-Vapt-Catalog-Protocol: 1` e `Idempotency-Key: UUID`; opt-in permite envelope T1. Sem opt-in mantém DTO/201/204 legado se ready, mas202 explícito se pendente — nunca sucesso falso. Chaves legadas ausentes são geradas no servidor, sem promessa de dedup de nova requisição sem chave. Converter todos os clientes ativos antes da ativação.

- [ ] Testes `allCatalogRoutesUseDurableWriter`, `privateOnlyDoesNotPublish`, `mixedPatchAtomic`, `actorMismatchDenied`, `onboardingRetryFindsSameRoom`: onboarding/CRUD passam pelo DO quando flag ligada; desligada mantém caminho atual; CNPJ-only não cria versão; patch misto não divide commit; owner/session válidos antes de admitir; servidor pré-aloca UUID estável de T1. Rotas de pedido/cozinha não mudam.
- [ ] Rodar A `npx tsx --test src/worker/catalog/writer.test.ts src/worker/route-contract.test.ts`; esperar falha dos novos contratos, preservar os legados.
- [ ] Implementar gateway e flags. Validar schemas/1MiB/rates atuais antes de RPC; resolver restaurante do owner sem aceitar ID do visitante, nome DO por env+restaurantId. Onboarding deriva ID de ator+operação T1 e persiste antes do SQL. Adicionar GET `/restaurants/me/catalog-operations/:operationId` e POST `.../:operationId/retry`, autenticados e owner-scoped. Status devolve só recibo do DO, não inicia SQL de catálogo nem retries; autenticação/ownership ainda podem consultar SQL. Retry revalida ator e respeita payload expirado. Para onboarding pendente sem restaurante SQL, localizar o mesmo DO pelo ID derivado e verificar ator. Revalidação SQL de T2 continua obrigatória. Adicionar opt-in à allowlist CORS, sem alterar cookies/revogação.
- [ ] Preencher inventário com cada campo PublicRestaurantDto, variações e efeito isChefSuggestion; rastrear SQL writers em API/infra e Node/Coolify ativos. Alterações Stripe somente updatedAt/plano privado não publicam. Se writer ativo altera campo público sem protocolo, bloquear ativação e registrar caminho; não remodelar legado por suposição. Verificar exclusão de imagem em `src/modules/storage/service.ts`: não remover URL ainda publicada; coordenar publicação do item antes da limpeza autenticada, sem permitir apagar prefixo catalog nem objetos de outro tenant.
- [ ] Commit A `feat: route catalog writes through durable publication`; F `docs: inventory active catalog writers`. Alterar storage só se teste comprovar necessidade, com teste no próprio módulo e inventário atualizado.

Bootstrap/republicação usa POST `/restaurants/me/catalog/rebuild`, com o mesmo gate autenticado/owner, rate e idempotência. Só admite o restaurante pertencente à sessão, nunca um ID arbitrário de outro dono. Teste `rebuildCannotTargetAnotherOwner`. Isso dá a T10 um transporte concreto sem novo serviço, segredo administrativo ou endpoint anônimo.

Decisão de armazenamento revisada e confirmada pelo usuário em15/10: **100 MiB por restaurante** (substitui50MiB), incluindo versões retidas e reservas pendentes. Aceitar seleção JPG/PNG/WebP de até5MiB e converter automaticamente no navegador para WebP, até1200px no maior lado, meta300KiB e máximo1MiB por arquivo enviado. FallbackJPEG para fotos e PNG para preservar transparência se o encoderWebP estiver indisponível; sem contratar serviço de transformação. Backend impõe1MiB no upload e100MiB na admissão durável; não confia na compressão do cliente. O núcleo local de uploads usa chaves únicas e PUT condicionado ao ETag de staging; nunca liberar reserva só por expiração da URL. A integração deve verificar referências do catálogo atual+anterior, revisões SQL/R2 e serialização com os comandos antes de limpar. Núcleo testado isoladamente não fecha esse gate; rotas, UI e prova workerd permanecem obrigatórias antes de ativar flags.

### Task 6: Reader público R2 e socket hibernável isolado

**Files:** A create `src/worker/catalog/{admission,admission.test}.ts`, `src/worker/routes/catalog.ts`, `src/worker/catalog-routes.test.ts`; modify `src/worker/routes/public.ts`, `app.ts`, `http.ts`, `realtime-entry.ts`, `catalog/coordinator.ts`.

**Interfaces:** `registerWorkerCatalogRoutes(app): void`; reader de T3; `PublicCatalogCoordinator.connect({origin, publishedRegistration}, request): Promise<Response>` somente invocado pelo gateway interno; classe exportada no entry realtime. `PUBLIC_CATALOG_READER_ENABLED` false por padrão; ativação reader-on/writer-off é recusada pelo guard T9. `fetch` anônimo do DO nunca despacha submit/retry/status.

- [ ] Testes `publishedGetNeverCreatesServices`, `unknownDoesNotCreateRoom`, `publicSocketCannotWrite`, `readyClosesGetUpgradeRace`, `publicHasNoPrivateLease`: GET state/legado no-store; resposta200 mesmo com SQL factory que lança; slug desconhecido404/publicação conhecida pendente503; UUID/Origin/Upgrade/rate inválidos antes de criar DO; socket201º rejeitado; cliente não escreve e frame>512 fecha; sinal nunca antecede R2 ready.
- [ ] Rodar A `npx tsx --test src/worker/catalog/admission.test.ts src/worker/catalog-routes.test.ts src/worker/catalog/coordinator.test.ts`; falha esperada novos routes/upgrade.
- [ ] Implementar GET state `{version,catalog}` e GET legado DTO sem SQL/fallback/rebuild. WS `/v1/catalog/restaurants/:restaurantId/socket`, rate público existente120/60s, allowlist Origin e registro R2 publicado antes de obter DO. Admission passa só dados verificados; dentro do DO confirmar estado publicado monotônico. `ready` lê versão atual; `catalog_changed` só transmite após checkpoint ready. Usar attachments e acceptWebSocket, limite200. Rejeitar escrita do visitante; sem RPC público nem renovação BetterAuth. Não alterar `/v1/realtime/`.
- [ ] Implementar auto-response estático `vapt.catalog.v1:ping`→`vapt.catalog.v1:pong`, sem setInterval no DO. Testar constructor/ready/hibernação com SQL factory que lança e contador zerado. Aplicar limite512 aos frames de protocolo e fechar frames binários/estranhos. Rate HTTP/sockets limita abuso, mas não é teto financeiro de mensagens auto-respondidas: registrar limitação no rollout, sem prometer fatura impossível de exceder.
- [ ] Commit A `feat: serve catalog snapshots and isolated public updates`.

### Task 7: Controlador frontend por recurso, sem polling

**Files:** F create `src/lib/catalog/{client,controller}.ts`, `src/hooks/use-public-catalog.ts`, `src/test/public-catalog-controller.test.ts`, `src/test/public-catalog-transport.test.ts`; modify `src/lib/env.ts` e testesenv para flag `VITE_PUBLIC_CATALOG_EVENTS_ENABLED` falsedefault.

**Interfaces:** `acquirePublicCatalog({apiBaseUrl,slug}): {subscribe(listener):()=>void; getSnapshot(): PublicCatalogView; refresh():void; release():void}`; `PublicCatalogView = {state: CatalogState|null; status: loading|ready|reconnecting|offline|unavailable; errorCode: string|null}`. Hook `usePublicCatalog(slug): PublicCatalogView & {refresh():void}`. GET usa `vaptApiRequest` com requireAuth=false e AbortSignal; WS separado, sem tickets/grants privados. Registro compartilhado por env+apiBaseUrl+slug; dados públicos nunca dependem de cookie.

- [ ] Testes fakeclock `tenStableTabsZeroRefreshes`, `oneReadPerNewVersion`, `coalescesInflightBurst`, `readyRepairsInitialRace`, `oldSlugResponseDiscarded`: após bootstrap/ready estáveis, avançar1h→0GET novos em10 controladores; evento12 duplicado/11 fora de ordem→1GET por aba; burst13/14 durante fetch deixa só uma releitura adicional se resposta<14; comparação>2**53 correta; componentes da mesma página compartilham GET/socket.
- [ ] Rodar F `npm test -- src/test/public-catalog-controller.test.ts src/test/public-catalog-transport.test.ts`; falha porcontrollerausente.
- [ ] Implementar uma promise em voo e maior versão desejada, AbortController+generation para slug/unmount. Hidden/offline cancela GET/WS/timers; focus/online/reconnect lê estado atual e abre socket com dedup. Heartbeat60s/deadline10s só de transporte; backoff1,2,4,8,16s nas5 tentativas, sempre limitado a60s; depois aguardar ação manual/focus/rede. Só ready válido reseta contador, não abertura TCP. Nenhum timer GET por queda de WS.
- [ ] Testar fechamento antes de ready, handshake pendurado com deadline10s, pong sem ready, timer atrasado/background,404/503 e retry manual. Preservar último catálogo com aviso, sem aplicar resposta de outro restaurante. Validar frames512/versão/slugs, fechar protocolo inválido. Limpar registro ao liberar último subscriber; React StrictMode não deixa requests/sockets órfãos.
- [ ] Commit F `feat: subscribe to public catalog versions without polling`.

### Task 8: Integrar cardápios e feedback de publicação ao dono

**Files:** F modify `src/pages/menu/PublicMenu.tsx`, `src/pages/delivery/PublicDelivery.tsx`, `src/lib/menu-items.ts`, `src/lib/restaurants.ts`, páginas`dashboard/MenuManagement.tsx`, `AppearancePage.tsx`, `SettingsPage.tsx`, `onboarding/OnboardingPage.tsx`; create `src/lib/catalog-mutations.ts`, `src/components/menu/CatalogPublicationStatus.tsx`, `src/test/catalog-mutations.test.ts`, `src/test/catalog-publication-status.test.tsx`, `src/test/public-delivery-catalog.test.tsx`; extend `src/test/public-menu-catalog.test.tsx` e testes de managementexistentes.

**Interfaces:** `runCatalogMutation<T>({operationId, route, method, body?}): Promise<CommandOutcome<T>>`, `getCatalogOperation(operationId): Promise<CommandReceipt>`, `retryCatalogOperation(operationId): Promise<CommandReceipt>`. Novo fluxo opt-in usa T5 e mantém chave por ação pendente; helpers legados preservam assinatura até conversão explícita. Após recibo ready sem resultado, recarregar o recurso autenticado existente; não depender de payload privado retido no DO.

- [ ] Testes `menuAndDeliveryUpdateAllPublicFields`, `cartNotResetByCatalog`, `channelDisabledAndSlugChanged`, `ownerSeesCommittedNotReady`, `imageSecondPatchUsesNewOperation`: edição atualiza cores/nome/itens/regras/URLs; desativar canal impede novos pedidos, sem apagar carrinho/pedidos; item removido usa aviso atual; mudança de preço/variação não gera cobrança automática. Retry da mesma ação usa mesma chave; PATCH posterior de imagem usa outra; UI pendente não exibe “publicado”.
- [ ] Rodar F `npm test -- src/test/public-menu-catalog.test.tsx src/test/public-delivery-catalog.test.tsx src/test/catalog-mutations.test.ts src/test/catalog-publication-status.test.tsx`; esperar falhasnovas.
- [ ] Integrar hook T7 quando flag ligada e remover intervalo8s desse fluxo, inclusive dependência cart.items. Flag desligada preserva legado explicitamente. Aplicar restaurante+itens completos em local/delivery; horários atualizam UI no próximo limite publicado, sem GET. Slug canônico navega ao endereço correto preservando pedidos do mesmo restaurante; UUID diferente nunca recebe carrinho de outro tenant. Compra usa API transacional existente.
- [ ] Feedback com padrões visuais existentes: “Alteração aceita”, “Gravada; publicação pendente”, “Publicada”, “Publicação bloqueada”; status/retry manual autenticados, sem intervalo. Bloquear ação conflitante até resolver ambiguidade; não reenviar automaticamente após logout. Payload/cookies fora de localStorage/logs. Imagem antiga só é limpa após revisão ready que não a referencia; upload+PATCH de imagem são ações distintas, sem limpeza antecipada.
- [ ] Reexecutar novos testes e existentes `npm test -- src/test/menu-management.test.tsx src/test/menu-items-api.test.ts src/test/menu-image-storage.test.ts src/test/public-order-realtime.test.tsx src/test/public-menu-rating.test.tsx`; commit F `feat: refresh public menus on published catalog changes`.

### Task 9: Prova local R2/SQLite/hibernação e guard de implantação

Checkpoint remoto autorizado17/10: criados somente `vapt-catalog-preview`/`vapt-catalog-production`, Standard/ENAM, após resposta explícita à pergunta de criação e conferência. Readback GET confirmou r2.dev desativado, zero custom domains e zero objetos/bytes reportados em ambos; buckets de imagens preservados. Essa prova de recursos substitui a pendência de criação/privacidade dos checkpoints anteriores, não a de implantação/readback do binding/namespace, CPU, writers, qualidade, bootstrap ou revisão. Nenhum deploy/flag/schema/secret/plano alterado. Evidência em A `docs/public-catalog-r2-privacy-verification.md`; tarefa9 continua parcial.

Checkpoint17/10 posterior: aliases antigos de publicação da API (public/realtime/observability) e frontend (preview/production/realtime) bloqueados antes de Wrangler; builds legados mantidos só para regressão. Operador API faz checks offline das duas candidatas e bundle production com dry-run fixo/sem overrides.51 guards/operador API,18 guards frontend e113 scripts de regressão aprovados; CI preparado, não executado remotamente. `wrangler preview` instalado não tem dry-run equivalente, portanto check estrutural não é prova dos bindings do Preview nomeado. Publicação/readback/rollback remoto, CPU e demais gates continuam pendentes; não concluir tarefa9 por esse checkpoint.

**Delta aprovado17/10/2026 — armazenamento separado (somente código/configuração):** adicionar `PUBLIC_CATALOG_BUCKET` aos tipos e trocar origem das projeções de reader/coordenador para esse binding, sem fallback. Manter `R2_BUCKET` e configuração de imagens intactos. Candidatas apontam para `vapt-catalog-preview` e `vapt-catalog-production`, ainda não criados. TDD: GET/legado/socket funcionam com bucket de imagens indisponível; binding de catálogo ausente retorna503 sem serviços/DO; guard rejeita alias, ausência e cross-env; workerd usa dois buckets locais e confirma imagens sem snapshots e catálogo sem imagens. Referências retidas para limpeza continuam vindo da projeção privada. Atualizar fixtures, spec/runbook e ledger, rodar unitários/build/guards/workerd. Nenhuma criação, ACL, credencial, deploy ou flag remota nesta execução.

**Files:** A create `src/worker/catalog.workerd.ts`, `catalog-test-fixture.ts`, `wrangler.worker-catalog-test.jsonc`, `scripts/verify-catalog-config.mjs`, `scripts/verify-catalog-config.test.mjs`, `docs/public-catalog-runtime-verification.md`; modify `package.json` com scriptslocais e criar `wrangler.worker-catalog-preview.jsonc`/`wrangler.worker-catalog-production.jsonc` candidatos. F create `docs/infra-migration-public-catalog-rollout.md`; modificar deployguards/envfrontendexistentes somente paraflagsnovas.

**Interfaces:** GuardCLI `node scripts/verify-catalog-config.mjs <config>`: exit0 apenas com CPU1000/rates/nomes de secrets/rotas/privacidade/flags/migrations append-only/isolamento corretos. Não faz rede/deploy. Fixture usa createTestHarness existente; diagnóstico RPC só no entry local, nunca no de produção. Configs novas preservam RestaurantRealtime/migrations anteriores, acrescentam `PUBLIC_CATALOG_COORDINATOR`/`PublicCatalogCoordinator`, tag `catalog-publication-preview-sqlite-v1` ou `catalog-publication-production-sqlite-v1`; flags false. Não inventar namespaceID.

- [ ] Testes reais locais `hibernateWithoutSql`, `crashRestartConverges`, `idleHasNoSql`, `maxPayloadBounded`, `rollbackReaderDrainsWriter`: evictDurableObject(webSockets:"hibernate") com SQL0 em GET/ready/ping/reconnect; restart SQLite em accepted/committed/R2 parcial/ready antes de broadcast converge;10 clientes simulados sem GET extra; limites200/512/1MiB/8MiB; RPC anônimo impossível. SQL injetado não é prova de Postgres real: essa é T2.
- [ ] Rodar A `npx tsx --test src/worker/catalog.workerd.ts` e `node --test scripts/verify-catalog-config.test.mjs`; esperar falha inicial porfixture/guardausentes.
- [ ] Implementar fixture workerd e guards. Verificar que scripts de deploy existentes não apagam classe/flags/recursos usando baseline antiga; nenhum deploy automático antes do gate. Medir CPU8MiB com instrumentação suportada: tempo de parede não é CPU. Se harness não provar1000ms, registrar prova pendente de canário limitado, sem aumentar limite nem declarar gate verde. Rollback do reader volta ao legado explicitamente, sem apagar namespace/schema nem suspender accepted.
- [ ] Rodar F `npm test`, `npm run typecheck`, `npm run build`, `npm run lint`; A `npm test`, `npm run test:worker`, `npm run build`, `npm run build:worker-production-realtime`; mais novos guards. Dry-run não é deploy. Executar integração PG de T2 se local disponível; ausência mantém gate SQL aberto. Registrar contagens/testes/heads e falhas preexistentes separadas de regressões; pass local não é CI verde. Reportar custos residuais sob abuso sem teto USD garantido.
- [ ] Commit A `test: gate event-driven catalog rollout on local runtime proof`; F `docs: define public catalog activation and rollback gates`. Revisão de branch antes da implantação via skill apropriada, sem agentes por tarefa e sem push/main automático.

### Task 10: Bootstrap controlado e gate remoto separado

Checkpoint local17/10: cliente preparado, execução real ainda bloqueada. Além de `--apply`, exigir `--operation-id`, confirmações explícitas de projeto/branch, `--confirm-writer-coverage` e `--confirm-readiness`. São reconhecimentos do operador, não verificações automáticas dos provedores. Uma sessão owner em memória/stdin protegido por execução, nenhum arquivo/env/argumento de credencial, um GET autenticado de conferência e um POST rebuild, sem polling/retry. Saída só contagens/recibo; `postRequests:1` não significa gravação SQL. Credencial até4KiB, entrada8KiB, resposta64KiB, deadline15s por request e redirect proibido. Testes26/26 usam HTTP sintético e CLI real dry-run/entradas inválidas, não provam PostgreSQL ou bootstrap remoto. T9/PG/privacidade/CPU/revisão continuam gates antes de apply.

**Files:** A create `scripts/bootstrap-public-catalog.ts`, `scripts/bootstrap-public-catalog.test.mjs`; F update inventory/rollout docs; nenhum deploy ou SQL remoto antes das condições abaixo.

**Interfaces:** `bootstrap-public-catalog` recebe ambiente e lista explícita de restaurantes aprovados; dry-run padrão; apply exige `--apply` e confirmação de projeto/branch pelo operador, nunca URL com senha em argumento logado. Executa `rebuild` de T1 pelo executor administrativo interno, com snapshot/journal versionado, não por endpoint público anônimo. Scripts validam origem/ambiente, sem ProductionURL por fallback.

CLI: `node --import tsx scripts/bootstrap-public-catalog.ts --environment preview --restaurant-id <UUID> [--apply]`. Uma sessão owner por execução, recebida por entrada protegida do operador/injeção em memória, sem eco, arquivo ou cookie em argumento. CLI valida `/restaurants/me` contra o alvo antes do POST autenticado `/restaurants/me/catalog/rebuild` de T5; múltiplos donos exigem execuções autenticadas separadas. Sem sessão autorizada, bootstrap fica bloqueado, não obtém chave administrativa nova. OperationId é preservado para retry explícito; CLI não inicia polling e imprime somente recibo seguro.

- [ ] Testes `bootstrapRequiresExplicitTargets`, `dryRunDoesNotWrite`, `readerRequiresWriterCoverage`, `quotaFailureStops`: sem alvo/dry-run→0writes; Neon indisponível→interrompe, não ativa Paid; slug público desconhecido→0bootstrap; retry do mesmo rebuild não duplica revisão.
- [ ] Rodar A `node --test scripts/bootstrap-public-catalog.test.mjs`; esperar falha por script/guards ausentes, não credenciais. Implementar script com credenciais injetadas em memória e saídas apenas agregadas/códigos fixos, sem corpos/URLs privadas/tokens. Reexecutar: todos os testes novos devem passar.
- [ ] Documentar gates obrigatórios: testes/integrações reais verdes; revisão final; capacidade Neon sem Paid; readback remoto/autorização do gate; inventário sem writer ativo descoberto; privacidade real R2. Config tem R2_PUBLIC_BASE_URL histórico de imagens: não assumir bucket privado pelo binding. Se acesso público estiver ativo, **não desativar imagens nem criar outro bucket** por inferência; manter reader desligado e solicitar ajuste do desenho com evidência. Snapshot público não autoriza alterar proteções do bucket.
- [ ] Só após gates/autorização remota: migração/grants no preview existente por conexão direta segura→verifySQL/grants→namespace/código com flags false→bootstrap explícito→writer ligado/recuperação provada→reader/frontend canário. Repetir produção com seus próprios IDs/bindings, reutilizando código/testes, sem recriar ambiente. Encerrar writers descobertos ou impedir ativação. Medir agregados: SQL por publicação/visita, alarmes vazios0, GET estável0, pendências e operações R2/DO/Workers; sem reativar logs reprovados. Se orçamento/CPU/proteção não estiverem atendidos, manter gate bloqueado, sem prometer fatura total.
- [ ] Guardar evidência/commit A `chore: add controlled catalog bootstrap`; F `docs: record catalog rollout gate results` só com evidência real. Se cota/gate impedirem ativação, registrar “implementado localmente; implantação pendente”, sem concluir migração ou deletar workspace. Não repetir Stripe/Resend já validados nem executar main/DNS/retirement como próximo passo automático.

## Self-review e aceite do plano

Cobertura: spec§1/6→constraints/T9/T10; §4.1/4.2→T1/T2/T4/T5; §4.3→T2/T3; §4.4→T6/T9; §4.5→T7/T8; §5→T5/T10; §7→T2/T3/T4/T7/T9. Os cinco Review Focus têm testes nominais nas tarefas; prova remota não é substituída por fakeclock/mock PG. Funções/recibos/protocolo têm os mesmos nomes entre tarefas. Nenhuma alteração de intervalo de pedidos/billing para inflar o resultado do catálogo.

Pontos que bloqueiam **ativação**, não trabalho local: integração PG se runtime local ausente; cota Neon; privacidade R2 real; cobertura de writers ativos; CPU8MiB; revisão final/gate remoto. Não substituir por novo plano pago, SQL em loop ou configuração fictícia de custo máximo.

Referências técnicas verificadas15/10: [R2/CAS e writes em voo](https://developers.cloudflare.com/r2/reference/consistency/), [DO auto-response](https://developers.cloudflare.com/durable-objects/api/state/), [Neon scale-to-zero](https://neon.com/docs/introduction/scale-to-zero). Demais fontes/custos estão na pesquisa; metas0GET/0SQL são critérios de teste, não resultados já obtidos.

**Estado:** plano aprovado pelo usuário em15/10/2026 (“continuar” após revisão); execução direta iniciada. Checkboxes só mudam mediante evidência. Implantação remota permanece em gate separado.
