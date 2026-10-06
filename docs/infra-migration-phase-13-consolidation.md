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

Preparar configuração de produção com recursos próprios já existentes (Neon role/Hyperdrive/R2), secrets sem cópia de preview e namespace realtime próprio; não recriar funcionalidades. Antes de expor tráfego: definir configuração final de origens/cookies, ensaiar o pareamento real e webhook em modo de teste, verificar limites Free e recuperação HTTP, confirmar bindings/isolamento e rollback. Não ampliar Access para produção, contratar plano pago ou ativar Stripe Live por inferência.

O cutover público, main/integração final e aposentadoria Coolify/Hetzner não aconteceram aqui. A Etapa13 completa exige esses gates de ativação; este documento registra somente a consolidação preparatória, sem declarar o cutover concluído.
