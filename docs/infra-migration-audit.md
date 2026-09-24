# Auditoria técnica da migração de infraestrutura do Vapt

Data da auditoria: 2026-09-24  
Plano canônico: docs/infra-migration-plan.md  
SHA-256 do plano: 8A86DE9DB0D2476E9AD4DD58C1DD5B1FF525F990B61CEA2B25E63C5FBE21401D

## 1. Escopo, evidências e limites

Esta é a Etapa 0 do plano. Nenhuma infraestrutura externa foi criada, alterada ou desligada.

Evidências auditadas:

- frontend em D:\Projetos\vaptmesaflow, branch codex/multitenant-onboarding, commit 422ef9c1f3aad91563b06160ef043710b97132ed;
- API em D:\Projetos\vaptmesaflow\vapt-api, branch main, commit cebaed423504f2353b0bdc1a44188d932b0a75ca;
- código, manifests, migrations, testes, Dockerfile, configuração Vercel, exemplos de variáveis, documentação e exports n8n versionados nos dois repositórios;
- documentação oficial atual de Cloudflare Workers, Static Assets, Hyperdrive, Neon e Queues, além da documentação do Better Auth.

Limites desta auditoria:

- nenhum dashboard de Cloudflare, Vercel, Hetzner, EasyPanel/Coolify, Neon, Supabase, Stripe, Mercado Pago, Resend ou n8n foi acessado;
- os exports n8n foram auditados, mas não foi possível confirmar se são idênticos aos workflows atualmente publicados nem se contêm todas as credenciais/configurações aplicadas no dashboard;
- nenhum banco, bucket, webhook, DNS, log ou tráfego de produção foi consultado;
- valores dos arquivos locais de ambiente não foram lidos ou registrados; apenas os nomes das variáveis foram inventariados;
- o estado real do PostgreSQL pode conter objetos, dados ou migrations aplicadas fora do repositório;
- o uso real de MinIO não aparece no código e precisa ser confirmado na VPS/dashboard.

Conclusão de escopo: o relatório é suficiente para iniciar a fundação e os dry-runs, mas dump do banco, inventário dos objetos, paridade dos workflows n8n publicados, configuração de DNS/webhooks e cutover exigem validação externa posterior.

## 2. Resumo executivo

O frontend é uma SPA React 18 + Vite 5, e a API é Fastify 5 + Node/TypeScript em Docker. Ambos têm baseline verde.

Os principais achados são:

1. O frontend acessa diretamente Supabase Auth, PostgREST, RLS e Storage. Portanto, migrar apenas o PostgreSQL para Neon quebraria login e grande parte do produto.
2. A API também usa supabase-js com service role. Ela não possui driver PostgreSQL/ORM e não pode apontar esse cliente diretamente para Neon/Hyperdrive.
3. O Stripe está apenas parcialmente dentro da API: rotas, autenticação, validação, assinatura do webhook e idempotência de entrada estão na API, mas as operações de assinatura e o processamento final dos webhooks são encaminhados ao n8n.
4. Os exports versionados de Stripe e Ingest ainda leem/escrevem Supabase diretamente; o export Asaas também contém nós Supabase. Esses consumidores são bloqueadores adicionais do cutover para Neon até serem migrados, adaptados ou comprovadamente aposentados.
5. Não há Resend no código atual.
6. Não há cliente MinIO/S3 no código. O storage observado é Supabase Storage, bucket público menu-images, usado diretamente pelo frontend.
7. Não há uso de Supabase Realtime, WebSocket ou canais no código atual. O comportamento “realtime” é polling de 4 a 8 segundos.
8. A API contém um reconciliador com setInterval e estado de rate limit em memória. Ambos precisam ser adaptados para execução distribuída em Workers.
9. Há uma integração robusta e ativa com Mercado Pago para pagamentos de pedidos. Ela não pode ser removida ou confundida com o billing SaaS do Stripe.
10. As migrations dependem de primitivas Supabase, como auth.uid(), papéis anon/authenticated/service_role, storage.* e, historicamente, request.jwt.claim.role.
11. A cadeia de migrations precisa ser validada em banco vazio: order_feedback é criada em duas migrations, e os tipos gerados do frontend estão atrasados em relação às migrations e à API.
12. A instalação não está totalmente reproduzível: package.json e package-lock.json do frontend divergem para supabase-js, e dependências resolvidas da API exigem Node 20 apesar do Dockerfile usar Node 18.

### Decisão de sequência

O plano autoriza alterar a ordem quando a auditoria encontra impedimento. Foi encontrado um impedimento real no cutover do banco:

- Neon pode ser criado e receber um restore de ensaio na fase originalmente prevista;
- o cutover de produção para Neon só pode acontecer depois que o acesso direto do frontend e de todos os workflows n8n a Supabase, além das dependências de auth/RLS/service_role, estiver substituído, adaptado ou comprovadamente aposentado;
- até lá, Supabase self-hosted continua sendo a fonte operacional.

## 3. Árvore relevante dos dois repositórios

### Frontend

~~~text
vaptmesaflow/
├── src/
│   ├── App.tsx
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   └── RestaurantContext.tsx
│   ├── integrations/supabase/
│   │   ├── client.ts
│   │   └── types.ts
│   ├── lib/
│   │   ├── env.ts
│   │   ├── supabase.ts
│   │   ├── vapt-api-client.ts
│   │   ├── n8n-client.ts
│   │   ├── order-client.ts
│   │   ├── payment-client.ts
│   │   ├── order-feedback.ts
│   │   ├── push-notifications.ts
│   │   └── restaurants.ts
│   ├── pages/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── delivery/
│   │   ├── menu/
│   │   ├── onboarding/
│   │   └── payment/
│   └── test/
├── public/
│   └── sw.js
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── tests/
├── docs/
│   ├── integrations/n8n/
│   │   ├── README.md
│   │   ├── asaas/Vapt Asaas.json
│   │   ├── ingest/Vapt Ingest.json
│   │   └── stripe/Vapt Stripe.json
│   ├── infra-migration-plan.md
│   └── infra-migration-audit.md
├── package.json
├── vite.config.ts
├── vitest.config.ts
└── vercel.json
~~~

### API

~~~text
vapt-api/
├── src/
│   ├── server.ts
│   ├── app.ts
│   ├── lib/
│   │   ├── config.ts
│   │   ├── supabase.ts
│   │   ├── jwt.ts
│   │   ├── crypto.ts
│   │   └── permissions.ts
│   ├── plugins/
│   │   ├── auth.ts
│   │   ├── cors.ts
│   │   ├── raw-body.ts
│   │   ├── rate-limit.ts
│   │   └── error-handler.ts
│   └── modules/
│       ├── auth/
│       ├── billing/stripe/
│       ├── health/
│       ├── ingest/
│       ├── n8n/
│       ├── orders/
│       ├── payments/
│       └── webhooks/
├── scripts/
├── docs/
├── .github/workflows/blank.yml
├── Dockerfile
├── package.json
└── tsconfig.json
~~~

Os dois diretórios são Git roots independentes. A pasta vapt-api é ignorada pelo repositório pai e não é submodule.

## 4. Frameworks, versões e build

### Frontend

Versões declaradas no package.json / resolvidas no package-lock.json:

- React ^18.3.1 / 18.3.1;
- React Router ^6.30.1 / 6.30.1;
- Vite ^5.4.19 / 5.4.19;
- TypeScript ^5.8.3 / 5.8.3;
- Vitest ^3.2.4 / 3.2.4;
- Supabase JS ^2.101.1 / 2.95.3, divergência que exige normalização do lockfile antes do CI;
- Stripe React/JS presentes no bundle;
- build: npm run build;
- output padrão observado: dist;
- deploy atual indicado por vercel.json com rewrite SPA para index.html;
- não há pipeline CI/CD do frontend no repositório.

O frontend é compatível com Workers Static Assets com baixo esforço. É necessário configurar dist e fallback SPA equivalente ao rewrite da Vercel.

### API

Versões declaradas no package.json / resolvidas no package-lock.json:

- Fastify ^5.2.1 / 5.8.4;
- TypeScript ^5.8.3 / 5.9.3;
- Node declarado como maior ou igual a 18;
- Supabase JS ^2.57.4 / 2.103.0;
- Zod ^4.1.12 / 4.3.6;
- build: npm run build;
- start atual: node dist/server.js;
- runtime atual: imagem node:18-alpine em dois estágios;
- deploy documentado: EasyPanel usando Dockerfile;
- workflow GitHub Actions atual é apenas o template “Hello, world!” e não valida nem publica a API.

O lock da API resolve supabase-js 2.103.0, find-my-way 9.5.0 e thread-stream 4.0.0, cujos engines exigem Node 20 ou superior. O build/test local foi executado com Node 24.13.0; portanto, o baseline verde não valida a imagem node:18-alpine. A imagem e o campo engines precisam ser alinhados antes de um deploy reproduzível.

O plano menciona Coolify, enquanto o README da API menciona EasyPanel. Isso precisa ser confirmado no ambiente real antes do desligamento da VPS.

### Baseline executado

- frontend: 17 arquivos de teste, 61 testes, todos passando;
- API: 24 arquivos de teste, 201 testes, todos passando;
- build frontend: aprovado;
- build API: aprovado;
- observação do build frontend: banco Browserslist/caniuse-lite está desatualizado, sem bloquear o build.

Verificação de instalação limpa:

- API: npm ci --dry-run aprovado no ambiente local;
- frontend: o package-lock registra supabase-js ^2.95.3 na raiz e resolve 2.95.3, enquanto package.json requer ^2.101.1; a tentativa de npm ci --dry-run ficou bloqueada pelo cache de rede do sandbox antes de validar a instalação. O desalinhamento é objetivo e deve ser corrigido, seguido de npm ci em CI limpo.

## 5. Como o frontend chama a API

O frontend usa VITE_VAPT_API_BASE_URL e dois wrappers:

- src/lib/vapt-api-client.ts para pedidos e pagamentos operacionais;
- src/lib/n8n-client.ts, cujo nome é legado: ele chama a vapt-api, e a API é que encaminha certas operações ao n8n.

Autenticação atual das chamadas:

- o frontend obtém o access token com supabase.auth.getSession();
- envia Authorization: Bearer para rotas protegidas;
- a API valida localmente JWT HS256 usando SUPABASE_JWT_SECRET.

Chamadas públicas usam tokens específicos e idempotência:

- criação de pedido usa Idempotency-Key;
- leitura de pedido usa X-Vapt-Order-Token;
- checkout hospedado também usa ambos.

O emparelhamento automático de previews frontend/API não existe no repositório. Hoje há suporte especial apenas para wildcards de previews Vercel no CORS e nos redirects do Mercado Pago.

## 6. Auth atual

### Frontend

Supabase Auth é a implementação completa atual:

- getSession e onAuthStateChange;
- signUp com full_name, emailRedirectTo e token Turnstile opcional;
- signInWithPassword;
- signOut;
- updateUser para nome e troca de senha;
- persistência da sessão no navegador com storage key vapt-auth-v1.

Não foi encontrado fluxo de “esqueci minha senha” no frontend. A confirmação de e-mail depende da configuração externa do Supabase.

### API

- valida JWT Supabase com HMAC SHA-256 e SUPABASE_JWT_SECRET;
- extrai sub, email e role;
- verifica ownership consultando restaurants.owner_id via cliente admin;
- não cria usuários nem sessões;
- não há cookies de sessão na API hoje.

O SUPABASE_JWT_SECRET também é reutilizado pela API como chave HMAC para gerar o publicToken determinístico de pedidos a partir do fingerprint e da Idempotency-Key. Essa é uma responsabilidade distinta de autenticação: trocar o segredo durante a migração pode fazer um replay idempotente retornar um token diferente daquele cujo hash já está persistido, quebrando acompanhamento e checkout do pedido.

### Impacto Better Auth

Classificação: REPLACE, preservando contratos de produto.

É necessário:

- criar tabelas Better Auth no Neon;
- decidir como preservar os UUIDs existentes ou criar tabela explícita de mapeamento entre usuário Supabase e usuário Better Auth;
- adaptar restaurants.owner_id, payment_transactions.manually_confirmed_by e toda autorização baseada no sub atual;
- substituir Bearer JWT Supabase no frontend/API por sessão Better Auth;
- introduzir um segredo próprio e estável para tokens públicos de pedido, com estratégia de transição compatível com tokens já emitidos e teste de replay entre API antiga e nova;
- reimplementar signup, login, logout, atualização de perfil, troca de senha, verificação e reset;
- manter Turnstile ou proteção equivalente;
- configurar base URL, trusted origins, callbacks e cookies por ambiente/preview;
- decidir a estratégia para senhas existentes após validar compatibilidade de hashes. Caso não seja segura/compatível, exigir reset controlado.

Não há foreign key do repositório para auth.users; owner_id é UUID e as policies usam auth.uid(). Isso facilita preservar os IDs, mas não elimina a necessidade de migrar as identidades.

## 7. Acesso ao banco hoje

### Frontend direto

O frontend acessa diretamente, via Supabase PostgREST:

- restaurants;
- menu_items;
- menu_item_variations;
- table_sessions;
- orders;
- order_feedback.

Também faz mutações diretas de restaurante, cardápio, sessões e status de pedidos.

### API

A API usa supabase-js com SUPABASE_SERVICE_ROLE_KEY e acessa:

- restaurants;
- orders;
- billing_provider_events;
- payment_provider_accounts;
- payment_transactions;
- payment_webhook_events;
- payment_oauth_states;
- várias funções RPC de pedidos e pagamentos.

### n8n direto

Os exports versionados confirmam outros leitores/escritores fora da API:

- Vapt Stripe usa credencial Supabase, grava billing_provider_events via PostgREST e atualiza restaurants com nós Supabase;
- Vapt Ingest grava push_subscriptions e order_feedback via PostgREST;
- Vapt Asaas contém nós Supabase e persiste payment_provider_events/estado de pedidos segundo sua documentação, embora as rotas Asaas da API estejam aposentadas.

O estado publicado desses workflows não foi consultado. Antes do cutover, cada fluxo precisa ser classificado como ativo, migrado/adaptado para a nova camada PostgreSQL/API ou formalmente aposentado. Não pode restar leitor ou escritor operacional apontando apenas para o Supabase antigo.

Não há ORM/query builder nem driver PostgreSQL no package.json.

### Impacto Neon + Hyperdrive

Classificação: REPLACE para o transporte de dados, KEEP para regras/repositórios e SQL de domínio.

- supabase-js/PostgREST não pode simplesmente apontar para o Neon;
- os repositórios da API precisam receber uma implementação PostgreSQL usando pg ou Postgres.js via Hyperdrive;
- a documentação atual da Cloudflare recomenda pg para Hyperdrive e Neon;
- cada request deve abrir/fechar seu Client; o pooling é responsabilidade do Hyperdrive;
- o frontend não deve receber credenciais de banco nem usar Hyperdrive diretamente;
- toda operação frontend hoje feita por PostgREST precisa migrar para endpoints da API ou para uma camada compatível explicitamente mantida durante a transição.

## 8. Banco: tabelas, funções, triggers e dependências Supabase

### Tabelas observadas nas migrations

Domínio principal:

- restaurants;
- menu_items;
- menu_item_variations;
- table_sessions;
- orders;
- order_items;
- order_feedback;
- push_subscriptions.

Billing e pagamentos:

- payment_provider_events;
- billing_provider_events;
- payment_provider_accounts;
- payment_transactions;
- payment_webhook_events;
- payment_oauth_states;
- payment_effect_outbox.

### Funções/RPCs observadas

- set_order_display_id;
- update_updated_at_column;
- get_public_restaurant_by_slug;
- create_public_order_v2;
- create_public_order_v3;
- apply_payment_transition;
- apply_payment_transition_v2;
- claim_payment_effects;
- complete_payment_effect;
- fail_payment_effect;
- release_paid_order_to_production;
- count_pending_payment_effects.

### Triggers observados

- trg_set_order_display_id;
- update_restaurants_updated_at;
- update_menu_items_updated_at;
- update_orders_updated_at;
- update_payment_provider_accounts_updated_at;
- update_payment_transactions_updated_at;
- update_payment_webhook_events_updated_at;
- update_payment_effect_outbox_updated_at.

### Índices críticos observados

- unicidade de slug de restaurante;
- unicidade de endpoint de push;
- unicidade de evento externo por provider;
- idempotência de criação de pedido por restaurante;
- idempotência de transação por restaurante;
- unicidade de pagamento externo por provider;
- lookup do token público de pedido;
- índices de efeitos pendentes/leases;
- proteção contra mais de um pagamento manual ativo por pedido.

### Dependências específicas do Supabase

- policies usam auth.uid();
- grants/revokes usam anon, authenticated e service_role;
- migrations históricas configuram/verificam request.jwt.claim.role;
- storage.buckets e storage.objects;
- publicação supabase_realtime;
- cliente PostgREST e service role.

Esses elementos são ADAPT/REPLACE. O SQL de domínio, constraints, índices e transações é majoritariamente KEEP.

### RLS

As tabelas principais possuem RLS. As tabelas V2 de pagamento usam RLS forçada e grants somente ao service_role. Ao migrar para Neon:

- definir papéis PostgreSQL explícitos para aplicação/migration/readonly;
- mover a autorização de tenant para a API e manter constraints de tenant no banco;
- não copiar policies auth.uid() como se fossem funcionais no Neon;
- não conceder acesso direto do frontend ao banco;
- manter funções SECURITY DEFINER apenas após revisão de search_path, grants e chamador.

### Inconsistências que bloqueiam migração cega

1. order_feedback é criada por 20260403_create_order_feedback.sql e novamente, sem IF NOT EXISTS, pelo bootstrap 20260404021925. A cadeia precisa ser testada do zero e normalizada antes de ser adotada como mecanismo de criação do Neon.
2. src/integrations/supabase/types.ts não contém todas as tabelas/funções mais recentes usadas pela API, incluindo billing_provider_events, push_subscriptions, create_public_order_v3 e apply_payment_transition_v2.
3. Não há CREATE EXTENSION versionado. É obrigatório inventariar pg_extension no banco real antes do restore.
4. Não há dump versionado dos schemas auth e storage. Eles devem ser tratados separadamente, conforme o plano.
5. O estado final versionado de create_public_order_v2, após a recriação em 20260808120000, não contém mais o guard request.jwt.claim.role, mas continua com EXECUTE revogado de public/anon/authenticated e concedido a service_role. A história contém guard/configuração do claim, e o banco real pode divergir; grants, roles e definição efetivamente aplicada precisam ser inventariados antes da conversão.

## 9. Storage e MinIO

### Uso encontrado

Não foi encontrado cliente MinIO, S3 ou AWS SDK nos dois repositórios.

O storage em código é Supabase Storage:

- bucket público menu-images;
- chave de objeto no formato restaurantId/itemId;
- resize no navegador para JPEG;
- upload, overwrite e delete diretamente pelo frontend;
- URL pública construída manualmente como SUPABASE_URL/storage/v1/object/public/menu-images/path;
- menu_items.image_url persiste a URL completa.

Logo de restaurante é salvo como URL em restaurants.logo_url, mas não foi encontrado upload dedicado para logo.

### Migração R2

Classificação: REPLACE.

- criar vapt-assets-preview e vapt-assets-production;
- inventariar objetos reais de Supabase Storage e qualquer MinIO existente na VPS;
- preservar key, tamanho, MIME, ETag/hash e metadata relevante;
- decidir URL canônica estável, preferencialmente sob domínio controlado;
- manter compatibilidade para URLs antigas armazenadas em menu_items.image_url;
- mover upload/delete do navegador para API assinada ou endpoint autorizado; o frontend não deve receber segredo R2;
- somente colocar origem antiga em read-only após comparação completa.

## 10. Stripe e billing SaaS

### Estado atual

O frontend possui Stripe.js e telas de assinatura.

A API expõe:

- POST /billing/stripe/checkout;
- POST /billing/stripe/subscription/change;
- POST /billing/stripe/subscription/cancel;
- GET /billing/stripe/subscription;
- POST /webhooks/stripe.

O que já está na API:

- autenticação e autorização por restaurante;
- validação de request;
- verificação manual da assinatura Stripe;
- tolerância temporal;
- reserva idempotente em billing_provider_events;
- marcação de processado ou pending_retry.

O que permanece no n8n:

- criar assinatura/checkout;
- alterar assinatura;
- cancelar assinatura;
- consultar estado;
- processamento final do webhook Stripe.

O export Vapt Stripe usa Supabase como fonte persistida de billing: grava billing_provider_events por REST e atualiza restaurants. Logo, não basta trocar o encaminhamento HTTP da API; as operações de dados do workflow também precisam sair do Supabase antigo antes do cutover.

### Limitação de retry observada

reserveBillingEvent trata qualquer conflito de unicidade como duplicado. handleStripeWebhook então responde como sucesso e não reencaminha o evento, inclusive quando o registro anterior está marcado pending_retry após falha do n8n. O reconciliador existente é do domínio de pagamentos de pedidos e não recupera esses eventos de billing.

Antes de consolidar Stripe, é obrigatório definir recuperação dos eventos pending_retry e testar o caminho falha → retry → processed sem aplicar o mesmo evento duas vezes.

Não existe dependência stripe-node nem STRIPE_SECRET_KEY na API.

### Classificação

- contratos HTTP e testes: KEEP;
- serviço de billing: ADAPT;
- n8n como executor do Stripe: REPLACE;
- idempotência persistida: KEEP, corrigindo a recuperação de pending_retry;
- verificador manual: pode ser KEEP inicialmente, mas o SDK oficial deve ser tentado primeiro conforme o plano.

O estado final deve manter billing SaaS separado dos pagamentos de pedidos do Mercado Pago.

## 11. Mercado Pago e pagamentos de pedidos

Integração ativa e extensa, ausente do diagrama principal do plano, mas protegida pela regra de preservar funcionalidade:

- OAuth por restaurante e por ambiente;
- tokens criptografados com AES-256-GCM;
- checkout hospedado;
- webhook assinado e rota de compatibilidade;
- reconciliação de retorno;
- idempotência e state machine;
- pagamentos manuais;
- outbox de efeitos;
- diagnóstico sandbox;
- testes de tenant isolation e concorrência.

Classificação: KEEP/ADAPT para Workers e Hyperdrive.

Não remover tabelas payment_* nem rotas Mercado Pago durante a migração do Stripe. “Stripe billing” e “pagamento do pedido” são domínios diferentes no estado atual.

## 12. Resend e e-mail

Não há referência a Resend, serviço de e-mail, template ID ou envio de e-mail nos dois repositórios.

Classificação: NEW.

Antes da implementação:

- inventariar no dashboard Resend os templates existentes e seus IDs/variáveis;
- definir IDs por ambiente;
- confirmar domínios/remetentes;
- não copiar HTML para o repositório;
- definir deduplicação por evento de billing;
- auth pode enviar de forma direta/background; billing deve usar Queue.

## 13. Realtime atual

Não foi encontrado:

- supabase.channel;
- postgres_changes;
- WebSocket;
- cliente de Supabase Realtime.

Comportamento atual:

- cozinha consulta pedidos a cada 5 segundos;
- caixa consulta sessões/pedidos a cada 5 segundos;
- cardápio atualiza disponibilidade a cada 8 segundos;
- acompanhamento de pedido usa polling de 4, 5 ou 8 segundos dependendo da tela;
- migration antiga adiciona orders à publicação supabase_realtime, mas o frontend não consome essa publicação.

Classificação:

- polling atual: KEEP temporário durante o cutover;
- Durable Objects/WebSocket: NEW/REPLACE posterior, não uma simples troca de SDK;
- Neon permanece fonte de verdade.

O primeiro cutover da API não precisa depender de Durable Objects para preservar o comportamento atual. A migração realtime pode ocorrer após API/DB estáveis, como definido no plano.

## 14. Rotas críticas da API

| Método | Rota | Proteção/observação |
|---|---|---|
| GET | /health | pública |
| GET | /health/ready | pública; hoje inclui snapshot do reconciliador em memória |
| GET | /auth/me | Bearer Supabase |
| GET | /auth/restaurants/:restaurantId/access | Bearer + ownership |
| POST | /billing/stripe/checkout | Bearer + ownership; encaminha ao n8n |
| POST | /billing/stripe/subscription/change | Bearer + ownership; encaminha ao n8n |
| POST | /billing/stripe/subscription/cancel | Bearer + ownership; encaminha ao n8n |
| GET | /billing/stripe/subscription | Bearer + ownership; encaminha ao n8n |
| POST | /webhooks/stripe | assinatura Stripe + idempotência; encaminha ao n8n |
| POST | /public/orders | pública; Idempotency-Key |
| GET | /public/orders/:orderId | pública; X-Vapt-Order-Token |
| POST | /orders/:orderId/payments/manual-confirmation | Bearer + tenant |
| POST | /public/orders/:orderId/payments/checkout | token público + idempotência |
| GET | /public/orders/:orderId/payments/:transactionId/diagnostics | sandbox/token público |
| GET | /payments/mercado-pago/return | relay/reconciliação |
| POST | /webhooks/payments/mercado-pago | webhook canônico |
| POST | /payments/mercado-pago/webhook | compatibilidade |
| POST | /restaurants/:restaurantId/payments/mercado-pago/connect | Bearer + tenant |
| GET | /payments/mercado-pago/oauth/callback | callback OAuth |
| GET | /restaurants/:restaurantId/payments/mercado-pago/status | Bearer + tenant |
| DELETE | /restaurants/:restaurantId/payments/mercado-pago/connection | Bearer + tenant |
| POST | /admin/payments/effects/reprocess | x-vapt-admin-key |
| POST | /ingest/order-feedback | pública; encaminha ao n8n |
| POST | /ingest/push-subscription | Bearer; encaminha ao n8n |

Os nomes e contratos devem ser preservados durante a mudança de runtime.

### Rotas críticas do frontend

| Rota | Proteção/observação |
|---|---|
| / | pública; landing page |
| /login | pública; Supabase Auth atual |
| /signup | pública; confirmação usa window.location.origin |
| /pricing | pública |
| /onboarding | protegida |
| /dashboard | protegida; layout com Overview |
| /dashboard/menu | protegida |
| /dashboard/kitchen | protegida |
| /dashboard/settings | protegida |
| /dashboard/appearance | protegida |
| /dashboard/whatsapp | redirect interno para /dashboard |
| /dashboard/cashier | protegida |
| /dashboard/subscription | protegida; billing Stripe |
| /menu/:slug | pública; pedidos locais |
| /delivery/:slug | pública; pedidos delivery |
| /payment/return | pública; retorno Mercado Pago, consulta status e volta ao returnPath local salvo |
| * | página 404 |

Workers Static Assets precisa manter fallback SPA para todas essas rotas. O relay da API em GET /payments/mercado-pago/return redireciona para /payment/return na origem permitida; MERCADO_PAGO_REDIRECT_URI precisa continuar na origem de API e FRONTEND_URL/CORS precisam aceitar a origem correta de cada ambiente. Não foi encontrada rota de callback Stripe separada no frontend atual.

## 15. Variáveis de ambiente

### Frontend versionadas/documentadas

- VITE_SUPABASE_URL;
- VITE_SUPABASE_ANON_KEY;
- VITE_STRIPE_PUBLISHABLE_KEY;
- VITE_STRIPE_PRICE_STARTER;
- VITE_STRIPE_PRICE_PRO;
- VITE_STRIPE_PRICE_BUSINESS;
- VITE_VAPT_API_BASE_URL;
- VITE_PAYMENT_ENVIRONMENT;
- VITE_VAPID_PUBLIC_KEY;
- VITE_TURNSTILE_ENABLED;
- VITE_TURNSTILE_SITE_KEY.

Arquivos locais também contêm nomes VITE_N8N_CHECKOUT_WEBHOOK_URL, VITE_N8N_WEBHOOK_URL e VITE_PUSH_SUBSCRIBE_WEBHOOK_URL, mas eles não foram encontrados no código atual nem no .env.example. São prováveis sobras de configuração e devem ser confirmados antes de remover.

### API

- NODE_ENV;
- PORT;
- HOST;
- CORS_ORIGINS;
- LOG_LEVEL;
- N8N_BASE_URL;
- N8N_TIMEOUT_MS;
- VAPT_APP_ENDPOINT_SECRET;
- VAPT_ADMIN_ENDPOINT_SECRET;
- PAYMENT_EFFECTS_POLL_INTERVAL_MS;
- PAYMENT_EFFECTS_BATCH_SIZE;
- PAYMENT_EFFECTS_LEASE_MS;
- PAYMENT_EFFECTS_MAX_ATTEMPTS;
- PAYMENT_EFFECTS_RETRY_BASE_MS;
- STRIPE_WEBHOOK_SIGNING_SECRET;
- STRIPE_WEBHOOK_TOLERANCE_SECONDS;
- SUPABASE_URL;
- SUPABASE_SERVICE_ROLE_KEY;
- SUPABASE_JWT_SECRET;
- MERCADO_PAGO_CLIENT_ID;
- MERCADO_PAGO_CLIENT_SECRET;
- MERCADO_PAGO_REDIRECT_URI;
- MERCADO_PAGO_WEBHOOK_SECRET;
- MERCADO_PAGO_ENVIRONMENT;
- MERCADO_PAGO_TEST_ACCESS_TOKEN;
- PAYMENT_TOKEN_ENCRYPTION_KEY;
- FRONTEND_URL;
- API_PUBLIC_URL.

### Workflows n8n versionados

- VAPT_SUPABASE_URL;
- VAPT_SUPABASE_SERVICE_KEY;
- VAPT_APP_ENDPOINT_SECRET;
- VAPT_WEBHOOK_SETUP_SECRET;
- VAPT_ADMIN_ENDPOINT_SECRET;
- VAPT_N8N_WEBHOOK_BASE_URL;
- STRIPE_WEBHOOK_SIGNING_SECRET.

Esses nomes vêm dos exports/README; a presença e o escopo dos valores no n8n publicado precisam ser confirmados sem copiar segredos para o Git.

### Novas variáveis/bindings previstos

Públicos:

- VITE_API_URL ou manutenção temporária de VITE_VAPT_API_BASE_URL;
- VITE_STRIPE_PUBLISHABLE_KEY e price IDs;
- URL pública por ambiente.

Secrets:

- BETTER_AUTH_SECRET;
- STRIPE_SECRET_KEY;
- STRIPE_WEBHOOK_SECRET, substituindo/normalizando o nome atual quando seguro;
- RESEND_API_KEY;
- IDs de templates Resend se tratados como configuração protegida;
- segredos Mercado Pago existentes;
- segredo de criptografia de credenciais.

Bindings:

- HYPERDRIVE;
- R2 assets;
- Queue de e-mail;
- Durable Object quando introduzido.

O frontend ignora .env, .env.* e *.local, preservando .env.example, mas não ignora .dev.vars. A API ignora somente .env; .env.local, .env.production e .dev.vars não estão cobertos. Os dois .gitignore devem ser endurecidos antes de criar arquivos locais de secrets do Cloudflare.

## 16. Compatibilidade provável com Cloudflare Workers

### KEEP

- validações Zod;
- regras de domínio e state machines;
- services e contratos;
- fetch para APIs externas;
- Web Crypto/Node crypto e Buffer, após teste com compatibilidade Node atual;
- testes unitários;
- SQL de domínio, constraints, índices e transações;
- rotas públicas/idempotência;
- integração Mercado Pago baseada em fetch.

### ADAPT

- entrypoint Fastify server.listen para handler Worker;
- carregamento de configuração a partir de bindings/env;
- Fastify raw body para webhooks;
- logger Pino e transporte pino-pretty;
- CORS de wildcard Vercel para previews Cloudflare determinísticos;
- health/ready para não depender de memória local;
- IDs de worker baseados em process.pid;
- crypto helper e createRequire sob runtime Workers;
- acesso a banco para pg/Postgres.js + Hyperdrive;
- testes de integração para workerd;
- upload/storage para R2;
- callbacks OAuth/auth por preview.

Cloudflare agora oferece node:http e httpServerHandler, então Fastify deve ser testado antes de qualquer troca de framework. Isso reduz o risco, mas não prova compatibilidade automática de plugins e lifecycle hooks.

### REPLACE

- setInterval/unref do reconciliador por Queue, Cron Trigger ou processamento acionado por evento;
- rate limit Map em memória, que não é global entre isolates;
- supabase-js/PostgREST como acesso principal ao Neon;
- JWT/RLS/service_role específicos do Supabase;
- chamadas de Stripe via n8n;
- Supabase Storage por R2;
- polling por Durable Objects/WebSocket na fase realtime.

### REMOVE no fim, após validação

- runtime Docker de produção;
- config Vercel e exceções CORS específicas de Vercel;
- segredos/rotas n8n que não tiverem consumidores após consolidação;
- colunas/configurações Asaas comprovadamente órfãs;
- variáveis locais legadas confirmadas como sem uso;
- artefatos Supabase Storage/Realtime somente depois do rollback window.

## 17. Riscos priorizados

### P0 — bloqueadores de cutover

1. Cutover do banco antes de remover acesso direto Supabase do frontend interrompe funções centrais.
2. Migração de auth sem preservar/mapejar IDs quebra ownership e auditoria de pagamentos.
3. RLS, grants e roles dependentes de service_role/auth.uid() não funcionam diretamente no Neon; o estado efetivo das functions precisa ser comparado ao histórico de migrations.
4. Inventário de produção não foi confrontado com migrations; objetos ou dados podem estar fora do Git.
5. Stripe, Ingest e possivelmente Asaas no n8n continuam lendo/escrevendo Supabase nos exports versionados; um cutover antecipado causaria divergência entre bancos.
6. Webhooks externos podem continuar apontando para a VPS após troca de DNS.

### P1 — alto risco

1. Cadeia de migrations possivelmente não reproduzível em banco vazio.
2. Tipos Supabase gerados estão atrasados.
3. Reconciliador setInterval não é apropriado para Worker request-driven.
4. Rate limiting em memória perde consistência em execução distribuída.
5. URLs completas de Supabase Storage estão persistidas no banco.
6. Preview pairing e isolamento de recursos ainda não existem.
7. CORS e OAuth têm regras específicas para Vercel.
8. Pipeline da API não executa build/test/deploy real.
9. Billing Stripe ainda depende do n8n.
10. Webhook Stripe marcado pending_retry não é reprocessado quando o mesmo event ID chega novamente.
11. SUPABASE_JWT_SECRET também gera tokens públicos de pedido; rotação ingênua quebra replay idempotente e acesso ao pedido.
12. Lockfile do frontend diverge do package.json e o Docker Node 18 é incompatível com dependências resolvidas da API que exigem Node 20.
13. .dev.vars não é ignorado em nenhum repositório, e a API também não ignora variantes .env.*.

### P2 — moderado

1. Readiness atual reporta estado local de um isolate.
2. Frontend contém polling frequente e acessos diretos dispersos ao Supabase.
3. Não há fluxo de recuperação de senha implementado no frontend.
4. Bundle frontend possui chunks grandes; não bloqueia migração.
5. Browserslist do build está desatualizado; não bloqueia migração.
6. Documentação de deploy diverge entre plano (Coolify) e API (EasyPanel).

## 18. Sequência sugerida de mudanças

Esta sequência preserva o plano e ajusta somente o bloqueio descoberto:

1. Fundação Cloudflare sem produção: projetos vapt-web e vapt-api, estratégia de environments/previews e convenção de slug.
2. CI mínimo em ambos os repositórios: test, typecheck/build e preview sem secrets de produção.
3. Migrar apenas o hosting do frontend para Workers Static Assets, mantendo API/Supabase atuais.
4. Inventariar storage real e executar cópia dry-run para R2; introduzir URL canônica compatível.
5. Criar Neon preview e validar dump/restore e replay normalizado das migrations, sem cutover.
6. Criar camada PostgreSQL da API compatível com Hyperdrive e testes de paridade contra os repositórios atuais.
7. Mover acessos diretos de negócio do frontend para a API em fatias: restaurante, menu, sessões, pedidos, feedback e storage.
8. Implementar Better Auth, migração/mapeamento de identidades e telas/fluxos de verificação/reset usando Resend.
9. Consolidar Stripe na API e migrar Ingest para a camada PostgreSQL/API; confirmar se Asaas está ativo e então migrá-lo ou aposentá-lo com evidência. Incluir recuperação testada de billing pending_retry.
10. Separar o segredo de token público do SUPABASE_JWT_SECRET e validar replay idempotente entre API antiga/nova.
11. Executar ensaio completo de cutover do banco/auth em staging, incluindo todos os workflows n8n publicados.
12. Fazer cutover controlado do PostgreSQL para Neon somente após frontend, API e n8n não dependerem de PostgREST/RLS/Supabase como fonte operacional.
13. Introduzir Queue + Resend para billing e substituir o reconciliador contínuo.
14. Adaptar entrypoint/infra da API para Worker e executar api-old/api-next em paralelo.
15. Migrar polling para Durable Objects/WebSocket, mantendo Neon como fonte de verdade.
16. Cutover do domínio da API, estabilidade, backup final e desligamentos conforme critérios do plano.

## 19. Arquivos que provavelmente serão tocados

### Frontend

- package.json e package-lock.json;
- .gitignore;
- vite.config.ts;
- novo wrangler.jsonc ou wrangler.toml;
- vercel.json, somente no fim;
- public/_redirects e/ou configuração de Static Assets;
- .env.example;
- src/lib/env.ts;
- src/lib/supabase.ts;
- src/integrations/supabase/client.ts;
- src/integrations/supabase/types.ts;
- src/contexts/AuthContext.tsx;
- src/lib/vapt-api-client.ts;
- src/lib/n8n-client.ts;
- src/lib/restaurants.ts;
- src/lib/order-feedback.ts;
- src/lib/push-notifications.ts;
- src/hooks/useSubscription.ts;
- src/pages/auth/LoginPage.tsx;
- src/pages/auth/SignupPage.tsx;
- nova página de recuperação/reset de senha;
- src/pages/onboarding/OnboardingPage.tsx;
- src/pages/dashboard/MenuManagement.tsx;
- src/pages/dashboard/AppearancePage.tsx;
- src/pages/dashboard/SettingsPage.tsx;
- src/pages/dashboard/KitchenMonitor.tsx;
- src/pages/dashboard/CashierPage.tsx;
- src/pages/dashboard/Overview.tsx;
- src/pages/menu/PublicMenu.tsx;
- src/pages/delivery/PublicDelivery.tsx;
- src/components/cashier/TableSessionModal.tsx;
- src/components/menu/FloatingActions.tsx;
- testes correspondentes;
- supabase/migrations, após normalização e conversão para migrations do Neon;
- docs/integrations/n8n/README.md e exports de Asaas, Stripe e Ingest, como referências de migração/aposentadoria e não como fonte presumida do estado publicado;
- novo workflow CI/CD.

### API

- package.json e package-lock.json;
- .gitignore;
- src/server.ts;
- src/app.ts;
- src/lib/config.ts;
- src/lib/supabase.ts, a ser substituído gradualmente por camada DB;
- src/lib/jwt.ts;
- src/lib/permissions.ts;
- src/plugins/auth.ts;
- src/plugins/cors.ts;
- src/plugins/raw-body.ts;
- src/plugins/rate-limit.ts;
- src/modules/auth/*;
- src/modules/billing/stripe/*;
- src/modules/webhooks/*;
- src/modules/n8n/*;
- src/modules/orders/routes.ts e src/modules/orders/service.ts, para separar o segredo de token público;
- src/modules/webhooks/repository.ts e src/modules/webhooks/service.ts, para recuperação de pending_retry;
- src/modules/orders/repository.ts;
- src/modules/payments/repository.ts;
- src/modules/payments/reconciliation.ts;
- src/modules/payments/service.ts;
- src/modules/payments/providers/mercado-pago/*;
- novo módulo de database/Hyperdrive;
- novo módulo Better Auth;
- novo módulo email/Resend;
- consumer de Queue;
- bindings R2;
- Worker entrypoint;
- wrangler.jsonc ou wrangler.toml;
- Dockerfile: alinhar a versão Node no início; remover ou aposentar somente no fim;
- .env.example;
- .github/workflows/blank.yml, substituído por CI/CD real;
- testes unitários, integração workerd e smoke tests.

## 20. Ações manuais exigidas em dashboards externos

Nenhuma foi executada nesta etapa.

### Cloudflare

- confirmar conta, zone e domínio;
- criar Workers/Builds para web e API;
- habilitar previews não produtivos;
- cadastrar custom domains e DNS apenas na fase aprovada;
- criar R2 preview/production;
- criar Hyperdrive preview/production;
- criar Queue preview/production e eventual DLQ;
- criar Durable Object namespace;
- cadastrar vars/secrets por ambiente;
- configurar logs/observabilidade;
- avaliar Workers Paid somente quando o plano determinar.

### Neon

- criar projeto/bancos ou branches de preview e produção;
- criar role exclusiva para Hyperdrive usando conexão direta, não pooled;
- configurar backup/PITR conforme o plano contratado;
- validar extensões, encoding, timezone, collation e permissões;
- executar dry-run de restore e checksums/contagens.

### Supabase self-hosted/PostgreSQL

- gerar inventário de pg_database, pg_extension, schemas, tabelas, views, funções, triggers, policies, grants e publications;
- gerar dump consistente;
- exportar inventário de auth.users e estratégia de migração;
- listar buckets/objetos e metadados;
- confirmar jobs/cron/functions fora do Git;
- manter read-only/rollback conforme cada fase.

### Stripe

- inventariar products, prices, customers, subscriptions e webhooks;
- criar webhook test para previews/staging;
- manter live separado;
- rotacionar/criar secrets por ambiente;
- apontar live para Worker apenas no cutover;
- confirmar qual evento é dono de cada comunicação.

### Resend

- registrar IDs e variáveis dos templates existentes;
- confirmar domínio/remetente;
- criar keys por ambiente;
- restringir destinatários em preview;
- não editar HTML salvo além de variáveis necessárias.

### Mercado Pago

- preservar redirect URIs e webhooks por ambiente;
- adicionar URLs de preview/staging quando suportado;
- validar OAuth por restaurante;
- manter credenciais sandbox/live separadas.

### Vercel/VPS/orquestrador/n8n

- exportar configuração atual antes de mudanças;
- confirmar se o runtime é EasyPanel, Coolify ou ambos;
- listar containers, volumes, jobs, cron, webhooks e serviços ocultos;
- comparar os workflows n8n publicados com os exports versionados de Asaas, Stripe e Ingest;
- inventariar credenciais e variáveis por workflow sem exportar valores secretos;
- confirmar se Vapt Asaas ainda recebe tráfego; se estiver órfão, desativá-lo somente após evidência de ausência de consumidores;
- mapear todos os nós Supabase/PostgREST e impedir que qualquer writer permaneça no banco antigo após o cutover;
- executar smoke tests de Stripe e Ingest, incluindo falha e retry de webhook Stripe, contra o ambiente de staging;
- registrar DNS e certificados atuais;
- manter Vercel e VPS disponíveis durante rollback;
- cancelar somente após os critérios do plano.

## 21. Critérios para iniciar a Fase 1

Código/documentação:

- plano canônico salvo;
- auditoria salva;
- baseline verde;
- dois Git roots confirmados;
- riscos e arquivos-alvo mapeados.

Primeiros hardenings da Fase 1, antes de criar secrets ou automatizar deploy:

- corrigir os .gitignore para .dev.vars e variantes .env;
- normalizar package.json/package-lock.json do frontend e validar npm ci limpo;
- alinhar a versão Node declarada/Docker com os engines das dependências da API;
- registrar a decisão sobre o segredo próprio dos tokens públicos de pedido.

Pendências manuais mínimas antes de criar recursos:

- confirmar acesso/conta Cloudflare e os domínios;
- confirmar nomes dos ambientes e branch de produção;
- confirmar se o deploy atual usa EasyPanel ou Coolify;
- confirmar quais workflows n8n estão ativos e se os exports versionados representam produção;
- identificar responsáveis pelos dashboards Stripe, Resend, Neon, Supabase e Mercado Pago;
- confirmar que nenhuma credencial será copiada para arquivos versionados.

## 22. Referências técnicas oficiais consultadas

- Cloudflare Workers Static Assets: https://developers.cloudflare.com/workers/static-assets/
- Cloudflare Worker preview builds: https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/
- Cloudflare Node.js compatibility: https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- Cloudflare node:http/httpServerHandler: https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/
- Cloudflare Hyperdrive PostgreSQL: https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/
- Cloudflare + Neon: https://developers.cloudflare.com/workers/databases/third-party-integrations/neon/
- Cloudflare Queues/DLQ: https://developers.cloudflare.com/queues/configuration/dead-letter-queues/
- Better Auth installation: https://better-auth.com/docs/installation
- Better Auth database: https://better-auth.com/docs/concepts/database
- Better Auth options/trusted origins: https://better-auth.com/docs/reference/options

## 23. Resultado da Etapa 0

A Etapa 0 está tecnicamente concluída para o estado versionado dos repositórios.

Próxima fase autorizável: criar a fundação Cloudflare e o preview strategy, sem alterar produção e sem ainda fazer cutover de banco, auth, storage ou API.
