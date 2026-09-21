# Checklist da recuperação

Marque apenas após evidência no **ambiente real**. Testes locais não comprovam deploy. Antes de alterar a VPS, registrar versão do compose Supabase/Coolify, nomes dos contêineres e snapshot/backup disponível. Não executar o bootstrap em banco que já tenha dados Vapt.

## Banco e serviços Supabase

- [ ] Postgres acessível só pela rede privada/`docker exec`; senha nova guardada fora da VPS.
- [x] Migrations 01–07 aplicadas e registradas em 20/09/2026; verificação remota confirmou 7 checksums sem divergência. A reaplicação é protegida pelo histórico e pelos checksums do runner.
- [ ] `auth.users`, Auth signup/login/session e redirects para `dashboard.vapt.app.br` funcionando.
- [ ] `organizations`, `organization_members`, `account_preferences`, `restaurants` e onboarding RPCs presentes.
- [ ] Usuário sem membership não lê nem altera restaurante de outro tenant; owner/admin/manager/staff seguem a matriz autorizada.
- [ ] `organization_subscriptions` não pode ser lida por `anon`; apenas colunas de plano/trial expostas a `authenticated`.
- [ ] Buckets `menu-images`/`restaurant-assets` existem; uploads autorizados e leitura pública esperada; paths de outro tenant rejeitados.
- [ ] `orders` publicado em `supabase_realtime`; evento chega ao cliente autenticado e não vaza dados entre tenants.
- [ ] Tipos Supabase regenerados e sem divergência da baseline aplicada.

## API e frontend

- [x] API Coolify responde `/health` e `/health/ready` em `https://api.vapt.app.br`; ambos retornaram HTTP 200 em 21/09/2026.
- [x] CORS da API aceita `https://www.vapt.app.br`; a allowlist do deploy também contém apenas o domínio raiz, os domínios Vercel do projeto e o preview de recuperação explicitamente autorizado.
- [ ] Token Auth/JWKS é aceito pela API; membership ativo autoriza restaurante certo e rejeita outro.
- [x] Frontend Vercel em `https://www.vapt.app.br` usa a anon key pública do Supabase e `https://supabase.vapt.app.br`; nenhuma service role foi enviada à Vercel.
- [ ] Login, bootstrap de conta, onboarding, menu, pedido, caixa e dashboard funcionam no Supabase novo.
- [ ] Mercado Pago direto na API é homologado em sandbox quando as credenciais forem configuradas; nunca usar token de teste em produção.
- [x] Stripe legado permanece desativado por `VITE_LEGACY_STRIPE_ENABLED=false`; nenhum n8n foi restaurado e nenhuma credencial Stripe nova foi configurada.
- [ ] Push/VAPID fica desligado até substituir o ingest legado; feedback usa RPC própria e é protegido por pedido entregue.
- [ ] WIP Auth/Resend e worktrees sujos mantêm status e hashes originais; nenhuma configuração de email foi escolhida aqui.

## Resiliência

- [ ] Backup automático Postgres com retenção, checksum e cópia fora da VPS.
- [ ] Backup dos bytes Storage/MinIO/S3 separado do `pg_dump`.
- [ ] Segredos/compose/config Coolify e Supabase exportados de forma criptografada fora da VPS.
- [ ] Restore completo testado em host descartável; novo Auth login, upload e Realtime verificados após restore.
- [ ] Release Supabase efetiva e overrides registrados; divergência do alvo `infrastructure/supabase/.supabase-version` foi revisada, não sobrescrita.
- [ ] Manifesto de WIP conferido por `git status` e SHA-256 antes da integração.
- [ ] DNS/TLS/renovação dos domínios e monitoramento de backup/health documentados.
