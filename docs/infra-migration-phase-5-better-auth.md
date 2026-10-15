# Fase 5 — Better Auth no Neon

Status em 27/09/2026: validação de `preview` e promoção de schema para
`production` concluídas. Não houve deploy, troca de DNS ou cópia de identidades.

## Revisões validadas

- frontend: `e0e277b40cbe92760689a9186ac171afc5f3ea37`;
- API: `90071ebfc681b8dc07177f974957eb45534066c6`;
- hardening de reset de senha: `31c77dc337f572ce6f31a1fe1303adf1dc7395f5`.

Versões usadas no gate:

```text
Node.js       24.13.0
Better Auth   1.7.6
Fastify       5.2.1
pg            8.23.0
Kysely        0.29.6
Resend        6.28.1
React         18.3.1
Vite          5.4.19
Vitest        3.2.4
PostgreSQL    18 / Neon
```

## Alvos Neon confirmados por IDs imutáveis

```text
Projeto:    vapt / dawn-morning-27332079
Preview:    br-rough-dew-b6ydeygb / database vapt
Production: br-odd-term-b6j2n9ms / database vapt
```

As duas branches estavam em estado `ready`; `production` continuava sendo a
branch primária/default. O database `vapt` pertence a `neondb_owner` em ambas.
Nenhuma connection string foi impressa ou versionada.

## Artefatos promovidos

Os mesmos bytes ensaiados em `preview` foram usados em `production`:

| Arquivo | SHA-256 |
| --- | --- |
| `infra/neon/001_business_schema.sql` | `B9F9C3642ECBB964F7F805CAEBB388AC87DA0EABA9861E3C07775145B9E9FB2C` |
| `infra/neon/002_business_routines.sql` | `88403B1CC0D987297328CE7DB097DAE646106EEF4492983618559EF5291F0E94` |
| `infra/neon/003_better_auth_schema.sql` | `E5914CB51AC56B9C63D87C33E39F25D51C89F85A66A410E776B667194A329CEB` |
| `infra/neon/verify-baseline.sql` | `E3D1C0227478D99B416AA333B4C42491C66FE7DD685FE0185219986EE711FF1B` |
| `infra/neon/verify-routines.sql` | `0841B6B4FD051D19DCCD69EFD72787D0B62DFF89C7DEF62819B82796FFB60208` |
| `infra/neon/verify-integrity.sql` | `1B7861F8811D97E1090A13A53D8626A3BA5F8B9D6084C97FE8E6BEBED3855290` |
| `infra/neon/verify-better-auth.sql` | `5F148FC06FC194D199D47FA8A48183193B8496CDE7235B701D8ED937154779AB` |

## Gate local

- API: 334/334 testes, build TypeScript e `git diff --check` passaram;
- frontend: 117/117 testes, build Vite e typecheck passaram;
- nenhuma requisição autenticada constrói bearer token do Supabase;
- operações protegidas usam cookie Better Auth com `credentials: include`;
- operações públicas omitem cookies.

## Ensaio em preview

O verificador do Better Auth falhou antes da migration com
`Missing schema: better_auth`. Depois de aplicar
`003_better_auth_schema.sql`, os quatro verificadores passaram:

```text
verify-baseline.sql      PASS
verify-routines.sql      PASS
verify-integrity.sql     PASS
verify-better-auth.sql   PASS
```

O fluxo real usou o database `vapt` da branch `preview`, URL local da API,
origens localhost exatas, as credenciais de teste publicadas pelo Cloudflare
Turnstile e os templates publicados do Resend.

| Aceite | Resultado |
| --- | --- |
| signup e criação de UUID PostgreSQL | PASS |
| envio, callback e verificação de e-mail | PASS |
| login após verificação | PASS |
| onboarding atômico | PASS |
| `better_auth.user.id = public.restaurants.owner_id` | PASS |
| logout e duas leituras posteriores sem sessão | PASS |
| solicitação e callback de reset | PASS |
| revogação da sessão anterior ao reset | PASS |
| senha antiga rejeitada | PASS |
| nova senha aceita | PASS |

O gate revelou dois contratos que os testes isolados não demonstravam:

1. Better Auth 1.7.6 não revoga sessões após reset por padrão. A API passou a
   configurar `revokeSessionsOnPasswordReset: true`.
2. O template publicado de confirmação exige a variável case-sensitive
   `confirmation_code`, enquanto `CONFIRMATION_URL` e `RESET_PASSWORD_URL`
   permanecem maiúsculas. O adaptador e os testes foram corrigidos.

Os templates usados foram:

| Finalidade | ID | Alias | Resultado remoto |
| --- | --- | --- | --- |
| confirmação | `8aedd871-bd59-4922-b153-3750efc154b8` | `account-confirmation` | Delivered |
| reset | `555aa2c7-fd51-42d9-b687-9d8100839ff6` | `password-reset` | Delivered |

Os dois envios foram direcionados apenas ao endereço sintético oficial
`delivered@resend.dev`. A chave criada para o ensaio tem somente permissão de
envio e está limitada ao domínio `vapt.app.br`; seu valor não foi persistido nem
versionado.

Depois do fluxo, a identidade, sessões, conta de credencial, restaurante e prato
sintéticos foram removidos. Duas tentativas remotas que falharam antes do aceite
deixaram uma verificação órfã; ela foi removida com filtro temporal e somente
depois de confirmar zero usuários. O estado final de `preview` foi:

```text
better_auth.user          0
better_auth.session       0
better_auth.account       0
better_auth.verification  0
public.restaurants        0
```

## Promoção para production

Antes da promoção, `verify-baseline.sql` falhou listando as 15 tabelas ausentes
e `verify-better-auth.sql` falhou com `Missing schema: better_auth`. Isso
registrou o estado vazio/RED de `production`.

Foram aplicados uma única vez e nesta ordem:

```text
infra/neon/001_business_schema.sql
infra/neon/002_business_routines.sql
infra/neon/003_better_auth_schema.sql
```

Depois da aplicação, os quatro verificadores passaram. O estado inicial de
`production` foi confirmado com zero usuários, sessões, contas, verificações e
restaurantes. Nenhuma identidade, UUID, senha, hash, sessão, restaurante ou
fixture de `preview`/Supabase foi copiada.

## Limites e rollback

- Vercel, Coolify, Easypanel, Hetzner e DNS não foram acessados nem alterados;
- não houve deploy do frontend ou da API nesta etapa;
- Better Auth/Neon Auth gerenciado não foi habilitado;
- a API key, tokens, URLs de ação e connection strings não constam nos logs de
  evidência nem no Git;
- rollback de aplicação: redeploy dos commits anteriores do frontend/API e
  deixar o schema `better_auth` ocioso; os schemas vazios não precisam ser
  apagados para reverter o runtime.

