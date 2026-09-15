# Checklist da recuperação

Marque apenas após evidência no **ambiente real**. Testes locais não comprovam deploy. Antes de alterar a VPS, registrar versão do compose Supabase/Coolify, nomes dos contêineres e snapshot/backup disponível. Não executar o bootstrap em banco que já tenha dados Vapt.

## Banco e serviços Supabase

- [ ] Postgres acessível só pela rede privada/`docker exec`; senha nova guardada fora da VPS.
- [ ] Migrations 01–07 aplicadas e registradas; segunda execução idempotente.
- [ ] `auth.users`, Auth signup/login/session e redirects para `dashboard.vapt.app.br` funcionando.
- [ ] `organizations`, `organization_members`, `account_preferences`, `restaurants` e onboarding RPCs presentes.
- [ ] Usuário sem membership não lê nem altera restaurante de outro tenant; owner/admin/manager/staff seguem a matriz autorizada.
- [ ] `organization_subscriptions` não pode ser lida por `anon`; apenas colunas de plano/trial expostas a `authenticated`.
- [ ] Buckets `menu-images`/`restaurant-assets` existem; uploads autorizados e leitura pública esperada; paths de outro tenant rejeitados.
- [ ] `orders` publicado em `supabase_realtime`; evento chega ao cliente autenticado e não vaza dados entre tenants.
- [ ] Tipos Supabase regenerados e sem divergência da baseline aplicada.

## API e frontend

- [ ] API Coolify responde `/health` e `/health/ready` em `https://api.vapt.app.br`.
- [ ] CORS permite dashboard e somente previews Vercel explicitamente autorizados.
- [ ] Token Auth/JWKS é aceito pela API; membership ativo autoriza restaurante certo e rejeita outro.
- [ ] Frontend Vercel em `https://dashboard.vapt.app.br` usa anon/publishable key, nunca service role.
- [ ] Login, bootstrap de conta, onboarding, menu, pedido, caixa e dashboard funcionam no Supabase novo.
- [ ] Mercado Pago direto na API é homologado em sandbox quando as credenciais forem configuradas; nunca usar token de teste em produção.
- [ ] Stripe é apresentado como temporariamente indisponível, sem rota/workflow n8n registrado.
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
