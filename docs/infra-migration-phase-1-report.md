# Relatório da Fase 1 — Fundação Cloudflare

Data: 2026-09-24

Status: concluída no escopo seguro e verificável. Recursos que dependem de código ou conexões de fases posteriores foram deliberadamente diferidos, conforme a auditoria.

## What changed

- A conta Cloudflare foi autenticada pelo fluxo OAuth supervisionado.
- O R2 foi ativado pelo usuário.
- Foram criados os buckets `vapt-assets-preview` e `vapt-assets-production`.
- Foram criadas as filas `vapt-emails-preview` e `vapt-emails-production`, sem producers ou consumers.
- O frontend foi configurado como Worker `vapt-web` de Static Assets, com fallback de SPA.
- `workers.dev` foi explicitamente desativado e Version URLs foram explicitamente habilitadas.
- O Wrangler foi fixado em `4.138.0` no repositório.
- O build de preview foi separado do build de produção e usa somente endpoints não roteáveis `.invalid` e identificadores sandbox.
- O Worker foi recriado após aprovação explícita para eliminar versões históricas que haviam herdado o ambiente local legado.
- O histórico remoto final contém somente duas versões isoladas e nenhum target de produção.

## Why

- Estabelecer a fundação Cloudflare sem alterar tráfego, DNS ou produção.
- Tornar os uploads de preview reprodutíveis.
- Impedir que previews de infraestrutura executem leituras ou escritas acidentais contra os serviços legados.
- Preservar o rollback e a ordem incremental determinada pelo plano.

## Files changed

Frontend:

- `.gitignore`
- `.env.preview`
- `package.json`
- `package-lock.json`
- `wrangler.jsonc`
- `docs/infra-migration-plan.md`
- `docs/infra-migration-audit.md`
- `docs/infra-migration-phase-1-report.md`

API, no worktree isolado:

- `.gitignore`
- `Dockerfile`
- `package.json`
- `package-lock.json`

## Migrations

Nenhuma migration de banco ou Durable Object foi criada nesta fase.

## New env vars

Nenhum secret novo. O arquivo versionado `.env.preview` contém apenas sentinelas não roteáveis e valores sandbox públicos.

## Removed env vars

Nenhuma.

## Cloudflare resources required

Criados:

- Worker `vapt-web`;
- R2 `vapt-assets-preview`;
- R2 `vapt-assets-production`;
- Queue `vapt-emails-preview`;
- Queue `vapt-emails-production`.

Diferidos conscientemente:

- Worker `vapt-api`: será criado quando existir entrypoint Workers verificável;
- Durable Object `RestaurantRealtime`: será criado junto da migration versionada do Worker;
- Hyperdrive `vapt-db-preview` e `vapt-db-production`: exigem conexões diretas Neon ainda inexistentes;
- Worker separado `vapt-realtime`: a auditoria permite consolidá-lo no Worker da API se a implementação confirmar que isso não piora a organização.

## Manual dashboard actions required

Concluídas:

- login OAuth na conta Cloudflare correta;
- ativação/billing do R2 pelo usuário.

Ainda não executadas:

- integração Git/Workers Builds;
- secrets e vars funcionais por ambiente;
- custom domains e DNS;
- qualquer alteração em `vapt.app.br` ou `dashboard.vapt.app.br`;
- Workers Paid, Neon, Hyperdrive, Durable Objects ou observabilidade.

## Tests executed

- frontend: 17 arquivos, 61/61 testes passando;
- API: 24 arquivos, 201/201 testes passando;
- build Vite de produção passando;
- build Vite em modo `preview` passando;
- build da API passando;
- contrato local do `wrangler.jsonc` passando;
- Wrangler dry-run lendo 85 assets e zero bindings;
- inspeção do bundle local e remoto sem hosts Easypanel legados;
- smoke HTTP de `/`, `/login` e asset JavaScript;
- fallback SPA confirmado por deep link;
- inspeção visual da landing page e tela de login no navegador;
- inventário final confirmou exatamente duas versões remotas, ambas isoladas.

Avisos não bloqueantes já existentes:

- `caniuse-lite` desatualizado;
- chunk principal acima de 500 kB;
- warnings de future flags do React Router e `act(...)` em testes da landing page.

## Preview URLs

- Alias estável: https://infra-foundation-vapt-web.autoistloko.workers.dev
- Versão imutável: https://c2c1726f-vapt-web.autoistloko.workers.dev

O preview renderiza páginas estáticas, mas chamadas de auth, API e dados falham intencionalmente até receberem serviços de preview isolados.

## Rollback procedure

- Nenhum domínio ou target de produção aponta para o Worker.
- O alias pode ser substituído por outra versão sem alterar produção.
- O Worker pode ser removido após confirmação explícita; os buckets e filas são independentes.
- Os recursos R2 e Queue estão vazios e sem bindings, producers ou consumers.
- Os commits locais podem ser revertidos sem afetar o frontend atual na Vercel.

## Known risks

- A validação funcional de login, logout, sessão, formulários, uploads e chamadas de API está bloqueada até existir backend de preview isolado.
- A integração Git/Workers Builds ainda não foi conectada.
- O comportamento observado de cache usa `must-revalidate, max-age=0`; otimização será avaliada sem comprometer invalidação de assets.
- O bundle grande não bloqueia a migração, mas permanece como dívida de performance.
- A Vercel continua sendo o rollback do frontend até o fim da janela definida no plano.

## Next phase

Fase 2 — validar e preparar a migração do frontend para Cloudflare Static Assets:

1. verificar CORS do backend legado para a origem de preview;
2. definir um backend/dados isolados para testes funcionais;
3. validar a checklist completa do frontend;
4. configurar Workers Builds somente após autorização da integração Git;
5. solicitar confirmação separada antes de custom domains, DNS ou cutover.
