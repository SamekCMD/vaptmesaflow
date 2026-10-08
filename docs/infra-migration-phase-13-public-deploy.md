# Etapa 13 — deploy público reproduzível

## Gate local aprovado — 08/10/2026

Configurações explícitas preservam somente os dois domínios já autorizados nos Workers existentes. Não criam ambiente, recurso, credencial ou assinatura. Preparação privada e preview continuam separados. Etapa13 e cutover final permanecem abertos.

| Repositório | Config público | Destino | Comando protegido |
| --- | --- | --- | --- |
| Produto | `wrangler.production.jsonc` | `vapt-web` / `vapt.app.br` | `npm run deploy:production` |
| API | `wrangler.worker-production-public.jsonc` | `vapt-api-production` / `api.vapt.app.br` | `npm run deploy:worker-production-public` |

Ambos exigem conta `3ce69408aa5112617a282957aba71932`, keep_vars:true e exatamente um custom domain, sem wildcard ou ingresso adicional. API reutiliza o guard privado após normalizar somente o ingresso: CPU1000ms, recursos production, seis rate limiters, auth, StripeTest, realtimefalse e ausência de Cron permanecem exigidos. `wrangler.worker-production.jsonc` não foi alterado: é preparação privada com routes:[], **não usar para redeploy público**. Preview/produção não são recriados.

[Rotas declaradas no Wrangler substituem as configuradas no painel; keep_vars preserva variáveis externas e secrets só são removidos explicitamente](https://developers.cloudflare.com/workers/wrangler/configuration/). Guard estático não verifica estado remoto ou limita fatura. Preflight e readback continuam obrigatórios.

## Artefato do frontend

`npm run build:production` valida config, fixa NODE_ENV=production, remove VITE_USER_NODE_ENV e desabilita carregamento/injeção automática de env no Vite. Define somente sete chaves públicas, inclusive no objeto dinâmico import.meta.env: API https://api.vapt.app.br; pagamento sandbox; imagens disabled; realtime false; Turnstile true/sitekey público existente; VAPID público opcional do setup local existente.

VAPID é validado no formato de chave pública P-256, vazio se ausente. Não há prova de correspondência com chave privada remota: este gate não certifica push. Nenhum valor privado é impresso/versionado; arquivos env não foram editados. Build normal/preview mantêm comandos e dist; produção usa dist-production ignorado pelo Git.

`npm run verify:production` confere origem/sitekey e ausência de chaves VITE não autorizadas/URLs antigas no JS gerado, retornando hash de index+JS. Não é assinatura ou manifesto de integridade de todos os assets. Deploy recompila, não reutiliza dist de preview.

## Verificações observadas

Testes primeiro falharam pela implementação ausente, depois passaram: frontend10/10 e guard API público5/5 mais privado8/8. Revisão focada encontrou NODE_ENV externo capaz de produzir semântica de desenvolvimento: duas reproduções RED (NODE_ENV e VITE_USER_NODE_ENV) corrigidas para DEV=false/PROD=true no build real Vite. Sem reabrir revisão histórica da branch.

Suítes finais frontend175/175, API539/539 e workerd22/22; TypeScript nos dois repositórios e dry-runs públicos passaram. Build frontend77JS/85assets, SHA256 index+JS `22aff8c5de01f6bec4c777aba5bca50aa56596eaa72a82a900a1130c63524aab`. API4491.08KiB/gzip766.76KiB. Dry-run não publica. CI executa gates e dry-runs, sem job de deploy/token novo; checks dos novos heads precisam ser consultados separadamente.

## Publicação e recuperação

Antes dos comandos protegidos, confirmar versões a100%, conta, IDs dos dois vínculos, CPU1000, oito nomes de secrets, mesmos Hyperdrive/R2/DO/rates, StripeTest/realtimefalse/Cron0, R2 privado e ingresso alternativo API desligado. Registrar versões anteriores para rollback. Não remover/recriar vínculos ou repontar outros DNS.

Depois, confirmar novas versões a100% e os mesmos controles/IDs; comparar index servido com dist-production/index.html, health/readiness SQL, sessão anônima, ausência de acesso sem cookie, catálogo ausente e CORS/preflight. Isto não substitui gate browser já comprovado nem certifica carga/provedores. Se falhar, restaurar somente versões anteriores compatíveis mantendo vínculos existentes e repetir readback; rollback de código não reverte dados/recursos.

Estado remoto anterior: frontend `deb94199-9d96-4db5-bcc5-e4d7f027298c`, API `eeb0d212-ad66-4c0a-90ec-7117b89a4266`. IDs/rollback anteriores em infra-migration-phase-13-browser-pairing.md. Qualificação dos novos comandos por publicação/readback ainda pendente neste registro local; artefato validado não é artefato publicado.

Fora desta mudança: main/merge, StripeLive, ZeroTrust production, novos planos, exposição de imagens, ativação realtime, capacidade/observabilidade, backup amplo e desligamentoVPS.
