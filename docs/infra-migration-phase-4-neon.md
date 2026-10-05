# Fase 4 — Supabase PostgreSQL para Neon

Status em 27/09/2026: topologia Neon criada, baseline normalizado e schema
Better Auth validados em `preview.vapt` e promovidos sem dados para
`production.vapt`. O cutover local de dados de negócio está completo: frontend
e API usam contratos owner-scoped da API/Neon. Nenhum deploy ou troca de DNS foi
feito nesta etapa. O projeto se chama `vapt`, permanece na região AWS South
America East 1 (São Paulo), ID `dawn-morning-27332079`. Nenhuma connection
string foi versionada.

## Correção de arquitetura após revisão

O plano exige ambientes Neon separados para produção e preview/staging, mas não exige projetos Neon separados. A interpretação inicial de criar um projeto chamado `vapt-preview` foi excessiva.

A topologia adotada passa a ser:

```text
Projeto Neon: vapt
├── branch production   # raiz e futura fonte de verdade
└── branch preview      # ensaio isolado de schema, dados e API
```

- reutilizar e renomear o projeto vazio `vapt-preview` para `vapt`, em vez de criar outro projeto;
- manter a branch raiz `production` sem tráfego da aplicação até o cutover;
- criar uma branch filha `preview`, com connection string e compute próprios;
- usar o database de negócio `vapt` nas duas branches; se o console tiver criado apenas o database padrão `neondb`, criar ou renomear o database antes da primeira carga;
- apontar o Hyperdrive de preview somente para a branch `preview` e o de produção somente para `production`;
- considerar branches efêmeras por PR futuramente, como prevê o plano, sem torná-las requisito desta primeira migração;
- não copiar dados pessoais de produção para previews sem uma estratégia explícita de anonimização ou um conjunto de dados de ensaio.

Ruling: `Neon production` e `Neon preview/staging` no plano representam ambientes isolados. No Neon, branches dentro de um único projeto fornecem esse isolamento, mantêm schema/dados clonáveis e evitam duplicar a administração do projeto. Projetos separados ficam reservados para uma futura necessidade comprovada de isolamento de conta, região, quota ou compliance.

## Estado remoto verificado

```text
Projeto vapt (dawn-morning-27332079)
├── production (br-odd-term-b6j2n9ms, default)
│   ├── neondb       # database padrão preservado
│   └── vapt         # database de negócio vazio
└── preview (br-rough-dew-b6ydeygb, filha de production, sem expiração)
    ├── neondb       # herdado da raiz
    └── vapt         # herdado da raiz; alvo exclusivo do primeiro ensaio
```

- criação da branch confirmada pela console em 0,79 segundo;
- `preview` usa `production` como parent;
- `production` permanece a branch default;
- Better Auth/Neon Auth não foi ativado;
- a connection string mostrada pela console não foi revelada nem copiada;
- o database padrão `neondb` foi mantido para evitar uma exclusão desnecessária; o Vapt usará explicitamente o database `vapt`.

Antes do primeiro ensaio, uma consulta somente leitura executada no SQL Editor da branch `preview`, database `vapt`, confirmou:

```text
current_database()      = vapt
current_user            = neondb_owner
server_version          = 18.6
public.restaurants      = ausente
```

Isso confirmou conectividade e o estado vazio inicial. O baseline descrito abaixo foi aplicado depois dessa leitura, somente em `preview`.

## Primeiro baseline de preview aplicado

Em 25/09/2026 foram aplicados, nesta ordem, no database `vapt` da branch `preview`:

```text
infra/neon/001_business_schema.sql
infra/neon/002_business_routines.sql
```

O resultado atual do ensaio é:

```text
15 tabelas de negócio
12 funções
8 triggers
pgcrypto habilitado
RLS/policies Supabase ausentes
schemas auth/storage e publicação supabase_realtime ausentes
EXECUTE revogado de PUBLIC nas rotinas protegidas
```

As duas migrations são transacionais. A primeira cria o schema de negócio vazio; a segunda instala as rotinas e triggers normalizados. Os grants para uma role dedicada da API ficaram deliberadamente adiados até a criação da conexão Worker/Hyperdrive. A aplicação continua sem acesso a este banco.

Arquivos de validação executados no mesmo alvo:

```text
infra/neon/verify-baseline.sql
infra/neon/verify-routines.sql
infra/neon/verify-integrity.sql
infra/neon/smoke-preview.sql
```

Evidências do ensaio:

- `verify-baseline.sql` falhou antes da migration listando as 15 tabelas ausentes e passou depois da aplicação;
- `verify-routines.sql` falhou antes da migration listando as 12 rotinas ausentes e passou depois da aplicação;
- `verify-integrity.sql` passou validando database, colunas críticas, constraints, indexes, ausência de objetos Supabase, ACLs e configuração segura das rotinas;
- `smoke-preview.sql` passou dentro de `BEGIN`/`ROLLBACK`, exercitando pedido público, replay idempotente, pagamento, outbox e leases;
- uma leitura posterior confirmou zero restaurantes, pagamentos ou efeitos residuais do smoke;
- durante esse primeiro ensaio, nenhum comando foi executado na branch
  `production`; a promoção posterior está registrada na Fase 5.

Este baseline foi reconstruído a partir das migrations locais e dos consumidores atuais do frontend/API. O Vapt ainda não possui clientes nem dados de produção; contas e registros existentes eram somente testes. Por decisão explícita, não haverá restore da origem nem preservação de UUIDs, usuários, senhas ou sessões de teste. A promoção usará o schema versionado vazio e novos dados criados pela aplicação.

## Ruling operacional

- usar um único projeto Neon `vapt`, com branches separadas `production` e `preview`;
- executar o primeiro ensaio exclusivamente na branch `preview`;
- não usar Neon Managed Auth;
- não apontar frontend, API ou DNS de produção ao novo banco durante o ensaio;
- não reproduzir a cadeia `supabase/migrations` diretamente no Neon;
- não preservar IDs de negócio ou identidade de testes; a Fase 5 (Better Auth) começa com tabelas vazias e novos UUIDs.

## Inventário local

A cadeia atual contém:

- 23 arquivos de migration;
- 15 tabelas de negócio distintas;
- 12 funções PL/pgSQL distintas;
- 8 triggers declarados;
- dependências explícitas de `auth.uid()`, roles `anon`, `authenticated` e `service_role`;
- políticas RLS e guards baseados em `request.jwt.claim.role`;
- objetos próprios do Supabase Storage e da publicação `supabase_realtime`.

Tabelas de negócio observadas:

```text
restaurants
menu_items
menu_item_variations
table_sessions
orders
order_items
order_feedback
push_subscriptions
payment_provider_events
billing_provider_events
payment_provider_accounts
payment_transactions
payment_webhook_events
payment_oauth_states
payment_effect_outbox
```

Funções de negócio observadas:

```text
set_order_display_id
update_updated_at_column
get_public_restaurant_by_slug
create_public_order_v2
create_public_order_v3
apply_payment_transition
apply_payment_transition_v2
claim_payment_effects
complete_payment_effect
fail_payment_effect
release_paid_order_to_production
count_pending_payment_effects
```

## Por que o replay bruto está bloqueado

1. `20260403_create_order_feedback.sql` cria `order_feedback` antes da migration-base, mas a migration-base seguinte executa outro `CREATE TABLE` sem `IF NOT EXISTS` e com formato incompatível para `order_id`.
2. A migration-base escreve em `storage.buckets`, cria policies em `storage.objects` e altera a publicação `supabase_realtime`; esses objetos não existem no Neon e não pertencem ao schema de negócio.
3. Policies chamam `auth.uid()` e concedem privilégios a roles próprias do Supabase. Better Auth e a API Worker substituirão esse limite de confiança.
4. Funções de pedido e pagamento verificam ou concedem acesso a `service_role`; a autorização precisa ser adaptada para uma role interna da API, sem depender de claims PostgREST.
5. O replay histórico também carregaria contratos Supabase que já foram removidos do runtime. O frontend não acessa mais tabelas de negócio diretamente; a API runtime não usa `supabase-js`. A única dependência restante é o script offline e manual de inventário/cópia de imagens para R2.

## Artefatos exigidos antes da promoção

- schema Neon normalizado e versionado com apenas tabelas, constraints, indexes, funções e triggers necessários;
- migrations Better Auth versionadas e verificadas primeiro em `preview`;
- consultas de validação de chaves estrangeiras, valores financeiros, ownership e privilégios;
- smoke transacional com dados sintéticos e rollback;
- registro não secreto dos resultados de preview e production.

Não há restore de dados da origem nesta migração. `pg_dump`/`pg_restore` deixam de ser requisito porque não existe dado real a transportar. A promoção de schema continua exigindo uma conexão PostgreSQL direta e o mesmo SQL já ensaiado em `preview`.

## Sequência segura de preview

1. ~~Renomear o projeto vazio `vapt-preview` para `vapt` e confirmar que a branch raiz se chama `production`.~~ Concluído.
2. ~~Preparar o database de negócio `vapt` na raiz e criar a branch filha `preview` antes de qualquer carga.~~ Concluído.
3. Guardar cada connection string como segredo local/de CI, nunca no Git ou no frontend.
4. ~~Restaurar o acesso à origem Supabase e capturar dados reais.~~ Cancelado: não existem clientes/dados de produção e não serão preservados registros de teste.
5. ~~Gerar um schema Neon normalizado sem concatenação cega das migrations.~~ Concluído com `infra/neon/001_business_schema.sql` e `002_business_routines.sql`.
6. ~~Aplicar o schema somente na branch `preview` e registrar cada incompatibilidade.~~ Primeiro ensaio provisório concluído.
7. ~~Importar uma cópia de dados preservando UUIDs.~~ Cancelado; usar somente dados sintéticos descartáveis.
8. ~~Validar tabelas, constraints, indexes, funções e relações multi-tenant.~~ Estrutura e smoke sintético passaram; as suítes owner-scoped locais complementam essa evidência.
9. ~~Adaptar a API para PostgreSQL e mover os acessos diretos do frontend.~~ Cutover local concluído nas Tasks 1–9 do plano de dados; conexão/deploy remoto permanece separado.
10. ~~Aplicar em `production` somente o mesmo schema/migrations ensaiados em `preview`, seguido pelos mesmos verificadores e sem carga de dados legados.~~ Concluído em 27/09/2026.

## Gates atuais

- o gate local de acesso a dados de negócio está GREEN;
- `AuthContext`, Settings e os fluxos de verificação/reset usam Better Auth;
- a Neon CLI autenticada confirmou o projeto `vapt`, as branches
  `production`/`preview` em estado `ready` e o database `vapt` em ambas;
- os schemas de negócio e Better Auth foram validados primeiro em `preview` e
  os mesmos arquivos/hashes foram promovidos para `production`;
- os quatro verificadores passam nas duas branches;
- `preview` e `production` terminaram sem usuários ou dados sintéticos;
- conexão/deploy da API permanece uma etapa separada.

Não existe mais gate de restore da origem. A evidência detalhada do aceite Better
Auth, Resend e da promoção vazia está em
`docs/infra-migration-phase-5-better-auth.md`.

## Better Auth versionado

O schema do Better Auth foi gerado com o CLI fixado `auth@1.7.6` e a mesma configuração Kysely usada pelo runtime da API. O gerador consultou somente a branch `preview` para detectar o estado atual e não aplicou SQL.

Artefatos adicionados:

```text
infra/neon/003_better_auth_schema.sql
infra/neon/verify-better-auth.sql
```

A migration cria `better_auth.user`, `better_auth.session`, `better_auth.account` e `better_auth.verification` com IDs PostgreSQL `uuid`, mantém as FKs internas do Better Auth e revoga todos os privilégios de `PUBLIC` no schema, tabelas e sequências. Ela não cria FK entre `public.restaurants.owner_id` e `better_auth.user.id`; a API continua responsável pela ordem de criação e autorização entre identidade e negócio.

O verificador exige as quatro tabelas, IDs UUID compatíveis com
`public.restaurants.owner_id`, ausência de privilégios `PUBLIC` e ausência da FK
cruzada. A Task 9 aplicou e verificou o schema primeiro em `preview`; somente
depois do fluxo funcional e do envio real pelo Resend, promoveu o mesmo SQL
versionado para `production`, sem copiar identidades ou fixtures.

## Stripe billing versionado — Phase 7

`infra/neon/005_stripe_billing.sql` é a migration aditiva para o estado de
assinatura, Checkout pendente, claims com retry e `billing_email_outbox`.
O verificador `verify-stripe-billing.sql` exige as colunas, constraints, índices
parciais únicos e ausência de acesso PUBLIC à outbox. O lookup público de
restaurante permanece sem campos Stripe.

O verificador Stripe foi observado em RED antes da aplicação de `005` na
branch `preview`. A migration de SHA-256
`8a91fb9d530709d04682898734c83f08f5dec200904d948c7460d634a7a69c94`
foi aplicada com conexão direta; os cinco verificadores passaram. O smoke
transacional e o fluxo real Stripe Test Mode (Checkout, webhooks, Portal,
cancelamento ao fim do período e limpeza) passaram. As tabelas de Auth,
restaurantes, eventos e outbox em preview terminaram com zero linhas. A
evidência não secreta e os IDs dos recursos de teste estão no relatório da
Phase 7. A Task 10 promoveu o mesmo hash para `production` após observar o
verificador em RED e confirmar a branch vazia. Os cinco verificadores passam
em ambas as branches e as sete tabelas contadas de Auth, negócio e billing
terminaram com zero linhas em cada uma. Nenhuma identidade, Customer ou evento
sintético foi copiado. A outbox guarda intents de email; a entrega por
Queue/Resend pertence à fase seguinte.

## Role limitada da API Worker — Stage 10 preview

Em 30/09/2026, somente na branch `preview` (`br-rough-dew-b6ydeygb`) do
projeto `dawn-morning-27332079`, database `vapt`, foi criada a role de login
`vapt_api_preview` sem `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`,
`BYPASSRLS` ou membership herdado. A criação inicial pelo console do Neon
atribuiu privilégios administrativos indevidos; essa role, ainda sem objetos
ou grants da aplicação, foi excluída e recriada por SQL antes do uso.

`infra/neon/006_worker_preview_role_grants.sql` foi aplicado apenas em
`preview.vapt`. `infra/neon/verify-worker-preview-role.sql` passou tanto como
`neondb_owner` quanto em conexão direta autenticada como `vapt_api_preview`.
Nessa conexão restrita, `INSERT`, `SELECT`, `UPDATE` e `DELETE` em
`better_auth.verification` passaram dentro de uma transação revertida; a
ausência da linha sintética foi confirmada depois. `CREATE TABLE` no schema
`public`, `CREATE SCHEMA` e leitura de `public.payment_provider_events` foram
negados com SQLSTATE `42501`. A função permitida
`public.count_pending_payment_effects()` pôde ser executada. Uma consulta
somente leitura em `production.vapt` (`br-odd-term-b6j2n9ms`) confirmou que
`vapt_api_preview` não existe naquela branch.

A senha usada nesse ensaio foi gerada no Postgres e sua cópia em memória foi
descartada ao final do processo de verificação. Antes de criar o Hyperdrive de
preview, ela deverá ser rotacionada novamente e entregue diretamente ao
provisionamento, sem URI ou senha em Git, histórico de shell ou logs. Nesse
momento do ensaio, ainda não havia binding Hyperdrive nem tráfego da aplicação
para essa role.

## Aceite do Hyperdrive em preview — Stage 10

Após a validação da role, o Hyperdrive `vapt-api-neon-preview`
(`0c05fec2924b4f3b9225f3d689ba7ea9`) foi criado na conta Cloudflare
`3ce69408aa5112617a282957aba71932`, com cache desativado e limite de cinco
conexões de origem. A leitura posterior da configuração confirmou o endpoint
Neon direto `ep-hidden-bird-b673zocn.c-2.sa-east-1.aws.neon.tech`, database
`vapt` e usuário `vapt_api_preview`. A senha foi rotacionada em memória e
enviada somente à API Cloudflare; seu valor não foi versionado nem registrado.

Um Worker diagnóstico temporário executado por `wrangler dev --remote` comprovou
consulta parametrizada, rollback, commit/leitura/limpeza, sessão Better Auth
entre invocações, revogação, cinco chamadas seriais e três concorrentes, além
de um único passe de reconciliação com outbox vazia. A auditoria final confirmou
zero registros sintéticos restantes e ausência da role preview na branch
`production`. O handoff técnico completo está no repositório da API em
`docs/infra-migration-phase-10-hyperdrive-neon-preview.md`. Coolify permanece
servindo a API; não houve cutover de tráfego, rota pública ou Cron nesta etapa.

## Stage 11 — role production preparada (05/10/2026)

Role `vapt_api_production` criada somente em `br-odd-term-b6j2n9ms`, database
`vapt`, endpoint direto `ep-holy-wildflower-b6vtv1dd.c-2.sa-east-1.aws.neon.tech`.
Os grants de `007_worker_production_role_grants.sql` espelham exatamente a
allowlist Preview. A senha foi gerada e mantida apenas em memória/credencial
PostgreSQL, sem arquivo, Git ou saída de logs.

`verify-worker-production-role.sql` foi escrito antes da criação e falhou
com role ausente (RED). Depois passou como owner e como login restrito (GREEN):
sem atributos admin, memberships herdados, ownership ou CREATE; DML/funções
allowlisted presentes; tabelas/função legada excluídas continuam negadas.
Os cinco verificadores de schema e o ACL passaram como owner. Como role
restrita, ACL, CRUD Better Auth e `count_pending_payment_effects()` passaram;
as escritas foram revertidas. DDL, leitura/grant da outbox excluída, mudança
de ownership e chamada de função não autorizada retornaram SQLSTATE `42501`.

Ruling: verificadores de schema ficam no owner e testes ACL/CRUD/negação no
login restrito. `verify-integrity.sql` usa `information_schema.columns`, que
oculta a tabela outbox proibida desse login; não se concede SELECT para tornar
essa verificação verde. Custo da decisão: garantia de schema via catálogo
permanece owner-only, com acesso real da aplicação verificado separadamente.

Produção permaneceu com zero usuários, restaurantes, pedidos e outboxes, sem
role Preview. Preview permaneceu sem role production e sem resíduos da Task 6.
Nenhuma identidade/UUID de testes foi copiada. Hyperdrive production ainda
pertence ao gate seguinte e não foi adicionado a configuração, binding ou
tráfego. Não houve mudança de DNS, Cron, consumer ou plano pago.

## Stage 11 — Hyperdrive production preparado (05/10/2026)

`vapt-api-neon-production` / `2885c609a66641b3b716190c2d467902` criado para
o endpoint direto de production acima, database `vapt`, role
`vapt_api_production`, cache desativado e limite cinco. Senha rotacionada em
memória e enviada somente no campo write-only Cloudflare; nenhum URI/segredo
foi versionado. TLS padrão `require`/WebPKI mantido; `verify-full` opcional
requer CA customizada e não foi aplicado. Ver
[documentação TLS Hyperdrive](https://developers.cloudflare.com/hyperdrive/configuration/tls-ssl-certificates-for-hyperdrive/).

O ID permanece sem binding em qualquer configuração/Worker. Shell production
`ce6f3919` continua sem bindings, URL de produção, Cron ou custom domains.
Preview final `9d020e2c-13b8-490c-be9f-5a5223ff18305` usa apenas a role,
Hyperdrive e R2 Preview. Probe final confirmou `vapt_api_preview`; production
ACL/login, rollback CRUD/função e cinco negações `42501` foram repetidos após
rotação da senha. Duas branches continuam sem fixtures/dados/outboxes e com
roles isoladas. Nenhum plano pago, cutover ou cópia de UUID foi realizado.

Preview passou auth/session/logout, ownership/CRUD, pedidos concorrentes e
R2 assinado com restrições/expiração. Stripe Test passou checkout/replay e
webhook de expiração assinado pelo operador com uma única redução de estado;
sessão expirada e cliente/eventos/objetos de teste limpos, sem pagamento.
Isso não prova entrega originada pela Stripe ou ciclo de assinatura completo.
Paridade Coolify ficou não comprovada por indisponibilidade de transporte.
Gates frontend/cutover permanecem nas Stages 12/13.

API 450/450, workerd 15/15, build, dois dry-runs e varredura de 510 arquivos
versionados sem correspondência aos segredos passaram. A cópia de OAuth que
`wrangler auth token` gravou em debug log local foi identificada e removida
por caminho exato; nenhum valor foi mostrado. Capturas futuras devem desativar
`WRANGLER_WRITE_LOGS` antes do comando. Nenhuma credencial dos Workers billing
existentes foi alterada. Handoff completo na API:
`docs/infra-migration-phase-11-api-parallel.md`.
