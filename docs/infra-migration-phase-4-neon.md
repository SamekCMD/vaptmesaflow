# Fase 4 — Supabase PostgreSQL para Neon

Status em 24/09/2026: preparação local concluída; foi criado, ainda vazio, o projeto Neon `vapt-preview` na região AWS South America East 1 (São Paulo), ID `dawn-morning-27332079`. Nenhum schema ou dado foi aplicado, nenhuma connection string foi guardada e a aplicação não foi conectada ao Neon.

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

## Ruling operacional

- usar um único projeto Neon `vapt`, com branches separadas `production` e `preview`;
- executar o primeiro ensaio exclusivamente na branch `preview`;
- não usar Neon Managed Auth;
- não apontar frontend, API ou DNS de produção ao novo banco durante o ensaio;
- não reproduzir a cadeia `supabase/migrations` diretamente no Neon;
- preservar IDs de negócio e separar a futura migração de identidades da Fase 5 (Better Auth).

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
5. O frontend ainda acessa diretamente `restaurants`, `menu_items`, `menu_item_variations`, `table_sessions`, `orders` e `order_feedback` via Supabase. A API ainda usa `supabase-js` para tabelas e RPCs de pedidos, storage, webhooks e pagamentos.

## Artefatos exigidos antes do primeiro restore

- dump real de schema da origem, sem confiar apenas no histórico de migrations;
- dump de dados separado de objetos de auth/storage;
- schema Neon normalizado com apenas tabelas, constraints, indexes, funções e triggers necessários;
- mapa explícito de objetos removidos, adaptados ou preservados;
- consultas de validação de contagem, chaves estrangeiras, valores financeiros e ownership;
- relatório reversível do ensaio de restore.

Os binários `psql`, `pg_dump` e Docker não estão disponíveis neste host. Até a origem voltar a responder, o primeiro ensaio pode usar o SQL Editor do Neon para validar apenas o schema normalizado; o restore de dados exige uma ferramenta PostgreSQL confiável e conectividade com a origem.

## Sequência segura de preview

1. Renomear o projeto vazio `vapt-preview` para `vapt` e confirmar que a branch raiz se chama `production`.
2. Preparar o database de negócio `vapt` na raiz e criar a branch filha `preview` antes de qualquer carga.
3. Guardar cada connection string como segredo local/de CI, nunca no Git ou no frontend.
4. Restaurar o acesso somente leitura à origem Supabase e capturar schema, extensões, roles e contagens reais.
5. Gerar um schema Neon normalizado a partir do estado real, não por concatenação cega das migrations.
6. Aplicar o schema somente na branch `preview` e registrar cada incompatibilidade.
7. Importar uma cópia de dados de ensaio preservando UUIDs e sem expor dados pessoais desnecessários.
8. Validar tabelas, constraints, indexes, funções e amostras de relações multi-tenant.
9. Adaptar a API para PostgreSQL/Hyperdrive e mover os acessos diretos do frontend antes de qualquer cutover.
10. Repetir o ensaio com dados atualizados até obter paridade documentada; só então preparar `production`.

## Gates atuais

- autenticação humana será necessária novamente para renomear o projeto e criar a branch `preview`;
- origem Supabase atual indisponível nos testes de rede;
- ausência local de `psql`, `pg_dump` e Docker;
- frontend e API ainda dependem diretamente das APIs Supabase;
- migração de identidades e autorização será tratada separadamente com Better Auth.

Esses gates bloqueiam restore e cutover, mas não impedem preparar a topologia de branches nem o schema normalizado após o login.
