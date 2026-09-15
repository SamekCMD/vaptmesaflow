# Variáveis da infraestrutura reconstruída

Este mapa separa **necessário agora** de opcional/deferred. Exemplos em `.env.example` são placeholders, não credenciais. Todos os segredos vêm da instalação nova ou do cofre de produção. Em `VITE_*`, só URLs e chaves deliberadamente públicas. A lista de Supabase self-hosted depende do release/compose instalado; conferi-la contra o `.env.example` desse release, não transplantar cegamente nomes de uma versão diferente ([referência Supabase self-hosted](https://supabase.com/docs/guides/self-hosting/docker)).

## Frontend / Vercel

| Nome | Agora? | Visibilidade / origem | Uso e formato | Estado |
| --- | --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Sim | Browser-safe; DNS/gateway novo | URL HTTPS `https://supabase.vapt.app.br`; `src/lib/env.ts`, cliente Supabase, Storage | ACTIVE |
| `VITE_SUPABASE_ANON_KEY` | Sim | Browser-safe **somente** anon/publishable; gerada pelo Supabase novo | API key pública; `src/lib/env.ts`, `src/lib/supabase.ts` | ACTIVE |
| `VITE_VAPT_API_BASE_URL` | Sim | Browser-safe; DNS da API | URL HTTPS `https://api.vapt.app.br`; clients de pedidos/pagamentos | ACTIVE |
| `VITE_PAYMENT_ENVIRONMENT` | Sim | Browser-safe; operador define `sandbox` na homologação | `sandbox`/`production`; `src/lib/env.ts` | ACTIVE |
| `VITE_TURNSTILE_SITE_KEY`, `VITE_TURNSTILE_ENABLED` | Opcional | Site key pública da Cloudflare; controle operacional | Chave pública e booleano; Auth/CAPTCHA no frontend. Exemplo de recuperação desliga até haver site key válida | OPTIONAL |
| `VITE_VAPID_PUBLIC_KEY` | Não | Chave pública VAPID; par privado deve ficar server-only | Push UI; **não ativar** enquanto `src/lib/push-notifications.ts` ainda chama ingest legado | DEFERRED |
| `VITE_LEGACY_STRIPE_ENABLED` | Sim | `false` | Trava explícita do checkout antigo via n8n | ACTIVE (deve permanecer `false`) |
| `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_STRIPE_PRICE_STARTER`, `VITE_STRIPE_PRICE_PRO`, `VITE_STRIPE_PRICE_BUSINESS` | Não | Chave/IDs públicos Stripe, quando integração direta existir | Assinatura SaaS; ignorados enquanto `VITE_LEGACY_STRIPE_ENABLED=false` | DEFERRED |

## Vapt API / Coolify

| Nome | Agora? | Secret? / origem | Uso e formato | Estado |
| --- | --- | --- | --- | --- |
| `NODE_ENV`, `PORT`, `HOST`, `LOG_LEVEL` | Sim | Não; configuração de deploy | `production`, `3000`, `0.0.0.0`, `info`; `src/lib/config.ts`, Dockerfile | ACTIVE |
| `CORS_ORIGINS` | Sim | Não; domínios aprovados | Lista CSV de origins HTTPS, sem path; dashboard/landing e previews permitidos explicitamente | ACTIVE |
| `SUPABASE_URL` | Sim | Não; URL pública/interna alcançável do Coolify | URL Supabase; `src/lib/config.ts`, cliente service role | ACTIVE |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | **Server-only**, gerada no Supabase novo | Chave privilegiada da API; nunca frontend/log. Confirmar compatibilidade da chave escolhida com cliente atual | ACTIVE |
| `SUPABASE_JWT_SECRET` | Sim na API atual | **Server-only**, do Supabase novo | Fallback HS256 em `src/lib/config.ts`/JWT. JWKS assimétrico já é verificado; remover fallback/env só após tarefa separada e teste no self-hosted | ACTIVE / TRANSITION |
| `VAPT_ADMIN_ENDPOINT_SECRET` | Sim | **Server-only**, aleatório, no cofre | Protege reconciliação administrativa; já desacoplado do n8n | ACTIVE |
| `PAYMENT_EFFECTS_POLL_INTERVAL_MS`, `PAYMENT_EFFECTS_BATCH_SIZE`, `PAYMENT_EFFECTS_LEASE_MS`, `PAYMENT_EFFECTS_MAX_ATTEMPTS`, `PAYMENT_EFFECTS_RETRY_BASE_MS` | Sim, com defaults | Não; inteiros positivos em ms/quantidade | Reconciliador/outbox em `src/lib/config.ts` | ACTIVE |
| `FRONTEND_URL`, `API_PUBLIC_URL` | Com MP | Não; origins HTTPS | Retorno OAuth MP ao dashboard e relay público da API | OPTIONAL / MP BLOCK |

## Mercado Pago direto na API

MP já é integração própria da API, não usa n8n. Configurar **todas** as variáveis do bloco juntas; configuração parcial é rejeitada pelo boot. `MERCADO_PAGO_REDIRECT_URI` deve ter o origin de `API_PUBLIC_URL`. Não inserir secrets em `VITE_*`.

| Nome | Origem / formato | Visibilidade | Estado |
| --- | --- | --- | --- |
| `MERCADO_PAGO_CLIENT_ID`, `MERCADO_PAGO_CLIENT_SECRET` | Aplicação Mercado Pago | Server-only (ID também mantido na API) | OPTIONAL NOW / ACTIVE WHEN HOMOLOGATING |
| `MERCADO_PAGO_REDIRECT_URI` | `https://api.vapt.app.br/payments/mercado-pago/oauth/callback` | URL pública, configuração server | OPTIONAL NOW |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Configuração webhook MP | Server-only | OPTIONAL NOW |
| `MERCADO_PAGO_ENVIRONMENT` | `sandbox` agora, `production` só no lançamento | Não-secret | ACTIVE |
| `MERCADO_PAGO_TEST_ACCESS_TOKEN` | Credenciais de teste MP | Server-only; **somente sandbox** | OPTIONAL NOW |
| `PAYMENT_TOKEN_ENCRYPTION_KEY` | 32 bytes aleatórios em base64, chave exclusiva de tokens OAuth | Server-only, backup criptografado | OPTIONAL NOW / REQUIRED WITH MP |

## Supabase / Auth / Storage / Postgres / Supavisor

O compose self-hosted novo precisa das URLs públicas (`SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL`, `SITE_URL` ou seus equivalentes efetivos), chaves API/JWT, `POSTGRES_PASSWORD` e secrets internos de Auth/Realtime/Storage/Supavisor. `SITE_URL` deve ser `https://dashboard.vapt.app.br`; redirects explícitos incluem callbacks de signup e recovery realmente usados. Gateway em `https://supabase.vapt.app.br` serve Auth `/auth/v1`, REST `/rest/v1`, Storage `/storage/v1` e Realtime `/realtime/v1`. Banco não deve ser publicado externamente. A [referência de self-hosting](https://supabase.com/docs/guides/self-hosting/docker) explica a geração das chaves e os serviços; [Auth config](https://supabase.com/docs/guides/self-hosting/auth/config) confirma configuração no compose.

Storage: buckets/policies são versionados nas migrations; o backend físico (file/S3/MinIO), suas credenciais server-only e o backup dos objetos são configuração do Supabase, não do frontend. Supavisor: senha e chaves internas pertencem ao compose/cofre; esta recuperação não requer `DATABASE_URL` exposta à API ou Vercel. A aplicação das migrations ocorre pelo Postgres privado.

Para a release oficial fixada, os nomes de configuração são:

| Grupo | Variáveis | Classificação |
| --- | --- | --- |
| Chaves e criptografia | `POSTGRES_PASSWORD`, `JWT_SECRET`, `SUPABASE_SECRET_KEY`, `JWT_KEYS`, `SECRET_KEY_BASE`, `REALTIME_DB_ENC_KEY`, `VAULT_ENC_KEY`, `PG_META_CRYPTO_KEY`, `S3_PROTOCOL_ACCESS_KEY_SECRET`, `DASHBOARD_PASSWORD`, `SERVICE_ROLE_KEY`, `SERVICE_ROLE_KEY_ASYMMETRIC` | Secrets server-only; gerar com os utilitários da release, guardar no cofre e backup criptografado. `JWT_SECRET`/legacy keys permanecem durante a transição. |
| Chaves públicas | `ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `ANON_KEY_ASYMMETRIC`, `S3_PROTOCOL_ACCESS_KEY_ID` | Somente anon/publishable pode ir ao browser. Access key S3 não é browser config e seu par secreto continua server-only. |
| URLs/Auth | `SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL`, `SITE_URL`, `ADDITIONAL_REDIRECT_URLS`, `JWT_EXPIRY`, `DISABLE_SIGNUP`, `ENABLE_EMAIL_SIGNUP`, `ENABLE_EMAIL_AUTOCONFIRM`, `ENABLE_PHONE_SIGNUP`, `ENABLE_PHONE_AUTOCONFIRM` | ACTIVE; valores não-secret. Redirects limitados ao dashboard e ao projeto Vercel da Vapt. Configuração de entrega de email permanece fora deste trabalho. |
| Banco/pooler | `POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_PORT`, `POOLER_PROXY_PORT_TRANSACTION`, `POOLER_DEFAULT_POOL_SIZE`, `POOLER_MAX_CLIENT_CONN`, `POOLER_TENANT_ID`, `POOLER_DB_POOL_SIZE` | ACTIVE, server-only operacional; portas não são publicadas na Internet. |
| Storage/API/gateway | `GLOBAL_S3_BUCKET`, `REGION`, `STORAGE_TENANT_ID`, `PGRST_DB_SCHEMAS`, `PGRST_DB_MAX_ROWS`, `PGRST_DB_EXTRA_SEARCH_PATH`, `API_GW_HTTP_PORT`, `KONG_HTTP_PORT`, `KONG_HTTPS_PORT`, `IMGPROXY_AUTO_WEBP`, `PROXY_DOMAIN` | ACTIVE conforme compose/overrides efetivos. Kong é override na release alvo e deve ser confirmado na instalação existente. |
| Studio | `DASHBOARD_USERNAME`, `STUDIO_DEFAULT_ORGANIZATION`, `STUDIO_DEFAULT_PROJECT` | Username/metadados server-side; Studio deve continuar protegido. |
| Opcionais não usados | `OPENAI_API_KEY`, `LOGFLARE_PUBLIC_ACCESS_TOKEN`, `LOGFLARE_PRIVATE_ACCESS_TOKEN`, `GOOGLE_PROJECT_ID`, `GOOGLE_PROJECT_NUMBER`, `FUNCTIONS_VERIFY_JWT`, `CERTBOT_EMAIL`, credenciais root MinIO/RustFS | OPTIONAL/disabled salvo se o compose efetivo habilitar o serviço. Não criar `OPENAI_API_KEY` ou analytics só para esta recuperação. |

## Email / Resend / Redis — WIP de outra sessão

`AUTH_EMAIL_*`, `RESEND_API_KEY`, configuração de Send Email Hook, Redis de email, remetente e redirects devem ser preservados **exatamente como estão** no worktree da outra sessão. Esta tarefa só prepara Auth, `auth.users`, URLs e ambiente para aquela sessão continuar. Não introduzir/remover SMTP, Resend ou Redis aqui. O self-hosted tem opções `SMTP_*`, mas a decisão de fluxo pertence ao WIP ([configuração geral](https://supabase.com/docs/guides/self-hosting/docker)). Nenhuma dessas credenciais deve ir a `VITE_*`.

## Legacy n8n e Stripe

| Nome | Decisão |
| --- | --- |
| `N8N_BASE_URL`, `N8N_TIMEOUT_MS`, `VAPT_APP_ENDPOINT_SECRET` | LEGACY / TO REMOVE. O runtime de recuperação não os exige; **não** configurar no Coolify novo. O código/workflows históricos ficam preservados para a migração futura. |
| `STRIPE_WEBHOOK_SIGNING_SECRET`, `STRIPE_WEBHOOK_TOLERANCE_SECONDS` | DEFERRED. Não registrar webhook Stripe no ambiente novo; webhook direto futuro terá configuração própria. |
| `VITE_LEGACY_STRIPE_ENABLED` | Definir `false`; credenciais antigas sozinhas não reativam o checkout. |
| IDs/chaves Stripe públicos no frontend | DEFERRED. Não ativar o modal enquanto a API direta não existir. |

## Verificação de exposição

Antes do deploy, inspeccionar Vercel/Coolify sem imprimir valores: nenhum `SERVICE_ROLE`, `JWT_SECRET`, secret MP, encryption key, SMTP/Resend, webhook/admin key ou senha Postgres pode aparecer em `VITE_*`. Origem de cada valor deve ser documentada no cofre de segredos e testada com valor real, não placeholder.
