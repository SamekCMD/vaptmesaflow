# Fresh install da Vapt

Estado desta entrega: baseline **validada localmente e aplicada ao Supabase real em 20/09/2026**. O preflight encontrou zero tabelas Vapt antes do bootstrap. As migrations 01–07 foram executadas em transações individuais e registradas com SHA-256; a verificação posterior confirmou 7 registros, zero divergências de checksum, 18/18 tabelas esperadas com RLS, os 2 buckets e `public.orders` na publicação `supabase_realtime`. Não há dump nem dados do ambiente perdido. O Supabase ativo foi inventariado no Coolify e está saudável, mas a API continua parada por ausência total de variáveis de ambiente e o serviço Supabase não possui backup agendado. Nenhum segredo é versionado aqui.

Checagem pública em 15/09/2026: `api.vapt.app.br/health` retornou HTTP 503; `dashboard.vapt.app.br` retornou Vercel `DEPLOYMENT_NOT_FOUND` (HTTP 404); `supabase.vapt.app.br/auth/v1/health` respondeu HTTP 401 sem API key, com `Server: kong/3.9.1`; `coolify.vapt.app.br` redirecionou para `/login`. O 401 prova apenas que Kong respondeu e exige chave, **não** que Auth esteja saudável. O `/health/ready` da API atual é um snapshot do worker, não um probe de conectividade Supabase; testar acesso real de banco/membership separadamente.

## Fonte de verdade

- `supabase/migrations/` contém somente migrations executáveis novas, numeradas 01–07. Não execute `supabase/migrations_legacy/` numa instalação vazia.
- `scripts/build-supabase-baseline.mjs` documenta a composição dos objetos finais a partir de DDL canônico e trechos escolhidos do histórico. Se a baseline for alterada antes do primeiro deploy, regenere as sete migrations e tipos. Após deploy, **não reescreva migrations aplicadas**: acrescente uma migration incremental.
- `scripts/apply-supabase-migrations.sh` exige um schema Vapt vazio na primeira execução, aplica cada arquivo em transação e registra versão e SHA-256 em `vapt_schema_migrations.applied`. A execução é idempotente e falha se uma migration aplicada tiver sido alterada. Não use `supabase db push` simultaneamente sem reconciliar as duas tabelas de histórico.
- `scripts/validate-supabase-baseline.test.mjs` verifica escopo/ordem; `scripts/verify-supabase-baseline-pglite.test.mjs` executa SQL e prova separação básica de tenants; `scripts/generate-supabase-types.mjs` produz `src/integrations/supabase/types.ts` sem Docker.

## Sequência no ambiente novo

1. Preservar o compose **efetivamente instalado** e comparar com a [matriz observada](../../infrastructure/supabase/deployed-stack.md). A stack atual usa Kong 3.9.1 e PostgreSQL 15.8.1.085; não atualizar gateway, major do banco ou imagens durante o bootstrap. Há alterações não salvas já presentes no serviço Coolify: exportar/diferenciar esse estado antes de qualquer Save ou Reset. Na configuração do Supabase, usar `https://supabase.vapt.app.br` como URL pública e `https://dashboard.vapt.app.br` como `SITE_URL`. API Auth externa deve apontar para `https://supabase.vapt.app.br/auth/v1`. Configure explicitamente os redirects necessários de signup/recovery antes de smoke tests. A [documentação atual de self-hosting](https://supabase.com/docs/guides/self-hosting/docker) descreve `SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL` e `SITE_URL`; a configuração de Auth é feita pelo compose/env, não pelo Studio no self-hosted ([Auth config](https://supabase.com/docs/guides/self-hosting/auth/config)).
2. Gerar/recolher **novas** chaves anon/publishable, service role, JWT signing e senha Postgres do ambiente; copiar para o cofre de segredos, nunca para Git ou `VITE_*` privilegiado. O self-hosted recente suporta chaves novas e assinatura assimétrica, mas a API atual ainda precisa do `SUPABASE_JWT_SECRET` para o fallback HS256 ([guia de chaves](https://supabase.com/docs/guides/self-hosting/self-hosted-auth-keys)).
3. Confirmar que o Supabase está limpo **para o schema Vapt** e que já existem `auth.users`, `storage.buckets`, `storage.objects`, roles `anon/authenticated/service_role` e publicação `supabase_realtime`. Não expor PostgreSQL/Supavisor à Internet; usar `docker exec` no contêiner privado.
4. Na VPS, fazer checkout do commit de recuperação e identificar o contêiner Postgres exato. Então executar:

   ```bash
   export SUPABASE_DB_CONTAINER='<nome-exato-do-container-postgres>'
   bash scripts/apply-supabase-migrations.sh
   ```

   O script verifica o alvo, aplica 01–07 em ordem e para no primeiro erro. Se uma migration falhar, a transação da migration não é registrada; investigar antes de repetir. Registre commit/release aplicados no histórico de deploy.

   Depois da aplicação, execute `bash scripts/run-supabase-sql-tests.sh` com o mesmo `SUPABASE_DB_CONTAINER`. O runner falha tanto em erro SQL quanto em qualquer resultado pgTAP `not ok`.
5. Conferir objetos no Postgres privado: `auth.users`; tabelas `organizations`, `organization_members`, `account_preferences`, `restaurants`, `orders`, `payment_transactions`; funções de onboarding e pedidos; RLS habilitada; buckets `menu-images` e `restaurant-assets`; `orders` em `supabase_realtime`; políticas e grants. Reexecutar o script deve reportar “Already applied” para as sete versões.
6. Configurar `vapt-api` no Coolify com o bloco mínimo do [mapa de ambientes](environment-variables.md). Em 15/09/2026 o recurso não tinha nenhuma variável e falhava primeiro em `CORS_ORIGINS`; não basta adicionar apenas essa variável, pois o processo valida o conjunto obrigatório em sequência. Expor somente `https://api.vapt.app.br`; confirmar `GET /health` e `GET /health/ready`, CORS de `dashboard.vapt.app.br`, token Supabase válido e acesso de membership. Mercado Pago pode ser configurado depois, em bloco completo. Não instalar n8n nem ativar Stripe legado.
7. Configurar frontend/Vercel com `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPT_API_BASE_URL`, `VITE_PAYMENT_ENVIRONMENT` e Turnstile conforme decisão de operação. Testar signup/login/session, bootstrap de conta, onboarding, troca de restaurante, menu, pedido, dashboard, upload em ambos os buckets e eventos Realtime. O WIP Auth/Resend pertence à outra sessão: não usar este smoke test para redesenhá-lo.

8. Concluir o [runbook de validação de restore](restore-validation.md) em host descartável antes de declarar a infraestrutura recuperável.

## Verificação local antes de qualquer deploy

```bash
npm ci
node scripts/validate-supabase-baseline.test.mjs
node scripts/verify-supabase-baseline-pglite.test.mjs
node scripts/generate-supabase-types.mjs
npx tsc --noEmit
npm test
npm run build
```

`npm test` e `npm run build` da API devem ser executados separadamente no repositório `vapt-api`. A geração de tipos deve produzir diff vazio quando a baseline não mudou. O harness PGlite simula objetos controlados pelo Supabase; ele **não substitui** teste de integração com os serviços Auth/Storage/Realtime reais.

## Histórico e recuperação futura

O histórico anterior foi movido intacto para `supabase/migrations_legacy/`: ele é referência de evolução, não sequência de instalação. Havia backfills para registros perdidos, reparos condicionados a políticas/tabelas antigas e estados Asaas/n8n/Stripe; executar tudo num banco vazio reconstruiria um estado intermediário incorreto. A baseline reflete o modelo confirmado de organizações → memberships → restaurantes, onboarding avançado e pagamentos atuais MP/manual, sem antecipar o redesign Stripe. Futuras alterações entram como novas migrations versionadas.

Backup deve incluir **dados** Postgres (incluindo `auth.users`), objetos físicos de Storage/S3/MinIO, configuração/segredos fora do Git e restore testado em host separado. `pg_dump` recupera objetos e registros de banco, mas não os bytes dos objetos Storage, configuração de Auth/SMTP, Edge Functions, DNS ou chaves externas ([limites de restore do Supabase](https://supabase.com/docs/guides/self-hosting/restore-from-platform)). Manter cópias externas à VPS, retenção definida e ensaio de restore periódico; sem isso, uma nova perda exigiria reconstrução e perderia novamente dados novos.
