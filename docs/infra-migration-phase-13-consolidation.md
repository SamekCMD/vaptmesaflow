# Etapa 13 — preparação e consolidação

## Status em 06/10/2026

Consolidação do código concluída na branch `codex/infra-foundation`; cutover de `api.vapt.app.br` ainda não executado. Main, DNS, Workers implantados, secrets, planos pagos e dados remotos não foram alterados nesta preparação.

O merge `558ae83d215d37bcb46d9012ca76a7659e5dcc11` incorpora integralmente a branch billing `c890f9dccf24946be04f1ad3cd75a22156ccb3e6` à infraestrutura frontend/SQL. Os 23 arquivos adicionados são idênticos ao billing já revisado; nenhuma mudança em `src` ou nos grants/verificadores existentes da API. O PR frontend #4 agora inclui o código do PR billing #3, além do realtime. O #3 permanece aberto e sua branch/worktree não foi modificada. Não fazer outro merge cego do mesmo conjunto nem descartar a branch original.

Os Workers billing preview e production permanecem serviços separados da API: webhook escreve intent no Neon, Cron/Queue entrega email. Não incorporar consumer/Resend síncrono na API nem recriar os recursos já implantados. A migration de entrega é aditiva e nullable, compatível com o INSERT atual da API; o acesso da API à outbox continua somente INSERT. As migrations com prefixo006 têm nomes completos distintos e aplicação explícita; não reaplicar migrações já existentes nem deduzir ordem somente pelo número.

## Verificação desta consolidação

- Git merge-tree sem conflitos; merge local na feature branch, sem main.
- Comparação Git: Worker billing, SQL/verificador e runbook byte-equivalentes à origem; realtime e grants existentes inalterados.
- Frontend:175/175; root typecheck e build:preview passaram. A dívida anterior de21 diagnósticos em tsconfig.app.json não é declarada corrigida; código src não mudou nesta consolidação.
- API pareada:488/488. Código runtime API inalterado em relação à Etapa12.
- Billing:47 casos,45 passaram,2 testes Postgres não executados por ausência de NEON_PREVIEW_POOLED_URL nesta rodada; typecheck passou. As provas remotas anteriores estão no runbook Etapa8, não foram repetidas nem atribuídas a este teste local.
- Dependências billing instaladas pelo lockfile com npm ci --offline --no-audit --no-fund;49 pacotes do cache, sem atualização de dependências.
- Wrangler4.138.0: dry-run preview e production passaram,397.64KiB/gzip97.05KiB cada, Queue/ENVIRONMENT próprios de cada ambiente. Nenhum deploy.
- CI: job billing_email adicional com working-directory/cache do pacote, npm ci/typecheck/test e ambos os dry-runs, sem credenciais externas. YAML analisado com parser; comandos equivalentes executados localmente. O resultado do GitHub Actions remoto não é certificado por esses comandos.
- Revisão independente focada na consolidação/compatibilidade/CI: nenhum Critical, Important ou Minor; aceita integração da feature branch. Sem repetir auditorias anteriores. Readiness de produção, ACLs remotas, webhook/email remotos e semântica anteriormente revisada continuam sob seus gates, não foram certificados novamente.

Arquivos do usuário docs/implementation-references preservados fora do staging. Nenhum email, evento Stripe, mutation Neon ou alteração Cloudflare executado nesta consolidação.

## Gate seguinte — API production

Avanço em06/10/2026: CI remoto da consolidação passou — API run37541826207/headba067ce; frontend run37541828898/headb16a27b, jobs verify e billing_email. A configuração local API production foi preparada na worktree API, reutilizando o facade realtime com flags/ingress desligados e recursos próprios. API488/488, workerd19/19, verificadores locais34/34 e production dry-run4484.87KiB/gzip765.05KiB passaram. Novo guard/CI sem deploy. R2 público production permanece desativado; Worker/DO production ainda não criados, secrets não instalados, CPU Free/pareamento real não certificados. Handoff na branch API: `docs/infra-migration-phase-13-production-preparation.md`. Estes resultados não declaram a Etapa13/cutover concluída.

CI da preparação: API run37543814966/head91c84d0 passou, incluindo guard e bundle production. Frontend run37543815569/headd877934 teve billing_email aprovado e verify174/175: `public-menu-catalog.test.tsx:78` consultava o item imediatamente após o nome do restaurante, antes de o efeito de seleção da categoria renderizar seus itens. O DOM remoto mostrava categoriaPratos e lista vazia intermediária; não houve alteração de app/dependências/workflow nesse commit documental. Teste isolado local passou, confirmando intermitência. Correção limitada ao teste: aguardar `findByText` do próprio prato, sem timeout ampliado, sleeps, mocks novos ou mudança funcional. Suíte completa local após correção175/175; root typecheck/build:preview passaram. Novo CI da correção ainda deve ser conferido, sem chamar a falha anterior de sucesso.

Preparar configuração de produção com recursos próprios já existentes (Neon role/Hyperdrive/R2), secrets sem cópia de preview e namespace realtime próprio; não recriar funcionalidades. Antes de expor tráfego: definir configuração final de origens/cookies, ensaiar o pareamento real e webhook em modo de teste, verificar limites Free e recuperação HTTP, confirmar bindings/isolamento e rollback. Não ampliar Access para produção, contratar plano pago ou ativar Stripe Live por inferência.

O cutover público, main/integração final e aposentadoria Coolify/Hetzner não aconteceram aqui. A Etapa13 completa exige esses gates de ativação; este documento registra somente a consolidação preparatória, sem declarar o cutover concluído.

## Continuação remota em06/10/2026

A API `vapt-api-production` foi implantada reutilizando o runtime91c84d0, ainda sem workers.dev, Preview URLs, rotas, custom domains ou Cron. Namespace SQLite própriod3ad7a4008c64124b765f934986956da, Hyperdrive e R2 production confirmados por GET. Secrets independentes de assinatura, Resend auth restrito e Turnstile do widget existente instalados sem valores em Git/logs; CORS versionado aplicado no bucket production, cuja leitura pública continua desativada. Faltam credenciais R2/Stripe e testes funcionais/CPU antes do cutover; não houve main, DNS, Stripe Live, ampliação Access ou plano pago. Detalhes e rollback estão no handoff API `docs/infra-migration-phase-13-production-preparation.md`. As afirmações anteriores de recursos/secrets não alterados descrevem a consolidação local anterior, não esta continuação.

CI da correção frontendd74d507 confirmado: run37544183319 aprovado (verify e billing_email). A falha175ª da execução anterior permanece registrada, sem atribuí-la a sucesso.

Continuação do mesmo gate: token R2 production próprio restrito ao bucket aprovado/criado, chaves instaladas como secrets; Stripe Test local do catálogo reutilizado e webhook própriowe_1UNjPKQYNWCekS7FvWV2SZuo preparado **desativado**, secret emitido pelo provedor instalado. Oito secrets confirmados, versão API4a33769a-1958-484d-9dbc-bcca9d1b0048. HTTP interno autenticado: health200/ready200, e catálogo de slug sintético inexistente404 após SELECT production, com rate limiter nativo mantido. Primeira tentativa429 por ausência de CF-Connecting-IP no operador foi diagnosticada sem mudar runtime; teste usa IP sintético, não certifica borda/browser. Transporte descartado. Credenciais completas não equivalem a auth/upload/pagamento/ACL/CPU Free/cutover concluídos. R2 e API continuam sem URLs públicas; main/DNS/Access/planos inalterados. CI documental anterior API2f8a84d/run37555280420 e F e5234e4/run37555269039 success.

## Gate funcional privado em07/10/2026

CI dos heads API66aba971/run37556456162 e frontend253f313d/run37556459318 confirmado success. Teste remoto na API production existente aprovou11 checks: ACL SQL atual sem alterar grants,401 sem sessão,400 sem CAPTCHA, catálogos isolados, pedidos concorrentes com replay201/200 sem duplicação, tokens públicos restritos ao pedido, conflito de idempotência409, rejeição de item e sessão de outro restaurante, solicitações de conta corretas e controle SQL de dois pedidos/duas sessões/zero outbox. Dois restaurantes sintéticos foram removidos com cleanup em finally e zero resíduos conferidos em12 tabelas; transport/pool encerrados. Não houve deploy, alteração de código runtime/secrets, email ou evento de pagamento.

O transporte interno rejeita o headerOrigin antes de chegar à aplicação; o operador servidor-a-servidor o omite. Não foi contornada a política CORS/CSRF, não houve ampliação Access, e não se declara pareamento/browser comprovado. Turnstile positivo, CRUD autenticado/menu/cozinha/caixa, R2 upload/read/delete/imagens, entrega Stripe/ciclo Test, CPU Free e rollback continuam gates antes do cutover. API/R2 públicos desligados; realtimefalse; webhook Testdisabled; main/DNS/planos preservados. Evidência detalhada e limites no handoff API `docs/infra-migration-phase-13-production-preparation.md`.
