# Tenant Feature Parity Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restaurar multi-restaurante/equipe e as lacunas P01–P10 sem recuperar infraestrutura legada nem perder as otimizações atuais.

**Architecture:** Organização é a fronteira de assinatura e memberships; restaurante explícito é a fronteira operacional. Port seletivo de schema, autorização, serviços e frontend, mantendo Better Auth, snapshots/eventos, R2 e pagamentos atuais. São entregas dependentes, não subsistemas independentes a publicar separadamente.

**Tech Stack:** Node >=24, PostgreSQL local real, pg/Hyperdrive, Better Auth1.7.6, Fastify/Hono/Workers, Durable Objects SQLite, React18/TanStack Query, Vitest/tsx/workerd. Reusar dependências instaladas.

**Spec:** [Especificação aprovada em19/10/2026](../specs/2026-10-19-tenant-parity-restoration-design.md). [Auditoria e fontes históricas](../../infra-migration-functional-parity-audit-2026-10-18.md).

## Global Constraints

- Starter e Pro permitem 1 restaurante por organização; Business até 25; trial permite 1. Trial atual de 3 dias; preços não mudam.
- Quota total de100MiB por restaurante, compartilhada por produtos e marca. Entrada até5MiB; saída otimizada até1MiB, dimensão até1200px, WebP preferido com fallback que preserva transparência.
- Autorização sempre por membership ativa e capability do servidor; papel/ID do cliente e owner_id não substituem a autorização. Sem novos papéis, ACL por restaurante ou UI nova de convites.
- Sem SQL remoto, deploy, flags, bootstrap, novos recursos/plano pago, Stripe Live, emails reais, merge/push/main ou cópia de identidades. Gates remotos permanecem separados. Nenhum teste pode carregar `.env` automaticamente ou usar uma URL remota como fixture.
- Preservar arquivos001–009, dados atuais, chaves externas Stripe, journal/leases e WIPs alheios. Migrations novas numeradas010/011/012, grants posteriores por ambiente; não aplicar baseline Supabase.
- Não executar branches antigas, reinstalar Supabase/JWKS/n8n/Redis nem investigar DNS/Vercel/Easypanel para restaurar comportamento.
- Preservar CPU configurada, rate limits, limites de filas/sockets, privacidade de R2, guardas de publicação e logs sem secrets. Sem polling novo ou SQL por visitante público.
- Execução direta na sessão já é a preferência informada pelo usuário; não abrir novos chats/worktrees em C:. Este plano ainda aguarda revisão, não começou a ser executado.
- TDD por tarefa, suíte completa relevante antes do checkpoint e commits locais explícitos. Falhas preexistentes também devem ser registradas; não representar teste skipped como PASS.

## Review Focus

1. Duas abas do mesmo usuário em restaurantes diferentes: request captura seu restaurante, não a preferência que mudou depois — Tasks3/11/12.
2. Membership removida entre aceite e apply, ou depois do commit: negar nova mutação/resultado privado, mas terminar projeção pública aceita — Task5.
3. Webhook/claim/email legado chegando após migração SaaS: preservar associação, identidade e request de envio já congelado — Tasks7/8.
4. Staff operacional sem billing.read: carregar funcionalidades da operação sem vazar ou consultar billing privado — Tasks9/11.
5. Dois membros trocando produto/logo com quota quase cheia e lease antiga: uma quota, sem apagar referência retida nem liberar reserva só pelo TTL — Task14.

## Workspace, mapa e protocolo de execução

Aliases de paths neste plano são literais e expandem para:

- **F/** = `D:/Projetos/vaptmesaflow/` (frontend e migrations).
- **A/** = `D:/Projetos/vaptmesaflow/.worktrees/vapt-api-infra-foundation/` (API; outro repositório).
- **B/** = `D:/Projetos/vaptmesaflow/infra/cloudflare/billing-email-worker/` (consumidor; versionado em F).

Bases antes deste plano: F `ec000d7`; A `ab24eb0`. Antes de executar, conferir status/HEADs e ler spec/auditoria; preservar os dois documentos financeiros alterados e `docs/implementation-references/`. Manter o ledger do catálogo existente intacto e criar ledger próprio deste plano na pasta ignorada `.superpowers/sdd/tenant-parity-restoration/` usando a skill de execução. Nenhum número anterior de testes substitui o baseline novo.

Unidades novas: A `src/modules/tenancy/` (contratos, policy, autorização/locks, fixtures); A `src/modules/account/` (bootstrap/preferência); A `src/modules/onboarding/` (draft/finalização/ativação); F `src/features/auth/` (bootstrap); F `src/features/restaurants/` (seleção atual); F `src/features/onboarding/` (draft/ativação). O código histórico é referência de comportamento, não arquivo a copiar com imports Supabase.

Cada tarefa abaixo contém ciclo RED→GREEN. **Step5 comum:** executar a suíte completa do repositório tocado, conferir tipos/build e `git diff --check`, registrar comandos/resultados e fazer commit apenas dos paths da tarefa. F: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`; A: `npm test`, `npm run build`; B: `npm test`, `npm run typecheck` no diretório B. Mudanças A+F exigem dois commits; B é parte de F. Incluir no commit os ajustes de testes consumidores exigidos pela troca de contrato, não deixar mocks no contrato antigo. Nenhum comando `deploy:*` faz parte da execução local.

## Contratos transversais fixados

Task1 produz schema; Task2 publica em A `tenancy/contracts.ts`:

```ts
type Role = 'owner'|'admin'|'manager'|'staff';
type PlanType = 'starter'|'pro'|'business';
type BillingPlanStatus = 'trialing'|'active'|'past_due'|'incomplete'|'unpaid'|'paused'|'expired'|'cancelled';
type Capability = 'restaurant.read'|'restaurant.operate'|'restaurant.manage'|'restaurant.create'|'billing.read'|'billing.manage';
type TenantActor = { userId:string; sessionId:string; sessionExpiresAt:number };
type RestaurantScope = { userId:string; restaurantId:string };
type OrganizationScope = { userId:string; organizationId:string };
type RestaurantWriteScope = RestaurantScope & TenantActor;
type OrganizationWriteScope = OrganizationScope & TenantActor;
type RestaurantMembership = { organizationId:string; role:Role };
type Access = RestaurantScope & RestaurantMembership;
type OperationFeatures = Record<'cashier'|'open_tab'|'metrics'|'multi_user'|'advanced_reports',boolean>;
```

Esses tipos nunca são prova de autoridade serializada. `restaurant.create` apenas dá nome à regra histórica owner/admin. Leitura/operação:4 roles; manage/read billing:owner/admin/manager; manage billing/create:owner/admin. Para PostgreSQL, `Queryable`, `Database` e `PoolClient` continuam os tipos existentes de A `src/lib/database.ts`/pg. Os snippets de assert abaixo são trechos de testes, não arquivos completos: `pool` e IDs vêm da fixture Task1; services/repositories são construídos nos testes com suas factories reais e somente gateways externos são substituídos pelas portas sintéticas existentes.

Task2 publica `authorizeRestaurant(q:Queryable, scope:RestaurantScope, capability:Capability):Promise<Access>` e `authorizeOrganization(q:Queryable, scope:OrganizationScope, capability:Capability):Promise<RestaurantMembership>`. Não aceitar create num escopo de restaurante. Falhas:401 sessão,403 vínculo/capability,400 entrada inválida,409 conflito/limite/ambiguidade; nunca expor SQL/Stripe IDs em erros públicos.

Ordens de locks para mutações: chave da operação se houver → conta no primeiro draft → organização (compartilhado em operação normal; exclusivo para criação/entitlement/membership) → restaurante exclusivo → slugs distintos ordenados → sessão compartilhada e linhas de recursos. Usar advisory locks transacionais com chaves prefixadas e funções existentes pg; não manter locks entre requests. A organização pode ser resolvida sem lock inicialmente, mas associação/membership são relidas sob o lock antes do efeito. Escrever/revogar membership exige o mesmo lock exclusivo de organização; negar DML direto dessas tabelas ao papel runtime e expor somente as rotinas mínimas versionadas necessárias. Não prometer proteção contra um administrador SQL fora deste protocolo.

Helpers de Task2: `lockOrganization(client,organizationId,mode:'shared'|'exclusive'):Promise<void>`, `lockRestaurant(client,restaurantId):Promise<void>`, `lockOperation(client,operationId):Promise<void>` e `lockSlugs(client,slugs:readonly string[]):Promise<void>` em A `tenancy/locks.ts`; `assertLiveSession(client,actor):Promise<void>` em `tenancy/authorization.ts`. Toda mutação verifica membership sob lock e sessão antes do write; leitura simples usa authorize sem lock exclusivo. O applier e retirement de imagens usam os mesmos helpers, não o lock do usuário.

---

### Task 1: Schema canônico e ensaio PostgreSQL local

**Teste principal:** `tenant foundation is absent before010 and preserves existing identities after migration`.

**Files:** Create F `infra/neon/010_tenant_foundation.sql`, `010_worker_preview_tenant_grants.sql`, `010_worker_production_tenant_grants.sql`, `verify-tenant-foundation.sql`; A `scripts/local-tenant-pg.mjs`, `src/modules/tenancy/schema.pg-integration.ts`, `pg-test-support.ts`; Modify A `package.json`.

**Interfaces:** Consumes migrations001–009. Produces `npm run test:tenant-pg` e `withLocalDatabase(work:(pool:Pool)=>Promise<void>):Promise<void>`, `withTenantFixture(work:(f:TenantFixture)=>Promise<void>):Promise<void>` em pg-test-support. Fixture tem `pool`, IDs `owner/admin/manager/staff/other/orgA/orgB/restA/restB/restOther/itemB/orderB/sessionB`, e atores `{ownerActor,adminActor,staffActor}`; nomes seed `Restaurante A`/`Restaurante B`, sem dados reais. orgA é Business/active, contémA/B e os4papéis; orgB contém restOther e other como owner; testes de múltiplas organizações acrescentam uma membership explícita ao owner, sem concedê-la a staff. Actor fields seguem o contrato transversal, definidos estruturalmente na fixture até Task2 publicar o tipo. Cada callback usa database novo; não compartilha fixtures mutáveis entre testes.

- [ ] **Step1 — RED:** escrever harness/testes; `assert.equal((await pool.query("select to_regclass('public.organizations') is not null as ok")).rows[0].ok,true)`. Acrescentar backfill preserva IDs e associa assinatura, proprietário órfão/conflito reverte, segunda criação no último slot concorre, membership autoelevação/grants negados.
- [ ] **Step2 — Executar:** `npm run test:tenant-pg -- --through=009` em A. Esperado: assert de schema falso→true falha, não falha de ferramenta/import; registrar o erro exato.
- [ ] **Step3 — GREEN:** implementar010 com organizations, members, subscriptions (campos Stripe atuais, contato de cobrança por userId e trial_started_at), preferences, status/step do onboarding, activation_progress e journal de intenções onboarding. Backfill1org/owner, completos preservados, sem progresso inventado; remover owner_unique só junto da restrição por organização1/1/25, contando drafts e lockando org. Status trialing usa limite1 independentemente do plan_type; demais planos usam1/1/25. Novo trial só é inicializado na Task9. Runtime SELECT das memberships; criação inicial/alterações privilegiadas apenas rotinas de escopo restrito adicionadas na012 da Task9. Sem exposição browser, DDL/CREATE ROLE ou reparenting por patch.
- [ ] **Step4 — Verificar:** `npm run test:tenant-pg -- --through=010`. Esperado: schema/backfill/constraints/grants/concorrência verdes. Harness deriva schema-root de F, usa binários PostgreSQL já disponíveis na scratch do catálogo, cluster novo só127.0.0.1 e senha gerada em memória; para servidor em finally, não instala serviço nem apaga cluster antigo. Passa somente aos filhos `TENANT_TEST_DATABASE_URL` e `TENANT_SCHEMA_ROOT`; recusa host não-loopback e não lê `.env`; captura/redige stdout/stderr antes de propagar erros e nunca imprime URL/password. `--through=009|010|011|012` seleciona lista explícita de migrations; modo padrão inclui as novas já versionadas. Testes PG são adicionados à lista do harness na tarefa que os cria; suites históricas que requerem contrato antigo continuam nomeadas como baseline até serem portadas, sem alegação de compatibilidade do runtime antigo com010.
- [ ] **Step5 — Checkpoint:** protocolo comum; commit `feat: add organization tenant schema and local verification` em F e A conforme paths.

### Task 2: Policy, autorização e locks comuns

**Teste principal:** `revoked membership cannot authorize a subsequent restaurant mutation`.

**Files:** Create A `src/modules/tenancy/contracts.ts`, `policy.ts`, `authorization.ts`, `locks.ts`, `authorization.test.ts`, `authorization.pg-integration.ts`; Modify A `scripts/local-tenant-pg.mjs`, `src/plugins/auth.ts`, `src/modules/auth/{session-resolver,session-resolver.test}.ts`, `src/worker/http.ts` e fixtures/testes de sessão consumidores.

**Interfaces:** Produces contratos/helpers transversais; `getRestaurantLimit(plan:'starter'|'pro'|'business'|'trial'):number`, `hasCapability(role:Role,capability:Capability):boolean`, `operationFeatures(plan:'starter'|'pro'|'business',status:BillingPlanStatus,trialEndsAt:string|null,now:number):OperationFeatures` em policy; BillingPlanStatus é a união dos8 estados existentes de billing. SessionResolver passa sessionId/sessionExpiresAt verificados para AuthContext; manter campos opcionais no tipo durante a transição, mas `actorFromAuth(auth:AuthContext):TenantActor` nega401 se faltarem/forem inválidos, nunca inventa sessão. Todos os novos writes usam RestaurantWriteScope/OrganizationWriteScope. Não substituir ainda os consumidores owner-only: novas unidades são aditivas até suas tarefas pareadas.

- [ ] **Step1 — RED:** `assert.equal(getRestaurantLimit('business'),25); assert.equal(hasCapability('staff','billing.read'),false); assert.equal(hasCapability('manager','restaurant.manage'),true)`. Cobrir todas roles/capabilities, invited/disabled/role desconhecida, usuário de outra org, sessão revogada e falha SQL; PG demonstra revogação aguardando mutação e negando a próxima.
- [ ] **Step2 — Executar:** `node --import tsx --test src/modules/tenancy/authorization.test.ts`; executar também `npm run test:tenant-pg`. Esperado: falha pela policy/autorização ainda ausente, sem fallback de teste que concede tudo.
- [ ] **Step3 — GREEN:** implementar lookup com JOIN membership ativa, SQL parametrizado e helpers na ordem transversal; recurso de org inacessível403 genérico. operationFeatures mantém acesso comercial atual de trial/planos, sem vazar IDs privados. Metadados de sessão são internos; DTOs de auth continuam allowlisted e não passam a devolver o AuthContext inteiro. Rotinas de mudança de membership usam o protocolo exclusivo; owner_id não restaura acesso depois de revogação.
- [ ] **Step4 — Verificar:** repetir comandos; PG prova dois membros no mesmo restaurante serializados e restaurantes distintos operando sem mutex exclusivo global da organização.
- [ ] **Step5 — Checkpoint:** protocolo comum; commit A `feat: add tenant capability authorization and lock protocol`.

### Task 3: Restaurante e cardápio com escopo explícito

**Teste principal:** `updating restaurantA never changes restaurantB of the same owner`.

**Files:** Modify A `src/modules/restaurants/{repository,service,routes,schemas,restaurants.test}.ts`, `src/modules/menu/{repository,service,routes,menu.test}.ts`, `src/modules/business/contracts.ts`, `src/worker/routes/restaurant.ts`, `src/worker/restaurant.workerd.ts`; Create A `src/modules/tenancy/restaurant-scope.pg-integration.ts`.

**Interfaces:** Consumes Task2. Produces métodos de restaurant `getRestaurant(scope:RestaurantScope):Promise<RestaurantDto>`, `updateRestaurant(scope:RestaurantWriteScope,patch):Promise<RestaurantDto>`; menu `listMenuItems(scope:RestaurantScope)`, `createMenuItem(scope:RestaurantWriteScope,input)`, `updateMenuItem(scope:RestaurantWriteScope,itemId,patch)`, `deleteMenuItem(scope:RestaurantWriteScope,itemId)`, com mesmos DTOs/resultados atuais. Argumentos input/patch usam schemas atuais. Adapter `resolveLegacyRestaurant(userId):Promise<RestaurantScope>` só com exatamente1 acessível; >1 lança409 restaurant_selection_required. Wrappers de nomes antigos necessários à compilação permanecem apenas como adapters explícitos; criação de onboarding antiga será substituída pela Task9, não usada como teste de paridade em010.

- [ ] **Step1 — RED:** no PG `await restaurants.updateRestaurant({...ownerActor,restaurantId:restA},{name:'A novo'}); assert.equal((await restaurants.getRestaurant({userId:owner,restaurantId:restB})).name,'Restaurante B')`. Testar itemB no pathA negado, manager edita/staff não, lista sóA e duas abas usando scopesA/B sem ler preferência.
- [ ] **Step2 — Executar:** `node --import tsx --test src/modules/restaurants/restaurants.test.ts src/modules/menu/menu.test.ts` e `npm run test:tenant-pg`; esperado falhar no novo contrato/isolamento.
- [ ] **Step3 — GREEN:** portar consultas/joins, não apenas checker; update/delete incluem id restaurante e recurso filho. Registrar GET/PATCH `/restaurants/:restaurantId` e CRUD `/restaurants/:restaurantId/menu-items`; manter `/me` como adapter único sem preferência implícita. DTO operacional lê plano canônico da organização em vez de colunas SaaS legadas; não expõe Stripe/contact.
- [ ] **Step4 — Verificar:** unit/PG e `npm run test:worker`. Matriz Fastify/Worker mantém resposta e capability iguais.
- [ ] **Step5 — Checkpoint:** protocolo comum; commit A `refactor: scope restaurant and menu operations by tenant`.

### Task 4: Operação, sessões, visão geral e storage

**Teste principal:** `staff operation on restaurantA cannot close a table session of restaurantB`.

**Files:** Modify A `src/modules/kitchen/{repository,service,routes,kitchen.test}.ts`, `src/modules/table-sessions/{repository,service,routes,table-sessions.test}.ts`, `src/modules/overview/{repository,service,routes,overview.test}.ts`, `src/modules/ingest/{repository,routes,ingest.test}.ts`, `src/modules/storage/{repository,service,schemas,routes,repository.test,service.test,routes.test}.ts`, `src/worker/routes/{restaurant,misc}.ts`; Create A `src/modules/tenancy/operational-scope.pg-integration.ts`.

**Interfaces:** Consumes scopes Task2. Métodos privados substituem primeiro argumento userId por scope: kitchen `listActiveOrders(scope)`, `updateOrderStatus(scope,orderId,target)`; sessions `listActiveSessions(scope)`, `getSession(scope,sessionId)`, `closeSession(scope,sessionId)`, `transferSession(scope,sessionId,tableNumber)`; overview `getOverview(scope,period)`. Reads usam RestaurantScope; writes usam RestaurantWriteScope. Resultados permanecem DTOs atuais. Push/storage recebem o mesmo escopo além do recurso; métodos de pedido público e requestPublicCheck não perdem seus tokens próprios.

- [ ] **Step1 — RED:** com staffA `assert.equal((await kitchen.listActiveOrders({userId:staff,restaurantId:restA})).every(o=>o.restaurantId===restA),true); await assert.rejects(sessions.closeSession({...staffActor,restaurantId:restA},sessionB))`. Testar ordem/transição, transferência cruzada, estatísticas, upload/delete e registro push em restaurante alheio.
- [ ] **Step2 — Executar:** `node --import tsx --test src/modules/kitchen/kitchen.test.ts src/modules/table-sessions/table-sessions.test.ts src/modules/overview/overview.test.ts src/modules/ingest/ingest.test.ts src/modules/storage/repository.test.ts src/modules/storage/routes.test.ts` e `npm run test:tenant-pg`; esperado falhar nos novos scopes/denials.
- [ ] **Step3 — GREEN:** corrigir todos predicados owner-only; capability operate para caixa/cozinha/push operacional, read para overview, manage para imagem/config. Revalidar dentro de transações que alteram múltiplos recursos; eventos emitidos só após commit e com restaurante correto. Registrar rotas privadas explícitas e adapters `/me` da Task3.
- [ ] **Step4 — Verificar:** testes dos5 módulos, PG e `npm run test:worker`; operações públicas de pedidos/mesa continuam omitindo cookies quando apropriado e exigindo seus próprios tokens.
- [ ] **Step5 — Checkpoint:** protocolo comum; commit A `refactor: enforce restaurant scope across operational services`.

### Task 5: Applier e imagens do catálogo deixam de depender de owner

**Teste principal:** `membership revocation blocks new apply but not internal recovery of a committed public projection`.

**Files:** Modify A `src/modules/catalog-publication/{contracts,policy,transaction,transaction.test,transaction.pg-integration}.ts`, `src/worker/catalog/{writer,image-service,runner,coordinator}.ts` e respectivos `.test.ts`, `src/worker/catalog.workerd.ts`, `src/worker/catalog-routes.test.ts`; A `scripts/local-tenant-pg.mjs`.

**Interfaces:** CatalogActor passa a alias estrutural de TenantActor. `submitCatalogMutation(context,mutation,restaurantId):Promise<CommandOutcome<unknown>>` e `controlCatalogOperation(context,action,restaurantId)` recebem alvo explícito; bootstrap finalization da Task9 fornece alvo do draft. `applyCatalogCommand`/`findCommittedCommand` mantêm assinaturas; fingerprint inclui organização derivada quando a intenção for criar/finalizar, sem confiar em role serializada.

- [ ] **Step1 — RED:** criar commandA válido com adminActor/restA e `assert.equal((await applyCatalogCommand(pool,commandA)).receipt.restaurantId,restA)`. Revogar membership por fixture administrativa sob lock, tentar outro operationId e exigir403; `assert.ok(await findCommittedCommand(pool,committedIdentity))` continua a recuperar commit anterior. Testar status privado negado após revogação, outro ator/key/payload conflita, imagem aposentada por outro admin durante apply e troca de slug concorrente sem deadlock.
- [ ] **Step2 — Executar:** `node --import tsx --test src/modules/catalog-publication/transaction.test.ts src/worker/catalog/writer.test.ts src/worker/catalog/image-service.test.ts`; PG; esperado owner-only rejeitar admin ou falhar o isolamento/replay.
- [ ] **Step3 — GREEN:** remover ownedRestaurant implícito do gateway; usar capabilities e locks Task2 tanto no executor quanto no prepare/retire/reconcile. Revalidar membership+sessão antes de novo efeito; journal de commit continua recuperável internamente como projeção pública. HTTP sempre autentica/autoriza antes de status/resultado privado; ator original continua parte da identidade idempotente.
- [ ] **Step4 — Verificar:** comandos anteriores e `npm run test:catalog-worker`; flags false não podem inicializar/aplicar catálogo indevidamente; manter revisões, slug canônico, snapshots privados e budgets existentes.
- [ ] **Step5 — Checkpoint:** protocolo comum; commit A `fix: authorize catalog commands and image leases by membership`.

### Task 6: Capacidades de pagamentos e realtime

**Teste principal:** `staff realtime admission is revoked on the next batched membership validation`.

**Files:** Modify A `src/lib/{permissions,permissions.test}.ts`, `src/composition/{api-services,api-services.test}.ts`, `src/modules/payments/{service,routes,manual-payment.test}.ts`, `src/modules/payments/providers/mercado-pago/{composition,oauth,oauth.test,routes}.ts`, `src/modules/auth/routes.ts`, `src/modules/realtime/{authorization,authorization.test}.ts`, `src/worker/routes/{auth,mercado-pago,realtime}.ts`, `src/worker/{realtime.workerd,realtime-routes.test}.ts`.

**Interfaces:** ApiServices expõe `authorizeRestaurant`/`authorizeOrganization` ligados ao database. Checker canônico de lib/permissions exige capability explícita e delega Task2, nunca owner fallback. Manter aliases OwnershipLookup necessários aos consumidores ainda em transição com capability conservadora: no Stripe anterior à Task7, alias exige billing.manage e portanto não amplia acesso a staff; Task7 elimina esse alias e restaura billing.read de manager. RealtimeGrant mantém formato externo; modo owner é transporte histórico de membro autenticado, não papel.

- [ ] **Step1 — RED:** testar confirmação manual por staff, conexão Mercado Pago negada a manager e status permitido a manager usando serviços reais/portas provider sintéticas; no realtime `assert.deepEqual(await realtime.revalidate([staffGrant],Date.now()),[false])` após revogar membership. Admitir socket de staff antes da revogação; falha SQL tambémfalse; order token público continua isolado.
- [ ] **Step2 — Executar:** `node --import tsx --test src/modules/payments/manual-payment.test.ts src/modules/payments/providers/mercado-pago/oauth.test.ts src/modules/realtime/authorization.test.ts`; esperado falhar em admin/staff ou capability negada.
- [ ] **Step3 — GREEN:** mapear rotas à matriz; status provider billing.read, connect/disconnect billing.manage, confirmação manual operate. Inputs de beginConnection/disconnect e confirmação manual carregam RestaurantWriteScope obtido de actorFromAuth; não aceitam metadados de sessão no body. Callback OAuth usa o state de uso único e escopo previamente persistido; testar revogação entre begin/callback antes de gravar credencial, sem confiar só na autorização inicial. SQL batch de realtime verifica sessão e membership ativa; não consultar por ping/frame ou guardar role como autoridade. Wiring igual em Fastify/Worker, inclusive auth access endpoint.
- [ ] **Step4 — Verificar:** repetir; `npm run test:worker`; controlar que retries/token de pedido não recebem autoridade de equipe e que limites de conexões/lease não aumentaram.
- [ ] **Step5 — Checkpoint:** protocolo comum; commit A `feat: restore payment capabilities and member realtime access`.

### Task 7: Assinatura Stripe canônica por organização

**Teste principal:** `restaurants in the same organization share one SaaS customer and subscription`.

**Files:** Create F `infra/neon/011_organization_billing.sql`, `011_worker_preview_billing_grants.sql`, `011_worker_production_billing_grants.sql`, `verify-organization-billing.sql`; Modify A `src/modules/billing/stripe/{repository,service,types,client,routes,schemas,webhook-repository,webhook-service}.ts`, testes correspondentes, `src/worker/routes/stripe.ts`; Create A `src/modules/billing/stripe/organization-billing.pg-integration.ts`; A harness PG.

**Interfaces:** `BillingScope` passa a conter organizationId e `billingContactUserId` estável, separado de actorUserId. Repository `getScope(scope:OrganizationScope)`, `withBillingLock(scope:OrganizationWriteScope,work)`; service status recebe OrganizationScope, checkout/portal recebem OrganizationWriteScope mais campos atuais de operação. Adapter de restaurantId resolve org com capability e rejeita ambos IDs discordantes. Gateway `findCustomers(organizationId)` pesquisa metadados canônicos; legacy lookup só por associação persistida, não por owner atual.

- [ ] **Step1 — RED:** chamar checkout real com gateway sintético paraA/B da mesma organização e verificar `assert.equal((await repository.getScope({userId:admin,organizationId:orgA})).stripeCustomerId,expectedCustomerId)` sem criação de outro Customer. Negar manager nas mutações; SQL `assert.equal((await pool.query('select count(*)::int as n from public.organization_subscriptions where organization_id=$1',[orgA])).rows[0].n,1)`. Acrescentar admin diferente de creator, replay/concorrência, webhook fora de ordem, associação Stripe de outra org e eventos antigos sem org metadata.
- [ ] **Step2 — Executar:** testes stripe/checkout/webhook e PG com baseline até010; esperado identidade SaaS continuar por restaurante ou011 ausente, não chamadas ao provedor.
- [ ] **Step3 — GREEN:**011 cria `organization_billing_legacy_resources` com chaves de recurso Stripe únicas e associação imutável aos pares antigos; adiciona organization_id a events/outbox, migra FK/unicidade SaaS para org e preserva outbox IDs/claims/snapshots. Canonicalizar locks/scope/metadados; manter estados/checkout pendente e validação de livemode/preços/URL/assinatura. Conflitos de backfill abortam sem descartar dados. Eventos antigos são resolvidos pela associação, novos por organizationId com IDs verificados. Pagamentos de pedidos não mudam.
- [ ] **Step4 — Verificar:** `npm run test:tenant-pg -- --through=011` e testes Stripe; provar25restaurantes/1assinatura, trial não reinicia, dono não-member não administra e manager lê sem mutação. Migração mantém compatibilidade de origem, não duas fontes autoritativas de plano.
- [ ] **Step5 — Checkpoint:** protocolo comum; commits F/A `feat: scope Stripe subscriptions and billing events to organizations`.

### Task 8: Consumidor de emails acompanha a identidade SaaS

**Teste principal:** `legacy delivery retry preserves the frozen recipient across organization migration`.

**Files:** Modify B `src/{outbox-repository,contracts,consumer,templates}.ts`, testes correspondentes e `outbox-repository.integration.test.ts`; Modify A `src/modules/billing/stripe/webhook-repository.ts`, seus testes e PG de Task7.

**Interfaces:** Manter OutboxMessage version1 só outboxId/correlationId. DeliveryLease acrescenta organizationId; recipient deriva do contato Better Auth verificado da org. EmailSnapshot e variáveis publicadas atuais não mudam: RESTAURANT_NAME usa nome da organização como rótulo do contrato existente, sem escolher um restaurante aleatório. Snapshot já congelado é retornado byte-equivalente; request idempotente mantém outboxId.

- [ ] **Step1 — RED:** `assert.equal((await repository.claimDelivery(outboxId,now))?.snapshot?.to,originalRecipient)` para registro com request congelado; no PG verificar1linha para organization_id+billing_resource_id+email_kind apesar de eventos/retries de restaurantes diferentes. Simular retry após troca do ator/admin/nome, claim concorrente, backlog antigo e contato não verificado; este último não envia.
- [ ] **Step2 — Executar:** `npm test` em B e PG Task7; esperado falhar no join owner/restaurante ou duplicação, sem chamar Resend.
- [ ] **Step3 — GREEN:** JOIN por organização, contato verificado e unicidade org+resource+kind da011. Manter8tentativas, janela24h, lease15min, batch20, template aliases, URL fixa e tratamento de resultado incerto. Pedido já iniciado conserva request congelado mesmo se dados atuais mudarem; não enviar a staff/admin por ser ator.
- [ ] **Step4 — Verificar:** suíte B, typecheck e PG real com adapter local de QueryRunner; nenhum env de integração remoto obrigatório, nenhum email real; testes de Worker/crons não passam a depender de restaurant.owner_id.
- [ ] **Step5 — Checkpoint:** protocolo comum; commits F/B e A `fix: preserve organization billing email delivery identity`.

### Task 9: Bootstrap, draft, finalização e ativação na API

**Teste principal:** `staff bootstrap supplies operation features without private billing fields`.

**Files:** Create A `src/modules/account/{contracts,repository,service,routes,schemas,account.test}.ts`, `src/modules/onboarding/{contracts,repository,service,routes,schemas,onboarding.test,onboarding.pg-integration}.ts`, `src/worker/routes/account.ts`, `src/worker/account.workerd.ts`; Create F `infra/neon/012_tenant_onboarding.sql`, `012_worker_preview_onboarding_grants.sql`, `012_worker_production_onboarding_grants.sql`; Modify A `src/composition/api-services.ts`, `src/{app.ts,worker/app.ts}`, `src/modules/catalog/repository.ts`, catalogue mutation contracts/transaction; F `infra/neon/verify-tenant-foundation.sql`.

**Interfaces:** `AccountBootstrap={userId,organizations:{id,name,role,capabilities:Capability[],features:OperationFeatures}[],restaurants:{id,organizationId,name,slug,onboardingStatus:'draft'|'complete'}[],currentOrganizationId:string|null,currentRestaurantId:string|null,destination:'onboarding'|'select-restaurant'|'dashboard'}`. `OnboardingDraft={id:string,organizationId:string,name:string,slug:string,whatsapp:string,localEnabled:boolean,deliveryEnabled:boolean,totalTables:number,onboardingStep:0|1|2}`. `getBootstrap(userId:string,routeRestaurantId?:string):Promise<AccountBootstrap>`, `savePreference(actor:TenantActor,selection:{organizationId:string;restaurantId:string}):Promise<void>`; `createInitialDraft(actor:TenantActor,key:string,input:DraftBasics):Promise<OnboardingDraft>`, `createOrganizationDraft(actor:TenantActor,organizationId:string,key:string,input:DraftBasics):Promise<OnboardingDraft>`, `saveDraft(actor:TenantActor,restaurantId:string,patch:DraftPatch):Promise<OnboardingDraft>`, `finalizeDraft(actor:TenantActor,restaurantId:string,key:string):Promise<RestaurantDto>`, `getActivation(scope:RestaurantScope):Promise<Record<GuideModule,boolean>>`, `completeActivation(scope:RestaurantWriteScope,module:GuideModule):Promise<void>`. DraftBasics/Partial DraftPatch são validados pelos campos descritos no Step3; GuideModule conserva o enum existente. As chaves de tipos de objeto não anotadas neste resumo são strings, salvo role:Role, arrays e enums já especificados; DTOs públicos de conta não recebem campos Stripe.

- [ ] **Step1 — RED:** para bootstrap de staff na fixture Business `assert.equal(bootstrap.organizations[0].features.cashier,true); assert.deepEqual(Object.keys(bootstrap.organizations[0]).sort(),['capabilities','features','id','name','role'])`. Cobrir zero/um/vários, route ID inválido/alheio sem fallback, prefs inacessíveis, draft restart em outro cliente, trial único3dias, finalização rollback/retry e progressosA/B.
- [ ] **Step2 — Executar:** `node --import tsx --test src/modules/account/account.test.ts src/modules/onboarding/onboarding.test.ts` e `npm run test:tenant-pg`; esperado endpoints/contratos persistentes ausentes.
- [ ] **Step3 — GREEN:** endpoints da spec, mais GET/PATCH `/restaurants/:restaurantId/onboarding`, POST `/restaurants/:restaurantId/onboarding/finalize`, GET `/restaurants/:restaurantId/activation`, POST `/restaurants/:restaurantId/activation/:module`. Input inicial `{name,slug,whatsapp?:string|null}`, patch parcial desses campos mais localEnabled/deliveryEnabled/totalTables/onboardingStep; primeira criação exige basics válidos, sem slug público placeholder.012 adiciona rotinas security-definer `create_initial_restaurant_draft(user_id uuid,session_id uuid,operation_id uuid,name text,slug text,whatsapp text):uuid` e `create_organization_restaurant_draft(user_id uuid,session_id uuid,organization_id uuid,operation_id uuid,name text,slug text,whatsapp text):uuid`, search_path fixo, execução apenas runtime, validação de sessão/role dentro da rotina e sem parâmetro role. Criam membership owner só no primeiro caso; não conceder DML genérico de membership. Serializar primeiro draft por conta e criação por org; journal onboarding único ator+op com fingerprint/resultado, nunca novo draft no retry. Finalizar status/3dias no servidor só uma vez. Snapshot/GET público exclui draft; finalization liga-se ao applier como mutação explícita `onboarding.finalize` com `{restaurantId}` e identidade da intenção, sem reconstruir onboarding completo a cada retry. Cap read para progresso, operate para completar módulo. preference/read não muda autorização. Substituir o antigo createOwnedRestaurant/onboarding no mesmo checkpoint e portar os ensaios PG históricos para o contrato novo.
- [ ] **Step4 — Verificar:** unit/PG/workerd; dados públicos não incluem org/roles/billing; staff não consulta billing privado para operar; enum módulos existente cashier/menu/kitchen/settings/overview, unique(restaurante,module).
- [ ] **Step5 — Checkpoint:** protocolo comum; commit A `feat: restore account bootstrap and resumable tenant onboarding`.

### Task 10: Contratos e estado canônico no frontend

**Teste principal:** `multiple ready restaurants without a valid preference require explicit selection`.

**Files:** Create F `src/features/auth/{account-client,account-bootstrap-query,use-account-bootstrap}.ts`, `src/features/restaurants/{current-restaurant,restaurant-entitlement}.ts`; Modify F `src/lib/{restaurants,menu-items,kitchen,overview,table-sessions,business-api.types,catalog-mutations}.ts`, `src/hooks/use-catalog-publication.ts`, `src/contexts/{AuthContext,RestaurantContext}.tsx`; Create F `src/test/{account-bootstrap-query,tenant-scoped-clients}.test.ts`.

**Interfaces:** Mirror DTO Task9 com parsing seguro; `AccountBootstrapInput=Pick<AccountBootstrap,'userId'|'organizations'|'restaurants'>&{preferredOrganizationId:string|null;preferredRestaurantId:string|null;routeRestaurantId:string|null}`, `deriveAccountBootstrap(input:AccountBootstrapInput):AccountBootstrap`; `useAccountBootstrap(routeRestaurantId?:string|null)`, `useCurrentRestaurant():{scope:RestaurantScope|null,organizationId:string|null,restaurant:RestaurantDto|null,loading:boolean,error:Error|null}`, `useRestaurantCreationEntitlement(organizationId:string|null)`. Clientes operacionais passam a aceitar restaurantId primeiro e usam paths explícitos. `useCatalogPublication(identity:{userId:string;restaurantId:string}|null,onReady)` invalida estado pelo par, não só pelo usuário. Legacy fetchOwnedRestaurant fica apenas para adapters em transição e sai dos consumidores canônicos. Browser não constrói RestaurantWriteScope com sessão: metadados de sessão são acrescentados pelo middleware da API, não enviados pelo cliente.

- [ ] **Step1 — RED:** `expect(deriveAccountBootstrap(multipleWithoutPreference).destination).toBe('select-restaurant'); expect(requestForA.route).toBe('/restaurants/'+restA+'/menu-items')`. Provar stale preference/route não acessaB, mutation captura scope antes do await, abort/erro não entrega dado antigo e public requests continuam credentials omit.
- [ ] **Step2 — Executar:** `npm test -- src/test/account-bootstrap-query.test.ts src/test/tenant-scoped-clients.test.ts`; esperado falha de path/seleção atual.
- [ ] **Step3 — GREEN:** portar algoritmo de bootstrap histórico como função pura/DTO seguro e camada query keyed por identidade; implementar contexto atual usando a query (RestaurantContext deixa de ser fonte local). Atualizar adapters de publicação com restaurantId explícito, preservar operationId em retry e impedir recarregar outro restaurante. Auth logout limpa queries privadas/sockets sem apagar dados públicos/carrinho de outro contexto indiscriminadamente.
- [ ] **Step4 — Verificar:** testes e `npm run typecheck`; parar e converter no mesmo commit os consumidores necessários para compilar, mantendo mudanças de UX nas tarefas seguintes. Imports não voltam a Supabase.
- [ ] **Step5 — Checkpoint:** protocolo comum; commit F `refactor: add canonical tenant account and scoped API clients`.

### Task 11: Seletor, roteamento e assinatura no frontend

**Teste principal:** `staff can open kitchen without requesting private subscription status`.

**Files:** Create F `src/features/restaurants/{RestaurantSwitcher,RestaurantSelectorPage,NewRestaurantPage}.tsx`; Modify F `src/{App.tsx,components/DashboardLayout.tsx,components/ProtectedRoute.tsx}`, `src/pages/auth/{LoginPage,SignupPage}.tsx`, `src/hooks/{useSubscription,use-plan}.ts`, `src/lib/{billing-client,plans}.ts`, `src/pages/{PricingPage.tsx,dashboard/SubscriptionPage.tsx}`; Create F `src/test/{restaurant-switcher,tenant-routing,organization-subscription}.test.tsx`.

**Interfaces:** `useSwitchRestaurant()` mutation restaurantId→persisted validated preference; routes `/restaurants/select` e `/restaurants/new`; hook useSubscription conserva interface dos consumidores, adiciona organizationId e usa query por usuário+org. usePlan vira adapter da mesma fonte, sem nova consulta owner-only. billingClient usa organizationId; staff obtém features do bootstrap e nunca chama billing.read. Restaurantes/plano copy1/1/25 reaparece em PLANS.maxRestaurants.

- [ ] **Step1 — RED:** `expect(billingSpy).not.toHaveBeenCalled()` para staff no KDS; comA/B `expect(checkoutBody.organizationId).toBe(orgA)` e uma assinatura. Testar trocar com URLrestaurantId=A antiga, duas abas mantendo requests explícitos, logoutA/loginB, zero→onboarding nunca subscription e role sem create desabilitada por resposta do servidor.
- [ ] **Step2 — Executar:** `npm test -- src/test/restaurant-switcher.test.tsx src/test/tenant-routing.test.tsx src/test/organization-subscription.test.tsx`; esperado seletor/escopo/capability ausentes.
- [ ] **Step3 — GREEN:** selecionar e invalidar queries por identidade, remover override antigo sem gravar prefs numa leitura; guardas usam bootstrap/draft e recovery não redireciona ao dashboard. Billing UI manager lê sem mutações e staff opera sem rota privada; plano expirado mantém comportamento comercial atual. Não deduzir permissões de email, nome ou plan_type no navegador.
- [ ] **Step4 — Verificar:** repetir e testes existentes pricing-billing/stripe-billing/subscription-billing-state/better-auth-flows; nenhuma consulta duplicada por usePlan/useSubscription ou polling novo.
- [ ] **Step5 — Checkpoint:** protocolo comum; commit F `feat: restore restaurant switching and organization subscription state`.

### Task 12: Telas operacionais isoladas na troca de tenant

**Teste principal:** `a delayed restaurantA response cannot populate or save the restaurantB form`.

**Files:** Modify F `src/pages/dashboard/{SettingsPage,AppearancePage,MenuManagement,KitchenMonitor,CashierPage,Overview}.tsx`, `src/components/payments/{CurrentPaymentMethodsCard,MercadoPagoSettingsCard,ManualPaymentDialog}.tsx`, `src/hooks/use-realtime-refresh.ts`, `src/lib/realtime/client.ts`; Create F `src/test/tenant-settings-isolation.test.tsx`, `tenant-operation-isolation.test.tsx`; atualizar os testes consumidores existentes desses componentes.

**Interfaces:** Consumes useCurrentRestaurant, scoped clients e publication identity; nenhuma chamada canônica usa fetchOwnedRestaurant. Cada load/save captura userId+orgId+restaurantId+geração; `canEdit` vem de capability confiável e carga válida, não só user truthy.

- [ ] **Step1 — RED:** `expect(screen.queryByDisplayValue('Restaurante A')).not.toBeInTheDocument()` após trocar paraB com fetch lento; após respostaA tardia e saveB `expect(capturedRequest.route).toBe('/restaurants/'+restB)`, com nome deB no body. Casos carga rejeitada/404/wrong-id, arquivoA pendente, saveA concluindo emB, links de slug e status providerA não aparecem emB.
- [ ] **Step2 — Executar:** `npm test -- src/test/tenant-settings-isolation.test.tsx src/test/tenant-operation-isolation.test.tsx`; esperado formulário/callback owner-bound reutilizado.
- [ ] **Step3 — GREEN:** limpar/gatear estado e rejeitar resposta fora de geração; manter request já enviado direcionado aA, sem callback contaminandoB. Fechar/reabrir realtime privado no escopo correto; operações que staff não pode executar ficam inacessíveis sem impedir leitura/operação autorizada. Preservar timeout/carrinho/revisões já implementados.
- [ ] **Step4 — Verificar:** testes novos mais suites cashier/kitchen/menu/overview/appearance/payments; não ocultar falhas removendo testes de fluxo público.
- [ ] **Step5 — Checkpoint:** protocolo comum; commit F `fix: prevent stale tenant forms and operation responses`.

### Task 13: Onboarding de três etapas e ativação persistida

**Teste principal:** `a fresh query client resumes the saved draft without requiring a first dish`.

**Files:** Create F `src/features/onboarding/{onboarding-client,onboarding-form,use-onboarding-draft,activation-progress-service,use-activation-progress}.ts`, `steps/{RestaurantBasicsStep,OperationStep,ReadyStep}.tsx`; Modify F `src/pages/onboarding/OnboardingPage.tsx`, `src/lib/onboarding.ts`, `src/components/dashboard/OnboardingGuideCard.tsx` e handlers do guia em cashier/menu/kitchen/settings/overview; Create F `src/test/{onboarding-resume,activation-progress}.test.tsx`; Modify F `src/test/onboarding-flow.test.tsx`.

**Interfaces:** Mirror OnboardingDraft Task9; client conecta Task9, keys por usuário+draft; `useActivationProgress(restaurantId:string|null)`, `completeActivationModule(restaurantId:string,module:GuideModule):Promise<void>`. Helpers de navegação do guia ficam puros; localStorage global não é fonte nem migrado automaticamente.

- [ ] **Step1 — RED:** `expect(await screen.findByDisplayValue(savedName)).toBeVisible()` após remount/novo QueryClient; `expect(screen.queryByLabelText('Nome do Prato')).not.toBeInTheDocument()` como requisito de finalização; concluir overviewA `expect(progressB.overview).toBe(false)`. Erro de save não avança, retry mantém draft/trial/operationId.
- [ ] **Step2 — Executar:** `npm test -- src/test/onboarding-resume.test.tsx src/test/activation-progress.test.tsx src/test/onboarding-flow.test.tsx`; esperado draft inexistente e guia global.
- [ ] **Step3 — GREEN:** basics→operação→revisão, salvar no servidor antes de navegar; salão/delivery/ambos e mesas condicionais; concluir só após finalize/publicação exigida. Primeiro prato/logo opcionais depois; não marcar todos os módulos. Atualizar bootstrap após draft/finalize e progresso somente no restaurante correto.
- [ ] **Step4 — Verificar:** comandos anteriores e API onboarding/PG novamente; refresh e erro final não geram restaurante falsamente completo ou trial adicional.
- [ ] **Step5 — Checkpoint:** protocolo comum; commit F `feat: restore resumable onboarding and restaurant activation progress`.

### Task 14: Logo real com orçamento compartilhado de assets

**Teste principal:** `branding and product leases share one100MiB budget across members and restarts`.

**Files:** Modify A `src/worker/catalog/{image-budget,image-uploads,image-service,coordinator}.ts`, respectivos testes, `src/worker/routes/misc.ts`, `src/worker/catalog.workerd.ts`; Create F `src/lib/restaurant-assets.ts`, `src/test/appearance-logo-upload.test.tsx`; Modify F `src/pages/dashboard/AppearancePage.tsx`, `src/lib/menu-image-storage.ts` e seus testes. Sem novo bucket/namespace.

**Interfaces:** `AssetTarget={restaurantId:string;kind:'menu-item';itemId:string}|{restaurantId:string;kind:'branding'}`. Leases persistem target discriminado; dados antigos mapeiam kind menu-item, chaves antigas imutáveis. `uploadRestaurantLogo({restaurantId,image,operationId}):Promise<string>` usa prepare/upload/verify e retorna URLR2; `retireRestaurantAsset({restaurantId,objectKey}):Promise<void>`. Novas rotas `/restaurants/:restaurantId/branding/image/upload` e DELETE `/restaurants/:restaurantId/branding/image`; mesmas capabilities/controle de catálogo.

- [ ] **Step1 — RED:** após reservar leases de produto/logo usar o budget real `assert.equal(budget.usage(restA,[]),menuBytes+logoBytes)` e negar reserve acima de104857600bytes com413; `expect(saved.logoUrl.startsWith('blob:')).toBe(false)`. Concorrência2membros/mesma lease, alpha/fallback do otimizador, quota quase cheia, upload incerto, troca/logout, snapshot anterior retido e upgrade de database SQLite antigo preenchido.
- [ ] **Step2 — Executar:** `node --import tsx --test src/worker/catalog/image-budget.test.ts src/worker/catalog/image-service.test.ts src/worker/catalog/image-uploads.test.ts` em A e `npm test -- src/test/appearance-logo-upload.test.tsx src/test/menu-image-storage.test.ts` em F; esperado target logo/budget compartilhado/persistência ausentes.
- [ ] **Step3 — GREEN:** migrar schema SQLite de leases preservando dados/counters, parser de chave `restaurantId/branding/objectId`, validar scope sem menu item inexistente. Reusar otimizador atual e limite de saída1MiB para uploads novos; não recodificar em cada leitura. UI guarda File/preview separados, revoga objectURL e associa só URL verificada; lease estável por arquivo/ator/tenant. Retirar antigo só quando referências retidas/pending permitirem; limite10por reconciliação manual e fence de resultado incerto ficam.
- [ ] **Step4 — Verificar:** testes unit/UI, `npm run test:catalog-worker` e PG imagem/catálogo; quota100MiB única,5MiB input,1MiB output,1200px; objetos legados não são apagados ou recodificados automaticamente.
- [ ] **Step5 — Checkpoint:** protocolo comum; commits A/F `fix: persist branding assets within shared restaurant image quota`.

### Task 15: Slug pontual com conflito inline

**Teste principal:** `an obsolete slug availability response cannot validate a new slug or tenant`.

**Files:** Modify A `src/modules/restaurants/{routes,service,schemas}.ts`, `src/worker/routes/restaurant.ts`; Create A `src/modules/restaurants/slug.test.ts`; Modify F `src/pages/dashboard/AppearancePage.tsx`, `src/lib/restaurants.ts`; Create F `src/test/appearance-slug.test.tsx`.

**Interfaces:** GET `/restaurants/:restaurantId/slug-availability?slug=...` requer manage e retorna apenas `{available:boolean}` sem proprietário/IDs terceiros. `checkRestaurantSlug(restaurantId,slug,signal?):Promise<boolean>` no cliente. Save SQL continua autoridade final; erro único mapear409 slug_conflict, não só toast genérico.

- [ ] **Step1 — RED:** `expect(await screen.findByText('Este endereço já está em uso. Escolha outro.')).toBeVisible()` no blur; editar para outro valor e receber resposta antiga não altera o novo status. Testar slug próprio livre, inválido sem request, save concorrente e troca de tenant durante check.
- [ ] **Step2 — Executar:** `node --import tsx --test src/modules/restaurants/slug.test.ts` em A; `npm test -- src/test/appearance-slug.test.tsx` em F; esperado check/erro inline ausentes.
- [ ] **Step3 — GREEN:** validar normalização/tamanho2–60/regex atual; request só blur e presave, sem polling. Invalidar epoch/abortar request anterior, revalidar no save e mapear conflito inline preservando edição; slug canônico/catálogo e link do cabeçalho atualizam após commit confirmado.
- [ ] **Step4 — Verificar:** testes, API PG rename e frontend restaurant-publication-pages/catalog; validação só retorna boolean e usa rate limit privado atual.
- [ ] **Step5 — Checkpoint:** protocolo comum; commits A/F `fix: restore tenant-safe slug availability feedback`.

### Task 16: Verificação pareada e reconciliação final local

**Teste principal:** `paired tenant product flow keeps SaaS effects unique and public DTOs private-field-free`.

**Files:** Create F `docs/infra-migration-tenant-parity-verification.md`; Modify F auditoria, branch-integration e branch-reconciliation; A `src/worker/route-contract.test.ts`, fixtures/workerd existentes; criar testes integrados adicionais em A `src/modules/tenancy/parity.pg-integration.ts` e F `src/test/tenant-parity.test.tsx`.

**Interfaces:** Consumes Tasks1–15. Produces matriz P01–P10→arquivos/commits/testes/resultados, manifesto F/A/B pareado e procedimento de promoção/rollback compatível a ser autorizado em outra etapa. Nenhuma integração automática em main.

- [ ] **Step1 — RED:** smoke sintético integrado completo:2organizações,25restaurantesBusiness, quatro roles, signup/reset atuais, onboarding/reload, pedido local/delivery→cozinha/caixa, confirmação manual/OAuth fakes,1assinatura, publicação/logo/slug e troca/logout. Testar permissão cruzada e crash entre commit/projeção; SQL `assert.equal((await pool.query('select count(*)::int as n from (select organization_id,billing_resource_id,email_kind from public.billing_email_outbox group by 1,2,3 having count(*)>1) duplicates')).rows[0].n,0)`; em DTO público `expect(Object.keys(publicRestaurant).filter(k=>/stripe|billing|organization|role/i.test(k))).toEqual([])`.
- [ ] **Step2 — Executar:** `npm run test:tenant-pg` e `node --import tsx --test src/worker/route-contract.test.ts` em A; `npm test -- src/test/tenant-parity.test.tsx` em F. Registrar qualquer quebra real restante, não transformar falta de remoto em PASS. Se já estiverem verdes pelo trabalho anterior, conservar essa evidência em vez de fabricar um RED.
- [ ] **Step3 — GREEN:** corrigir somente lacunas reproduzidas com teste antes, atualizar fixtures/contratos remotos que pressupunham owner-only para uso futuro e guardar rollback entendido por schema canônico. Reconciliar novamente refs e alterações locais úteis sem sobrescrever WIPs; atualizações de documentação marcam completo só quando comportamento demonstrado.
- [ ] **Step4 — Verificar:** F protocolo completo e `npm run test:production-deploy`; B suíte/typecheck; A `npm test`, `npm run build`, `npm run test:worker`, `npm run test:tenant-pg`, `npm run test:catalog-config`, `node --test scripts/*.test.mjs`. Testes de configuração não executam apply/deploy; artefatos locais podem ser construídos apenas por comandos dry-run/build já guardados. Revisão independente única de toda a branch ao fim conforme execução direta; não criar revisor por tarefa.
- [ ] **Step5 — Checkpoint:** commits locais explícitos, registrar status restante remoto/CI e apresentar resultado. Antes de autorizar promoção futura: capacidade Neon disponível, backup, bloquear admissions incompatíveis, drain seguro de claims/comandos, consumers antigos parados, migration/readback, API+fila compatíveis, frontend, smoke negativos e liberação por ambiente. Webhook não aceito retentável; rollback jamais para owner-only após dados multi-tenant. Não ligar reader/writer, publicar, contratar ou fazer merge para encerrar esta tarefa.

## Auto-revisão e handoff

Cobertura: spec1–4→Tasks1–6; spec5–7→Tasks9–13; spec8→Tasks7/8/11; spec9→Tasks5/6/14/15; spec10/11→restrições globais e Task16. P01/P03/P10→1–6; P04→7/8/11; P02/P09→9–12; P05/P06→9/13; P07→14; P08→15. Os5 Review Focus têm testes nos respectivos Steps1.

Implementação será direta na sessão, preservando a preferência já informada; após aprovação do plano, usar executing-plans e sua verificação inicial. O plano não promete que todas as branches serão juntadas por um push; promete restaurar e demonstrar os comportamentos pretendidos antes da integração.

- [x] Spec aprovada pelo usuário antes de elaborar este plano.
- [x] Auto-revisão de cobertura, tipos/interfaces, testes, foco e proporção realizada.
- [ ] Usuário revisou/aprovou este plano escrito.
- [ ] Execução iniciada com baseline novo e ledger próprio.

Próximo gate: revisão do plano. Até lá, Tasks1–16 não foram executadas e nenhum comportamento foi declarado corrigido.
