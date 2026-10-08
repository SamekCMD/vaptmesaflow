# Vapt — Plano Completo de Transição de Infraestrutura

## Registro atual — deploy público protegido, 08/10/2026

Configs públicos explícitos e comandos guardados qualificados por publicação/readback nos dois Workers/domínios existentes, sem modificar preview/preparação privada. Frontend916951fb: sete chaves públicas/NODE_ENV fixado/artefato separado; API94fffd63: guard privado reutilizado/CPU1000/mesmos recursos/secrets/auth/flags. Revisão corrigiu override de desenvolvimento RED→GREEN. Gates10+13/suítes175/539/workerd22/TypeScript/build/dry-runs e oito controles públicos/index exato passaram. Evidência em `docs/infra-migration-phase-13-public-deploy.md`. Sem novo DNS/recurso/credencial/assinatura/main/desligamentoVPS; provedores/imagens/realtime/observabilidade/capacidade/backup/cutover ainda pendentes. Histórico abaixo preservado.

## Registro atual — sessão no browser comprovada, 08/10/2026

Nos mesmos domínios e versões já publicados, Brave real confirmou login normal com Turnstile automático, reload autenticado, Sair e bloqueio da nova abertura do dashboard. Banco: uma sessão válida após reload, zero após saída antes de cleanup. Fixture exata removida/zero resíduos nas cinco tabelas/pool fechado; sem email/pagamento/upload/pedido. Runbook `docs/infra-migration-phase-13-browser-pairing.md`. Próximo gate: deploy público reproduzível sem perder domínios nem herdar VITE legado; demais provedores/imagens/realtime/observabilidade/volume/cutover permanecem abertos. Sem novo deploy/main/assinatura/desligamentoVPS. Pendência anterior de reload/logout abaixo é histórica.

## Registro atual — publicação controlada e navegador, 07/10/2026

Domínios vapt.app.br/api.vapt.app.br liberados explicitamente e vinculados aos Workers existentes; DNS7→9 com dois Worker e sete registros preservados. Frontenddeb94199/API correta/Turnstile ativo; APIeeb0d212 agora pública apenas pelo custom domain, CPU1000/mesmos recursos/secrets/StripeTest/realtimefalse, workers.dev/VersionURLs off. HTTPS/SQL/CORS/preflight passaram; login real Brave abriu dashboard sintético. Extensão bloqueou reload/logout, ainda pendentes; cleanup de teste confirmado. Sem main/StripeLive/ZeroTrustproduction/contratação/desligamento VPS. Handoff/rollback: `docs/infra-migration-phase-13-browser-pairing.md`; não redeployar cegamente config privada/env local. Etapa13/cutover final não certificados; histórico preservado.

## Registro de execução — Workers Paid e CPU limitada, 07/10/2026

Etapa13: Workers Paid ativado com autorização financeira/contratual explícita, US$5/mês por conta+excedentes (não teto). API production privada agora `eeb0d212-ad66-4c0a-90ec-7117b89a4266`, config d9fead0 e limite1000ms confirmado remotamente, mesmos recursos/8secrets/flags. Guard8/API539/build/bundle/revisão focada passaram; health/readiness/catalog e13checks com Turnstile real/CRUD/isolamento/R2/logout aprovados, zero resíduos12tabelas/objetos. Analytics24invocações/0erros, maiorP99degrupo270.107ms, sem prova de carga/trace/máximo. Nenhum deploy preview/billing/frontend, DNS/main/ingress/ZeroTrustproduction/NeonPaid/StripeLive alterado; produção não será recriada. Handoff detalhado no repositório API `docs/infra-migration-phase-13-workers-paid.md`; browser/provedores/imagens/observabilidade/cutover continuam gates, Etapa13 aberta. Registros seguintes são histórico.

## Registro de execução — recuperação SQL isolada, 07/10/2026

Etapa13: recuperação de duas linhas sintéticas e estrutura selecionada após perda real em cópia Neon descartável, via restauração do HEAD intacto do parent. Production somente READ ONLY antes/depois e sem diferenças; duas cópias removidas, apenas production/preview originais restantes. Não houve restore de production, PITR histórico, backup exportado, recuperação R2/DO ou reversão de efeitos externos. Sem runtime/DNS/main/Paid/ingress/secrets alterados. Detalhes em `docs/infra-migration-phase-13-recovery.md`. CIs APIc642400/F13b00ff aprovados. Próxima fase de navegador/provedores necessita publicação controlada e readiness do destino Paid, mantendo Stripe Test e sem Zero Trust de produção por inferência.

## Registro de execução — limiter interno Worker, 07/10/2026

Etapa13: API runtime `7076df8` torna rate limit interno Better Auth explícito, memória por instância e somente CF IP, independente de NODE_ENV. Node/Coolify, CAPTCHA/hash/sessões/ownership e native rate preservados; sem novo recurso ou quota distribuída. Implantado apenas emproduction privada `3afed7d4-9725-4fff-b1a9-15df463936f8` a100%, mesmos recursos/secrets/flags. RED4→GREEN4, API539/workerd22/GC1/build/guard/bundles/revisão e sete controles privados passaram: quarto reenvio429, XFF não burla, IP independente e banco pronto, sem fixtures/emails/eventos de provedor. Preview compartilha código, não reimplantado. Proteção adicional por instância, não teto financeiro/global; demais gates continuam. Main/DNS/Paid/publicação inalterados. Evidência e limites no handoff antiabuso API; registros seguintes preservam histórico.

## Registro de execução — reenvio de email antiabuso, 07/10/2026

Etapa13: endpoint existente /api/auth/send-verification-email agora exige Turnstile como cadastro/login/reset; templates/background/anti-enumeração preservados, sem novo subsystem/quota. Runtime7498574 implantado somente na API production privada92f46a03-5f05-47d4-990c-810c75c01c0a, mesmos recursos/secrets/flags. Dez consumer tests novos, API536/workerd21/GC1/build/guard/bundles/revisão e sete controles remotos de desafio ausente/readiness aprovados, sem fixtures/emails reais. Código compartilhado preview/production, não novo deploy preview. CAPTCHA não é limite de gasto/identidade; demais gates e defaults SQL anteriores preservados. Evidência no handoff antiabuso; sem main/DNS/Paid/entrada pública.

## Registro de execução — SQL antiabuso, 07/10/2026

Etapa13: defaults SQL aplicados e comprovados via Hyperdrive **em preview e production** (roles API IN DATABASE vapt):8s por statement/2s por lock, migrations `infra/neon/008_worker_preview_sql_deadlines.sql` e `008_worker_production_sql_deadlines.sql`. Preview primeiro; probes privados read-only comprovaram cancelamento do servidor, transação abortada, ROLLBACK e reuso, depois removidos/404. Somente pools HD correspondentes reciclados; sem grants/schema/dados/secrets/billing alterados. API factory também limita checkout/handshake5s; runtime4799a6e implantado somente emproduction privada `bb585c31-851c-4cf8-a077-7914dc413388`, health/readiness/SELECT e isolamento aprovados. Deadline por consulta, não teto HTTP/fatura; rollback de código não reverte defaults SQL. Evidência/recuperação em handoffs Etapa13. Main/DNS/Paid/publicação inalterados; demais gates do plano continuam, sem recriar infraestrutura ou buscar custo zero.

## Diretriz confirmada pelo usuário — 07/10/2026

Workers **Paid é o destino previsto da API**, substituindo a VPS Hetzner (US$7/mês informado pelo usuário). Free é temporário durante desenvolvimento/migração, como já estabelecido nas regras11–13 e seção5. Não tornar CPU<=10ms nem custo zero um requisito permanente de produção, nem gastar rodadas indefinidas para atingir esse alvo. Otimizar trabalho evitável sem reduzir hashing, CAPTCHA, autorização ou revogação; priorizar abuso/custo previsível e seguir os demais gates da migração.

Workers Paid tem mínimo deUS$5/mês **por conta**, não teto de fatura: uso excedente e outros serviços podem adicionar custos. Ativação é uma etapa financeira própria, não executada por este adendo. Antes da exposição: limites por invocação dimensionados com login real, proteção antecipada de entradas, rate/quotas para auth/email/checkout/upload, consultas e retries limitados, observabilidade/alertas com proteção de dados e resposta a abuso. Rate limiting dentro do Worker não garante contabilização global nem impede a cobrança de toda requisição rejeitada. [Pricing oficial](https://developers.cloudflare.com/workers/platform/pricing/), [limites CPU](https://developers.cloudflare.com/workers/platform/limits/), [localidade/consistência do rate limiter](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

As anotações posteriores “gate Free não aprovado” permanecem evidência histórica, **não bloqueio permanente para production Paid**. Ainda falta aprovar readiness do plano escolhido, proteção contra abuso, pareamento browser/provedores/recuperação e cutover. API segue privada; este adendo não ativa Paid, DNS, main ou endpoints públicos. Handoff dedicado de riscos/controles na branch API: `docs/infra-migration-phase-13-abuse-cost-readiness.md`.

> Documento de implementação para o Codex.
>
> Objetivo: migrar o Vapt de uma infraestrutura concentrada em VPS (Hetzner + Supabase self-hosted + MinIO + API Docker + Vercel) para uma arquitetura majoritariamente serverless/managed, com Cloudflare como plataforma principal, Neon como PostgreSQL gerenciado, Better Auth dentro da API, Stripe dentro da API e Resend usando **os templates customizados já existentes**.
>
> Este documento é deliberadamente conservador: **não fazer big-bang migration, não reescrever código funcional sem necessidade e preservar rollback em cada etapa.**

---

## 1. Contexto atual observado

O workspace local atual está organizado aproximadamente assim:

```text
vaptmesaflow/                  # repositório do frontend / produto
├── .git/                      # Git do frontend
├── src/
├── public/
├── supabase/
├── vercel.json
├── vite.config.ts
├── package.json
├── ...
└── vapt-api/                  # outro repositório Git, separado
    ├── .git/                  # Git próprio da API
    ├── Dockerfile
    ├── src/
    ├── package.json
    └── ...
```

Pontos importantes:

- `vaptmesaflow` e `vapt-api` **são repositórios separados**, embora a API esteja fisicamente dentro da pasta do frontend no computador.
- O Codex consegue editar ambos no mesmo workspace local, mas commits/pushes precisam respeitar os dois repositórios.
- Não transformar os dois repositórios em monorepo automaticamente.
- Não transformar `vapt-api` em Git submodule automaticamente.
- Qualquer consolidação futura deve ser uma decisão separada.
- O frontend aparenta ser Vite pelo `vite.config.ts` e `index.html`. Portanto, **não presumir Next.js**.
- O `Dockerfile` atual da API é infraestrutura de execução/deploy legada. Ele não é a API em si e não será a unidade de deploy em Cloudflare Workers.
- O diretório `supabase/` deve ser auditado antes de ser removido, pois pode conter migrations, schemas, functions ou arquivos úteis como fonte histórica.

---

# 2. Arquitetura alvo

```text
                               INTERNET
                                   │
                                   ▼
                         CLOUDFLARE EDGE
                    DNS / TLS / WAF / CDN
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
         vapt.app.br      dashboard.vapt.app.br    api.vapt.app.br
              │                    │                    │
      Workers Static Assets        │              Cloudflare Worker
              │                    │                    │
              └──────────── Frontend Vite ──────────────┤
                                                        │
                         ┌──────────────────────────────┼───────────────────────────┐
                         │                              │                           │
                         ▼                              ▼                           ▼
                    Better Auth                      Stripe                        R2
                         │                     Billing / Checkout               Storage
                         │                       Portal / Webhooks
                         │                              │
                         └──────────────┬───────────────┘
                                        │
                                        ▼
                              Email Service interno
                                        │
                             ┌──────────┴──────────┐
                             │                     │
                             ▼                     ▼
                           Resend           Cloudflare Queue
                             │            (emails assíncronos/
                             │             billing/retries)
                             ▼
                Templates customizados existentes

                           Cloudflare Worker
                                   │
                                   ▼
                               Hyperdrive
                                   │
                                   ▼
                             Neon PostgreSQL

                           Durable Objects
                                + WebSocket
                                   │
                                   ▼
                        Realtime por restaurante
```

Infraestrutura a remover ao final:

```text
Vercel                  ❌
Hetzner VPS             ❌
Coolify                 ❌
Supabase self-hosted    ❌
MinIO                   ❌
Docker como runtime
de produção             ❌
```

O Dockerfile pode continuar no repositório durante a transição como fallback/referência, mas deixa de definir a arquitetura nova.

---

# 3. Princípios obrigatórios da migração

1. **Preservar código funcional.** Não reescrever regras de negócio, validações, rotas, schemas, tipos ou integrações só porque a infraestrutura muda.
2. **API atual é source of truth funcional.**
3. **Cloudflare Workers, não Cloudflare Containers**, é o destino da API.
4. **Não fazer upload do Dockerfile para Workers.**
5. **Não fazer big-bang migration.**
6. Cada etapa deve:
   - ser implantável isoladamente;
   - ter testes;
   - ter rollback;
   - manter o sistema antigo operacional até a validação.
7. Não apontar previews/feature branches para produção por padrão.
8. Não colocar segredos no Git.
9. Não recriar templates HTML da Resend no código.
10. Não alterar os templates existentes da Resend além do necessário para expor variáveis dinâmicas.
11. Não comprar Workers Paid no início só para migrar.
12. Usar Workers Free durante desenvolvimento/migração enquanto os limites forem suficientes.
13. Ativar Workers Paid quando:
   - os limites Free atrapalharem testes reais; ou
   - imediatamente antes do cutover definitivo de produção.
14. A Hetzner só será cancelada quando estiver sem responsabilidade operacional.
15. O frontend e a API permanecem em repositórios separados durante esta migração.
16. Mudanças conjuntas frontend + API devem usar branches equivalentes nos dois repositórios.

---

# 4. Workflow de desenvolvimento — manter testes por branch na nuvem

O fluxo atual do usuário é:

```text
Codex altera código
      ↓
feature branch
      ↓
commit
      ↓
push
      ↓
deploy cloud
      ↓
teste real no navegador
```

Esse fluxo deve ser preservado.

## 4.1 Convenção de branches

Quando uma feature exigir mudanças nos dois repositórios:

```text
frontend repo: feature/stripe-billing-v2
api repo:      feature/stripe-billing-v2
```

A mesma slug deve ser usada nos dois.

Exemplos:

```text
feature/auth-migration
feature/r2-storage
feature/stripe-billing
feature/realtime-orders
fix/payment-webhook-idempotency
```

## 4.2 Previews pareados

Cada branch deve gerar:

```text
frontend preview
+ 
API preview
```

O frontend daquela branch deve apontar para a API daquela mesma branch.

Conceitualmente:

```text
feature/stripe-billing
        │
        ├── Web Preview
        │      └── stripe-billing.web-preview.<domínio>
        │
        └── API Preview
               └── stripe-billing.api-preview.<domínio>
```

Não testar frontend novo contra API antiga por acidente.

## 4.3 Repositórios separados

Como são dois Git repos:

- Codex deve detectar o root Git atual antes de commitar.
- Alterações no frontend são commitadas/pushadas no repo pai.
- Alterações na API são commitadas/pushadas dentro de `vapt-api`.
- Uma tarefa conjunta pode produzir **dois commits e dois pushes**.
- Não executar commit no repo pai esperando que o Git inclua arquivos do repo interno.
- Não remover `.git` de `vapt-api`.
- Não converter automaticamente para submodule.
- Registrar no PR/commit quando uma feature depende de uma branch homônima do outro repo.

## 4.4 Staging e produção

Ambientes desejados:

```text
FEATURE PREVIEW
- principal ambiente de teste por branch
- Stripe test mode
- banco de preview/staging
- R2 preview
- secrets de preview

STAGING
- validação integrada antes de produção
- configuração estável
- dados não produtivos

PRODUCTION
- main/release
- Stripe live
- Neon production
- R2 production
- Resend production
```

Local development pode existir e continuar funcionando, mas **não é o workflow principal do usuário**.

---

# 5. Cloudflare Workers Paid

## Decisão

**Não comprar agora.**

Primeiro:

- configurar conta/projeto;
- criar Workers;
- criar preview builds;
- migrar frontend;
- portar API;
- testar R2;
- testar Neon;
- testar Better Auth;
- testar Stripe;
- testar Resend;
- testar Durable Objects;
- testar Queues.

Ativar Paid quando:

```text
A) limites Free começarem a bloquear testes;
ou
B) estivermos prestes a colocar a nova infraestrutura em produção.
```

A VPS continua existindo durante a migração, logo não há vantagem em adicionar custo antes de necessário.

---

# 6. Fase 0 — Auditoria obrigatória antes de modificar arquitetura

O Codex deve **primeiro inspecionar os dois repositórios** e produzir um relatório técnico curto antes de iniciar mudanças destrutivas.

## Frontend

Mapear:

- framework e versão;
- build command;
- output directory;
- variáveis de ambiente;
- rotas;
- API base URL;
- auth flow atual;
- Supabase client;
- upload/download;
- Stripe client-side;
- Vercel-specific APIs;
- redirects/rewrites em `vercel.json`;
- qualquer serverless function atual;
- qualquer referência hardcoded a Hetzner/Supabase/MinIO/Vercel.

## API

Mapear:

- framework HTTP;
- entrypoint;
- Node version;
- Dockerfile;
- ORM/query builder;
- database connection model;
- Supabase SDK;
- Supabase Auth;
- Supabase Realtime;
- MinIO/S3 clients;
- Stripe SDK;
- webhooks;
- Resend;
- background jobs;
- cron;
- queues;
- filesystem;
- native modules;
- child processes;
- long-running processes;
- WebSockets;
- environment variables;
- health checks;
- CORS;
- cookies;
- auth middleware;
- billing model;
- tests;
- deployment scripts.

## Banco

Mapear:

- todas as tabelas;
- extensions;
- functions;
- triggers;
- RLS policies;
- views;
- stored procedures;
- Supabase-specific schemas;
- auth foreign keys;
- storage references;
- migrations;
- seed data.

## Saída da auditoria

Classificar cada dependência:

```text
KEEP
- compatível diretamente

ADAPT
- pequena mudança para Worker runtime

REPLACE
- incompatível ou dependente de infraestrutura removida

REMOVE
- legado sem uso
```

Nenhuma reescrita ampla antes dessa classificação.

---

# 7. Fase 1 — Fundação Cloudflare

Criar estrutura Cloudflare com separação clara:

```text
vapt-web
vapt-api
vapt-realtime
```

Se Durable Objects puderem ficar no mesmo Worker da API sem piorar organização, pode-se simplificar, mas isso deve ser uma decisão consciente após auditoria.

Recursos:

```text
R2:
- vapt-assets-preview
- vapt-assets-production

Queues:
- vapt-emails-preview
- vapt-emails-production

Durable Objects:
- RestaurantRealtime

Hyperdrive:
- vapt-db-preview
- vapt-db-production
```

Secrets nunca no Git.

Exemplos:

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
BETTER_AUTH_SECRET
BETTER_AUTH_URL
DATABASE_URL / Hyperdrive binding
```

IDs não secretos podem ser vars/config.

---

# 8. Fase 2 — Frontend Vercel → Cloudflare

O frontend aparenta ser Vite, então tratar como Vite até a auditoria provar o contrário.

Objetivo:

```text
Vite build
   ↓
Cloudflare Workers Static Assets
```

Migrar:

- `vapt.app.br`
- `dashboard.vapt.app.br`

Não modificar a API nesta fase.

Durante esta etapa:

```text
Cloudflare frontend
      ↓
API antiga na Hetzner
      ↓
Supabase self-hosted
```

## Validação

Testar:

- login;
- logout;
- refresh;
- rotas protegidas;
- deep links;
- redirects;
- SPA fallback;
- CORS;
- forms;
- API calls;
- upload;
- download;
- dashboard;
- public menu;
- mobile viewport;
- cache behavior.

Manter Vercel disponível para rollback temporário.

---

# 9. Fase 3 — MinIO → Cloudflare R2

Objetivo: eliminar storage self-hosted antes de desmontar a VPS.

Migrar:

- imagens de produtos;
- logos;
- documentos;
- uploads;
- exports;
- demais objetos identificados na auditoria.

Durante a API ainda na VPS:

```text
API Docker
   ↓
S3-compatible API
   ↓
Cloudflare R2
```

Após a API ir para Workers:

```text
API Worker
   ↓
R2 binding
```

## Requisitos

- copiar sem perder metadata relevante;
- verificar object keys;
- verificar content type;
- verificar tamanho/hash quando possível;
- preservar URLs públicas apenas se compatível;
- caso URLs mudem, criar estratégia de compatibilidade/migração;
- storage de preview separado de produção.

Após cutover:

- MinIO em read-only;
- manter por período de rollback;
- só remover depois de validação completa.

---

# 10. Fase 4 — PostgreSQL Supabase → Neon

Neon será PostgreSQL gerenciado.

**Não usar Neon Managed Auth como camada principal de autenticação.**

Objetivo:

```text
Supabase Postgres
      ↓
Neon Postgres
```

Preservar:

- schema;
- dados;
- constraints;
- indexes;
- funções necessárias;
- triggers necessárias;
- relacionamentos;
- migrations úteis.

## Importante

Supabase Auth e schemas proprietários devem ser tratados separadamente da base de negócio.

Não presumir que tudo em `auth.*` será migrado 1:1.

## Estratégia

Para o tamanho atual do Vapt, preferir migração simples e controlada:

```text
backup
↓
janela curta sem writes
↓
import
↓
validação
↓
troca de conexão
↓
teste
```

Se auditoria mostrar volume/atividade incompatível com downtime curto, então planejar replicação.

## Ambientes

```text
Neon production
Neon preview/staging
```

Não usar production DB nos previews.

Branching do Neon por PR pode ser considerado futuramente, mas **não é requisito inicial**.

---

# 11. Fase 5 — Better Auth dentro da API Worker

Arquitetura:

```text
Cloudflare Worker
      │
      └── Better Auth
             │
             ├── Hyperdrive → Neon
             └── Resend
```

Better Auth roda como biblioteca na API.

Não usar um servidor separado.

Não usar Neon Managed Auth como substituto direto porque precisamos de controle sobre:

- verification email;
- password reset;
- templates Resend;
- callbacks;
- cookies;
- sessions;
- roles;
- organizations;
- invitations;
- hooks.

## Fluxo de confirmação de conta

```text
signup
  ↓
Better Auth
  ↓
cria usuário/token/url
  ↓
sendVerificationEmail()
  ↓
Email Service
  ↓
Resend
  ↓
TEMPLATE CUSTOMIZADO EXISTENTE
```

## Fluxo de recuperação de senha

```text
forgot password
  ↓
Better Auth
  ↓
gera token/url
  ↓
sendResetPassword()
  ↓
Email Service
  ↓
Resend
  ↓
TEMPLATE CUSTOMIZADO EXISTENTE
```

## Regra crítica

**Não recriar HTML do e-mail no código.**

Usar:

```text
template ID
+
variables
```

Exemplos de variáveis:

```text
USER_NAME
ACTION_URL
PLAN_NAME
AMOUNT
INVOICE_URL
BILLING_DATE
```

Os nomes reais devem ser adaptados aos templates já publicados na Resend.

---

# 12. Fase 6 — Serviço de email Resend

Criar uma camada central da API, evitando chamadas espalhadas.

Sugestão:

```text
vapt-api/src/
├── email/
│   ├── email.service.ts
│   ├── resend.client.ts
│   ├── templates.ts
│   └── types.ts
```

Ou equivalente à arquitetura existente da API.

## Template IDs

Config por ambiente:

```text
RESEND_TEMPLATE_VERIFY_ACCOUNT
RESEND_TEMPLATE_RESET_PASSWORD

RESEND_TEMPLATE_BILLING_STARTED
RESEND_TEMPLATE_BILLING_PAID
RESEND_TEMPLATE_BILLING_FAILED
RESEND_TEMPLATE_BILLING_CANCELLED
```

Não hardcodar IDs se houver risco de IDs diferentes entre ambientes.

## Resend API Key

Cloudflare Secret:

```text
RESEND_API_KEY
```

Nunca versionar.

---

# 13. Fase 7 — Stripe dentro da API Vapt

Stripe deve morar logicamente dentro da API.

Não criar microserviço separado de billing.

Estrutura conceitual:

```text
vapt-api/src/
├── billing/
│   ├── stripe.client.ts
│   ├── billing.service.ts
│   ├── billing.routes.ts
│   ├── stripe-webhook.ts
│   └── ...
```

Preservar a organização real existente quando ela já for boa.

## Responsabilidades da API

- criar/reutilizar Stripe Customer;
- criar Checkout Session;
- consultar assinatura;
- criar Customer Portal session;
- receber webhooks;
- validar assinatura do webhook;
- atualizar estado de billing no Neon;
- implementar idempotência;
- disparar eventos de e-mail;
- manter autorização por restaurante/tenant.

## Endpoints conceituais

Não renomear rotas existentes sem necessidade, mas a superfície esperada inclui algo equivalente a:

```text
POST /billing/checkout
POST /billing/portal
GET  /billing/subscription
POST /webhooks/stripe
```

## Secrets

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

Frontend nunca recebe secret key.

Preview/staging:

```text
Stripe Test Mode
```

Production:

```text
Stripe Live Mode
```

## SDK

Tentar primeiro o SDK oficial `stripe-node` no Worker.

Se a versão usada tiver incompatibilidade real e reproduzível no runtime Workers, usar REST via `fetch()` como fallback.

Não reimplementar REST preventivamente.

---

# 14. Billing + Resend

O estado de billing deve ser confirmado por webhook, não por UI.

Fluxo:

```text
Stripe
  ↓
Webhook
  ↓
Vapt API Worker
  ↓
validar assinatura
  ↓
idempotência
  ↓
atualizar Neon
  ↓
enfileirar email
  ↓
Cloudflare Queue
  ↓
Resend
  ↓
template customizado
```

Eventos mínimos a mapear:

```text
checkout.session.completed
invoice.paid
invoice.payment_failed
customer.subscription.updated
customer.subscription.deleted
```

## Idempotência

Obrigatória.

Evitar:

- processar evento Stripe duas vezes;
- duplicar mudança de plano;
- enviar dois e-mails pela mesma invoice;
- criar Customer duplicado;
- ativar assinatura duas vezes.

Persistir IDs/eventos processados quando necessário.

## Deduplicação de emails

A compra inicial pode gerar múltiplos eventos relacionados.

Não enviar:

```text
assinatura ativada
+
pagamento confirmado
+
assinatura criada
```

de forma redundante.

Definir explicitamente qual evento é dono de qual comunicação.

---

# 15. Cloudflare Queue para e-mails de billing

Usar Queue especialmente para billing.

Motivo:

```text
Stripe webhook
≠
dependência síncrona da Resend
```

O webhook deve poder confirmar processamento mesmo se Resend estiver temporariamente indisponível.

Fluxo:

```text
Stripe webhook
    ↓
atualiza Neon
    ↓
Queue.send(email event)
    ↓
retorna sucesso
```

Consumer:

```text
Queue
 ↓
Email Consumer
 ↓
Resend
```

Configurar:

- retry;
- backoff;
- Dead Letter Queue se necessário;
- idempotência do consumer;
- logs;
- correlation/event ID.

Para emails de auth, envio pode ser direto/background conforme compatibilidade, pois o usuário precisa receber rapidamente; billing pode usar queue por padrão.

---

# 16. Fase 8 — API Docker → Cloudflare Workers

Esta é a migração principal da API.

## NÃO fazer

```text
Dockerfile
  ↓
upload para Workers
```

Workers não usa o Dockerfile como unidade de deploy.

## Fazer

Portar o código da aplicação que hoje roda dentro do container.

Preservar:

- services;
- domain logic;
- validation;
- routes;
- schemas;
- types;
- authorization;
- billing;
- Stripe logic;
- database models;
- tests.

Adaptar:

- entrypoint HTTP;
- Node runtime assumptions;
- environment access;
- database connection;
- storage;
- background work;
- websockets;
- filesystem-dependent logic;
- qualquer API incompatível.

## Dockerfile

Durante migração:

```text
API antiga:
Dockerfile → Hetzner

API nova:
Source → Cloudflare Worker
```

Manter Dockerfile até o novo Worker estar validado.

Depois:

- pode permanecer como `Dockerfile.legacy` temporariamente;
- não participa de deploy;
- remover só quando não houver valor de rollback/documentação.

---

# 17. Hyperdrive → Neon

Produção:

```text
API Worker
   ↓
Hyperdrive
   ↓
Neon PostgreSQL
```

Usar driver PostgreSQL/ORM compatível com Hyperdrive.

Não empilhar soluções desnecessárias.

Auditar ORM atual antes de trocar.

Regra:

- se ORM atual funciona em Workers + Hyperdrive, manter;
- se requer pequena adaptação, adaptar;
- substituir apenas se tecnicamente necessário.

Preview:

```text
API Preview
   ↓
Hyperdrive preview
   ↓
Neon preview/staging
```

Nunca production DB.

---

# 18. Fase 9 — Realtime Supabase → Durable Objects

Realtime será orientado por restaurante/tenant.

Conceito:

```text
RestaurantRealtime(<restaurantId>)
      │
      ├── kitchen
      ├── waiter
      ├── cashier
      └── manager
```

Eventos:

```text
ORDER_CREATED
ORDER_UPDATED
ORDER_CANCELLED
ORDER_READY
TABLE_UPDATED
PAYMENT_UPDATED
...
```

A lista real deve ser derivada da API atual.

## Fonte de verdade

Regra obrigatória:

```text
Neon PostgreSQL = estado verdadeiro
Durable Objects = transporte/coordenação de realtime
```

Nunca depender de evento WebSocket como única cópia do estado.

Reconexão:

```text
cliente perde conexão
↓
reconecta
↓
fetch estado atual
↓
retoma stream de eventos
```

Usar WebSocket Hibernation quando aplicável.

Previews devem ter realtime isolado da produção.

---

# 19. Preview resources

Branches devem usar recursos não produtivos.

## Banco

```text
feature previews → Neon preview/staging
production       → Neon production
```

## R2

```text
feature previews → vapt-assets-preview
production       → vapt-assets-production
```

## Stripe

```text
feature previews → test mode
production       → live mode
```

## Resend

- usar API key adequada;
- permitir envio apenas para destinatários seguros quando necessário;
- continuar usando templates publicados;
- não disparar emails reais de cobrança em preview para clientes.

## Auth

Better Auth preview precisa conhecer URLs do preview para:

- allowed origins;
- callbacks;
- verification URLs;
- reset URLs;
- cookies;
- redirects.

---

# 20. Preview URL pairing entre dois repos

Como frontend e API estão em repositórios separados, criar convenção determinística.

Exemplo branch:

```text
feature/stripe-billing
```

Slug normalizada:

```text
stripe-billing
```

URLs conceituais:

```text
https://stripe-billing.web-preview.vapt.app.br
https://stripe-billing.api-preview.vapt.app.br
```

O frontend build deve receber:

```text
VITE_API_URL=https://stripe-billing.api-preview.vapt.app.br
```

ou variável equivalente descoberta na auditoria.

A API preview deve receber:

```text
APP_URL=https://stripe-billing.web-preview.vapt.app.br
```

para CORS/auth/redirects.

Não hardcodar manualmente branch por branch.

Derivar automaticamente da branch/preview name.

---

# 21. CI/CD

Cada repo deve ter pipeline próprio.

## Frontend repo

Push em feature branch:

```text
build
↓
tests/typecheck
↓
Cloudflare Web Preview
```

Push/merge para branch de produção:

```text
build
↓
tests
↓
deploy production
```

## API repo

Push em feature branch:

```text
install
↓
tests
↓
typecheck
↓
Worker preview deploy
↓
smoke tests
```

Push/merge para produção:

```text
tests
↓
typecheck
↓
deploy API Worker production
↓
post-deploy smoke tests
```

## Mudanças conjuntas

Codex deve registrar no summary:

```text
Frontend branch: feature/x
API branch: feature/x

Frontend commit: <sha>
API commit: <sha>

Preview Web: <url>
Preview API: <url>
```

Se um dos deploys falhar, a feature não está pronta para merge.

---

# 22. Segredos e variáveis

Separar:

```text
PUBLIC CONFIG
- API URL
- public Stripe publishable key
- public app URL

SECRETS
- Stripe secret key
- Stripe webhook secret
- Resend API key
- Better Auth secret
- DB credentials / secrets
```

Frontend só recebe valores públicos.

Nenhum `.env`, `.env.local` ou `.dev.vars` contendo segredos deve ser commitado.

Auditar `.gitignore`.

Se segredos já tiverem sido commitados no passado, rotacionar.

---

# 23. Observabilidade

Antes de desligar a VPS, ter visibilidade mínima de:

- Worker errors;
- 4xx;
- 5xx;
- latency p50/p95/p99;
- Hyperdrive/database failures;
- Stripe webhook failures;
- Stripe event retries;
- Queue failures;
- DLQ;
- Resend failures;
- Better Auth errors;
- R2 errors;
- Durable Object/WebSocket disconnect patterns.

Adicionar request/correlation IDs quando útil.

Stripe event ID deve aparecer nos logs de billing.

---

# 24. Testes obrigatórios

## Auth

- signup;
- verification email;
- clicar no template Resend;
- account verified;
- login;
- logout;
- reset password;
- template customizado de reset;
- token inválido;
- token expirado;
- rate limiting;
- preview URL callbacks.

## Billing

- criar customer;
- checkout;
- assinatura inicial;
- invoice paid;
- failed payment;
- upgrade;
- downgrade;
- cancellation;
- customer portal;
- duplicate webhook;
- out-of-order webhook;
- Resend billing template;
- Queue retry;
- idempotência.

## Storage

- upload;
- download;
- delete;
- metadata;
- MIME;
- public/private object policy;
- preview isolation.

## DB

- CRUD;
- transactions;
- migrations;
- constraints;
- auth relations;
- billing relations;
- concurrent order flow.

## Realtime

- order created;
- kitchen receives;
- cashier receives;
- disconnect;
- reconnect;
- resync from DB;
- multiple restaurants isolated;
- preview isolation.

## Frontend

- full navigation;
- API preview pairing;
- auth protected pages;
- billing screens;
- menu;
- dashboard;
- error states;
- mobile.

---

# 25. Ordem oficial de implementação

Executar nessa ordem, salvo impedimento descoberto na auditoria:

## Etapa 0
Auditar frontend + API + DB + infra atual.

## Etapa 1
Configurar Cloudflare foundation e preview strategy.

## Etapa 2
Migrar frontend Vercel → Cloudflare Workers Static Assets.

## Etapa 3
Migrar MinIO → R2.

## Etapa 4
Migrar PostgreSQL Supabase → Neon.

## Etapa 5
Implementar/adaptar Better Auth dentro da API.

## Etapa 6
Conectar Better Auth → Resend usando **templates existentes**.

## Etapa 7
Consolidar Stripe dentro da API e validar billing.

Estado em 27/09/2026: código e fluxo real Stripe Test Mode validados na branch
Neon `preview`; schema aditivo idêntico aplicado e verificado em `production`,
ambas sem dados sintéticos ao final. A ativação Stripe Live aguarda API em
Cloudflare Worker com URL estável e secrets, sem apontamento para runtime
legado. A entrega de emails de billing via Queue/Resend é a Etapa 8, não foi
ativada nesta etapa. Evidência: `docs/infra-migration-phase-7-stripe.md`.

## Etapa 8
Adicionar Queue para emails/eventos assíncronos de billing.

## Etapa 9
Portar API Docker/Node → Cloudflare Workers.

## Etapa 10
Conectar API → Hyperdrive → Neon.

## Etapa 11
Executar API antiga e API Worker em paralelo.

## Etapa 12
Migrar Supabase Realtime → Durable Objects/WebSockets.

Registro de execução em 06/10/2026: implementação e prova da Etapa12 validadas nas branches de infraestrutura. Task 9 publicou somente `stage11-inert`, com namespace SQLite isolado e smoke privado real aprovado: dois tenants, quatro pedidos, cinco conexões101; isolamento owner/order, cozinha/caixa, snapshots HTTP, reconexão e revogação1008. API488/488, workerd19/19, frontend175/175, scripts22/22 e ACL Neon preview4/4 passaram. Dados sintéticos Neon removidos e contagens zero confirmadas; Data Studio confirmou zero tickets/sequências nas duas instâncias. Revisão independente Astra medium concluída: zero Critical, dois Important corrigidos com RED/GREEN (deadline/cancelamento HTTP e atualização da conta aberta do caixa), um Minor adiado (clock skew, com fallback HTTP). Builds/root typecheck passaram; comparação mais forte manteve21 diagnósticos anteriores, nenhum introduzido. Produção, DNS e planos pagos não foram alterados. Evidências/limites: `vapt-api/docs/infra-migration-phase-12-realtime.md` na branch API `codex/infra-foundation`. Integração pelos PRs API1/frontend4; billing3 ainda precisa de consolidação/reteste na Etapa13, sem merge na main. Não certifica cutover ou navegador remoto; o mesmo código segue para production com bindings/namespace/cookies/gates próprios na Etapa13, sem refazer funcionalidades.

## Etapa 13

Continuação posterior — 08/10/2026: transporte real Queue→DLQ production validado com uma única mensagem inválida sintética/body exato, chegada após~188.744s e exclusão de apenas sua ref. Sem purge global/replay/novo consumer/email/SQLfixture/configchange; peek/backlogApprox final0 nas duas filas/outboxglobal0/readbacks três Workers intactos/CPU1000. Operator corrigido por diagnóstico RED→GREEN (peekJSON textual/contador DLQ0), sem republicação; não certifica quatro tentativas observadas na primary, dedupe ou retry de envio real. Registro `docs/infra-migration-phase-13-billing-queue-dlq.md`; guards3/billing45pass+2skip/TypeScript e CI anterior8bbb88a/b976e19 aprovados. Sem deploy/main/DNS/Live/plano novo. Etapa13 segue aberta para replay/out-of-order financeiro, recuperação de provedor/reconciliação, mutações Portal, imagens/realtime production, observabilidade/capacidade/estabilidade. Não refazer gates de quatro Delivered, SQL recovery ou esta publicação fixa.

Continuação posterior — 08/10/2026: recuperação SQL da outbox production aprovada em quatro cenários próprios: claim concorrente único/retrydeadline/snapshot/fencing, falha de publicação controlada/reserva5min, lease15min/cap8 e uncertainty24h→dead_letter sem resend. Relógio explícito/linhas futuras e guards preservaram Cron e qualquer dado alheio; zero fixture/outbox global/poolclosed/readback três Workers inalterados. Sem novo email, provider event, mensagem Cloudflare, deploy/main/Live/custo. Registro/limites `docs/infra-migration-phase-13-billing-recovery.md`; não confundir sent sintético com Resend, dead_letter SQL com DLQ nem globals serializados com prova de disputa. CI anterior API8bbb88a/frontend7a9fd80 aprovado. Etapa13 segue aberta para replay/out-of-order/recuperação externa QueueDLQ, mutações Portal, imagens/realtime production, observabilidade/capacidade/estabilidade. Gates financeiros e quatro Delivered seguintes já concluídos, não repetir.

Continuação mais recente — 08/10/2026: ciclo Stripe Test no Worker production aprovado com ativação, renovação, falha de pagamento e cancelamento reais do sandbox. Oito webhooks próprios processed/attempt1; Cron/Queue production enviaram quatro aliases/snapshots corretos na primeira tentativa e Resend confirmou quatro Delivered. Mais75s sem duplicata espontânea, não replay/concorrência. Endpoint Test disabled restaurado, Clock/Customer removidos, Subscription cancelada/zeroSQL próprio/pool encerrado, mesmos deploys API94fffd63/frontend916951fb/billing1f578bc6/CPU1000/recursos/flags. Sem redeploy/main/Live/novo custo. Registro `docs/infra-migration-phase-13-billing-lifecycle.md`. BillingCron1min já existente difere de APICron0. Etapa13/cutover seguem abertos para replay/out-of-order/recuperação Queue, mutações Portal, imagens/realtime production e observabilidade/capacidade/estabilidade. O registro seguinte de Checkout é anterior; a pendência de ciclo e entrega de billing ali foi resolvida por este gate limitado.

Estado mais recente — 08/10/2026: Workers Paid já ativo com autorização financeira; API94fffd63/frontend916951fb publicados nos dois domínios existentes, CPU1000 e mesmos recursos/flags. Confirmação/reset reais Better Auth/Resend no sink oficial e trial/cancelamento com webhooks Stripe assinados foram validados/limpos; registros em `docs/infra-migration-phase-13-auth-email-provider.md` e `docs/infra-migration-phase-13-stripe-provider.md`. Continuação aprovou login Turnstile real/API billing autenticada, Checkout ProR$197 sem ativação antecipada/reuso pendente, pagamento hospedado Test de valor positivo e invoice.paid/checkout.session.completed processed1→Pro/active/activation intent único/pending limpo; Portal do mesmo Customer exibiu fatura paga. Logout/revogação, endpointdisabled, Subscriptioncancelada/Customerexcluído e zeroSQL próprio confirmados. Registro/limites em `docs/infra-migration-phase-13-stripe-checkout.md`. Não comprova mutações Portal/ciclo ampliado/replay/concorrência/entrega billing emails/capacidade ou cutover. Sem main/StripeLive/novo custo nesta rodada. Os avanços anteriores abaixo são históricos, inclusive próximas ações já executadas e referências a production privada/Free10ms como gate.

Continuação operacional07/10: CI API434948c/frontend478d558 aprovado nos quatro runs push/PR. Rollback de código privado ba363c7c→799b78a0 e restauração finally ba363c7c aprovados,100%/bindings e flags preservados, health/readiness/SELECT em ambas e oito controles authbody após restaurar. Não houve dados/schema/secrets/grants/main/DNS/Paid ou exposição pública alterados; recuperação SQL/objetos continua separada. Investigação READ ONLY dos defaults role/banco Neon não encontrou overrides dos quatro deadlines selecionados, sem provar settings efetivos do Hyperdrive. Próximo controle antiabuso é prazo SQL com cancelamento/cleanup/reuso verificados, mantendo recursos/driver; não retry cego de writes nem objetivo permanente Free10ms. Handoffs API e consolidação registram os limites; Etapa13 ainda incompleta.
Cutover de `api.vapt.app.br` para Workers.

Diretriz mais recente07/10: production futura emWorkersPaid, conforme regras11–13/seção5 e confirmação do usuário; Free10ms não é requisito permanente. Proteção contra abuso passa a ser gate de custo, sem prometergasto máximo ou ativarPaidagora. Runtime API authbody2f76670/96bda74, versão privada ba363c7c-3355-4849-b71f-c615bc3344db: capPOST1MiB antes de inicialização,524API/21workerd e oito controles negativos/compatibilidade remotos passaram; nenhuma fixture/provedor/Paid/main/DNS/pública ativada. Revisão achouregressão logout/Content-Type, corrigida com teste real e suíte; demais quotasglobais/deadlines/borda/alerts/cookies/provedores/recuperação seguem gates, sem refazer funcionalidades ou perseguirzerocusto. Handoff API `docs/infra-migration-phase-13-abuse-cost-readiness.md` e consolidação preservam histórico/evidência.

Preparação em 06/10/2026: billing PR3 incorporado integralmente à branch de infraestrutura frontend/SQL pelo merge558ae83, sem modificar realtime/grants existentes. PR4 passa a conter billing e realtime; o PR3 original permanece preservado. Frontend175/175, API488/488, billing45pass/2Postgres não executados; typecheck/build e ambos os bundles billing dry-run passaram. CI recebeu job isolado para billing, sem secrets ou deploy. Revisão focada de integração sem achados. Cutover, main, produção, DNS e planos pagos ainda não alterados. Registro e gate seguinte em `docs/infra-migration-phase-13-consolidation.md`; a nota anterior da Etapa12 sobre billing separado é histórica e foi resolvida por esta consolidação.

Avanço preparatório em06/10/2026: CI remoto da consolidação passou nos dois repos. API production ganhou configuração local que reutiliza o runtime atual, Hyperdrive/R2 production existentes e binding SQLite local próprio, com realtime/ingress desativados e Stripe test. Guard7/7, verificadores locais selecionados34/34, API488/488, workerd19/19 e bundle production dry-run passaram. Sem implantação, secrets ou recursos pagos novos. R2 público ainda desativado; namespace/Worker production não criados nesta rodada. Readiness de CPU Free, cookies/pareamento e webhook continuam gates explícitos. Handoff na branch API: `docs/infra-migration-phase-13-production-preparation.md`; não marca cutover como concluído.

Avanço remoto em07/10/2026: API production implantada sem entradas públicas, com8secrets próprios e recursos production, reutilizando o runtime atual. ACL SQL e11checks privados aprovados: catálogo/pedidos/idempotência/isolamento público/solicitação de conta,401 sem sessão e400 sem CAPTCHA. Duas fixtures sintéticas removidas e zero resíduos em12tabelas confirmado. Não equivale a login positivo, CRUD autenticado, pareamento browser, R2, entrega Stripe, CPU Free ou rollback concluídos; esses gates precedem cutover. Ingress/realtime/Stripe Live não ativados; planos/DNS/main não alterados nesta rodada. Detalhes em `docs/infra-migration-phase-13-consolidation.md` e no handoff API. A evidência preparatória anterior de Worker production ainda inexistente é histórica, superada pela implantação registrada nos handoffs. Não recriar infraestrutura nem refazer funcionalidades.

Continuação em07/10/2026:13checks adicionais production privados aprovados, incluindo login com Turnstile humano real, sessão/cookie seguro, owner/CRUD/cardápio/cozinha/caixa, R2 upload assinado/leitura privada/delete/rejeição de adulterações/expiração, logout e revogação. Cleanup verificado: zero resíduos em12tabelas e zero objetos sintéticos. Sem alterar runtime, secrets, ingress, main, DNS ou planos. Auth/CRUD/R2 privados deixam de ser pendências deste gate; pareamento browser/CORS/cookies reais, exposição deliberada de imagens, entrega/ciclo Stripe Test/Resend, CPU Free e recuperação/rollback permanecem antes do cutover. Handoffs registram evidência e limites; Etapa13 não concluída.

Readiness CPU em07/10/2026:CI anterior dos dois handoffs passou. Painel confirmou WorkersFree atual, sem upgrade. GraphQL somente leitura mediu grupos de requisições production com CPU acima dos10ms Free (exemplo P50 11.524ms/P99 120.784ms, unidade oficial conferida);0invocationErrors na janela não garante capacidade. Gate CPU **não aprovado**, sem atribuir quantil ao login ou máximo absoluto. Próximo passo profiling por caminho/cold-warm e otimização mínima sem reduzir segurança, trocar provedor ou comprar plano por inferência. Cutover continua pendente; tabela/evidência no handoff API e consolidação.

Profiling controlado seguinte:12GETs privados sem Cookie, nenhuma fixture/provedor,12grupos Analytics completos ao final. Correlação por ordem aponta auth/me como foco, não hashing nesse caminho; bundle confirmou scrypt nativo e inspeção/perfil local complementar identificou inicialização repetida Better Auth/schema por request. Não transformar controle local memoryAdapter em cache global de produção nem chamar sequências de cold/warm comprovadas. Sem runtime/deploy/ingress/planos alterados; gate Free permanece não aprovado. Próximo passo reduzir custos evitáveis request-local com testes e nova medição, sem promessa de resolver login/CPU com economias menores. Evidência detalhada: API `docs/infra-migration-phase-13-cpu-diagnosis.md` e consolidação frontend.

Primeira otimização em07/10: runtime API6339066 inicializa signer R2 apenas no primeiro upload, request-local, assinatura/autorização preservadas. API491/491/workerd19/19/build/guard7/7 e revisão focada passaram; versãod4940da2 implantada somente em production privada. Mesmos recursos/secrets, ingress/realtime/R2público desligados, Stripe Test e planos/DNS/main inalterados. Doze leituras posteriores funcionaram; Analytics inicial parcial ainda contém48.423ms, portanto gate CPU Free **não aprovado** e nenhum cutover. Próximo foco continua auth/contexto/SQL, sem cache global inseguro, weakening ou upgrade.

Continuação operacional: rollback privado de código4a33769a e restauração d4940da2 ensaiados,100% nas duas versões, saúde/readiness/SELECT aprovados e isolamento preservado. Estado final otimizado privado; não certifica recuperação de banco/objetos/migration. Analytics posterior11/12 com48.423/11.629/10.128ms correlacionados a auth/me, sem cold/warm comprovado: gate Free retido. Handoffs detalham falha local de caminho corrigida, finally de restauração, CI e limites. Nenhum cutover/main/DNS/Paid autorizado por esse ensaio.

Segunda otimização em07/10: API b12bfad rejeita header Cookie ausente antes de inicializar auth/banco, mantendo401, rate/ingress/CORS e validação completa de qualquer Cookie presente. RED/GREEN7, API498/498/workerd19/19/build/guard7/7; versão db882acc implantada só em production privada, mesmos recursos/secrets, sem main/DNS/Paid. Doze leituras e três rejeições sintéticas passaram; CPU correlacionado de auth/me sem Cookie2.865/1.396/0.908ms, contra48.423/11.629/10.128ms anteriores, sem trace/cold-warm/ganho global. Outros grupos10.156/15.748ms e controles com Cookie52.908/17.783ms ainda excedem10ms. Gate Free retido; login e contexto/SQL com Cookie continuam pendentes. Handoffs registram sobreposição de primeiro controle na janela Analytics, limites de atribuição e Minor de teste factory503 adiado; nenhuma segurança reduzida.

## Etapa 14
Rodar período de estabilidade sem depender da VPS.

## Etapa 15
Ativar Workers Paid se ainda não estiver ativo e for necessário para produção.

## Etapa 16
Backup final.

## Etapa 17
Desligar Supabase self-hosted, MinIO, API Docker e Coolify.

## Etapa 18
Cancelar Hetzner.

## Etapa 19
Remover Vercel após janela de rollback.

---

# 26. Estratégia de rollback

Cada etapa deve manter o caminho anterior disponível até validação.

## Frontend

```text
Cloudflare falha
↓
DNS volta para Vercel
```

## Storage

```text
R2 falha
↓
API volta temporariamente para MinIO
```

## DB

Antes de cutover:

```text
dump válido
+
connection config anterior
```

Evitar escrita simultânea divergente em dois bancos sem estratégia explícita.

## API

Durante migração:

```text
api-old / Hetzner
api-next / Workers
```

Só trocar domínio principal depois de testes.

## Realtime

Supabase Realtime permanece até DO estar validado.

## Hetzner

Não cancelar durante migração.

---

# 27. Critério para desligar Hetzner

A VPS só pode ser desligada quando **nenhuma** dessas funções depender dela:

```text
API                 → Workers
Database            → Neon
Auth                → Better Auth no Worker
Storage             → R2
Realtime            → Durable Objects
Billing             → Worker + Stripe
Email               → Worker/Queue + Resend
Frontend            → Cloudflare
```

E depois de:

- período real de estabilidade;
- backup final;
- confirmação de que não há DNS apontando para VPS;
- confirmação de que não há cron/job escondido;
- confirmação de que não há webhook externo apontando para VPS;
- confirmação de que não há bucket/arquivo faltando;
- confirmação de que produção usa banco Neon;
- confirmação de que Stripe Live webhook aponta para Worker.

---

# 28. Critério para remover Vercel

Somente quando:

- `vapt.app.br` está estável em Cloudflare;
- `dashboard.vapt.app.br` está estável;
- SPA/deep links funcionam;
- previews Cloudflare substituem o workflow de branch;
- não há serverless function escondida na Vercel;
- rollback window terminou.

---

# 29. Critério para remover Dockerfile

Não remover cedo.

O Dockerfile deixa de ser runtime de produção assim que API Worker estiver estável.

Depois:

```text
opção A: manter Dockerfile.legacy por algum tempo
opção B: manter Dockerfile apenas para fallback/local
opção C: remover definitivamente
```

A escolha só acontece no fim.

---

# 30. Instruções específicas para Codex

## Antes de editar

1. Detectar os dois Git roots.
2. Ler `README`, `package.json`, configs e Dockerfile.
3. Mapear env vars.
4. Mapear deploy atual.
5. Mapear integração Supabase.
6. Mapear Stripe.
7. Mapear Resend.
8. Mapear storage.
9. Mapear realtime.
10. Rodar testes existentes.

## Ao editar

- mudanças pequenas e verificáveis;
- evitar refactor não relacionado;
- preservar nomes de rotas;
- preservar contratos;
- preservar schemas;
- preservar comportamento de billing;
- preservar templates Resend existentes;
- não alterar produção durante feature preview;
- criar migration quando schema mudar;
- não editar secrets em arquivos versionados.

## Ao terminar cada fase

Entregar:

```text
What changed
Why
Files changed
Migrations
New env vars
Removed env vars
Cloudflare resources required
Manual dashboard actions required
Tests executed
Preview URLs
Rollback procedure
Known risks
Next phase
```

---

# 31. Regras de custo

A prioridade não é simplesmente “pagar menos que US$7”.

A prioridade é:

```text
baixo custo ocioso
+
escala automática
+
menos manutenção
+
mais confiabilidade
+
infra adequada ao crescimento
```

Arquitetura inicial esperada:

```text
Cloudflare Workers         Free → Paid quando necessário
Neon                       Free/usage-based inicialmente
R2                         Free tier inicialmente
Resend                     Free tier enquanto couber
Stripe                     percentual transacional normal
Hetzner                    removida
Vercel                     removida
Supabase Cloud             não necessário
```

Não adicionar Redis/Upstash sem um caso real.

---

# 32. Coisas que explicitamente NÃO entram agora

- Upstash/Redis sem necessidade;
- Kubernetes;
- Docker orchestration;
- Cloudflare Containers;
- Supabase Cloud US$25;
- reestruturação completa dos dois repos;
- transformação automática em monorepo;
- Neon branch por PR já na primeira implementação;
- duplicação de templates Resend no código;
- reescrita total da API;
- alteração de framework do frontend sem necessidade.

---

# 33. Definição de pronto da migração

A migração termina quando:

```text
[ ] Frontend está em Cloudflare
[ ] Feature branch previews funcionam
[ ] Front + API previews são pareados
[ ] API está em Workers
[ ] Docker não é runtime de produção
[ ] Stripe está dentro da API Worker
[ ] Stripe webhooks estão idempotentes
[ ] Billing usa Neon como estado persistido
[ ] Better Auth está na API
[ ] Verification usa template Resend existente
[ ] Password reset usa template Resend existente
[ ] Billing emails usam templates Resend existentes
[ ] Queue está configurada para billing emails
[ ] PostgreSQL está no Neon
[ ] API usa Hyperdrive
[ ] Arquivos estão em R2
[ ] Realtime usa Durable Objects/WebSockets
[ ] Preview resources não usam produção
[ ] Logs/observabilidade mínimos estão ativos
[ ] Rollback foi testado ou documentado
[ ] Hetzner não tem tráfego/responsabilidade
[ ] Supabase self-hosted foi desligado
[ ] MinIO foi desligado
[ ] Coolify foi desligado
[ ] Vercel foi removida após janela de rollback
[ ] Hetzner foi cancelada
```

---

# 34. Primeira tarefa concreta do Codex

**Não iniciar migrando tudo.**

Primeiro executar apenas uma auditoria técnica e gerar:

```text
docs/infra-migration-audit.md
```

O relatório deve conter:

1. árvore relevante dos dois repos;
2. framework/versões;
3. como frontend chama API;
4. como auth funciona hoje;
5. como banco é acessado;
6. tabelas/schemas Supabase relevantes;
7. uso de MinIO;
8. uso de Stripe;
9. uso de Resend;
10. uso de realtime;
11. env vars;
12. incompatibilidades prováveis com Workers;
13. rotas críticas;
14. riscos;
15. sequência sugerida de mudanças;
16. arquivos exatos que provavelmente serão tocados;
17. itens que exigem ação manual em dashboards externos.

**Somente depois desse relatório iniciar a Fase 1.**

---

# 35. Resultado arquitetural final

```text
                           CLOUDFLARE
                               │
             ┌─────────────────┼──────────────────┐
             │                 │                  │
             ▼                 ▼                  ▼
          Frontend           API Worker        Realtime
      Workers/Assets             │          Durable Objects
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
         Better Auth          Stripe              R2
              │            Billing/Webhooks      Storage
              │                  │
              └────────┬─────────┘
                       │
                       ▼
                 Email Service
                       │
              ┌────────┴────────┐
              │                 │
            Resend            Queue
              │
     Templates customizados
       já existentes

              API Worker
                  │
              Hyperdrive
                  │
                  ▼
             Neon Postgres
```

Objetivo operacional final:

> O Vapt deve poder crescer sem depender de uma VPS pequena sobrecarregada, mantendo uma experiência simples de desenvolvimento por feature branches e previews na nuvem, com custos que surgem principalmente conforme o produto realmente é utilizado.
