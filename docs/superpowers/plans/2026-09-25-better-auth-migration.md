# Better Auth Preview Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir Supabase Auth por Better Auth no Vapt, ensaiando em `preview` e promovendo a mesma migration para `production`, com bancos de identidade vazios no Neon, novos IDs UUID, cookies HTTP-only, Turnstile e os templates Resend existentes — sem migrar contas, senhas, sessões ou UUIDs de teste.

**Architecture:** Better Auth será uma biblioteca interna da API, com núcleo independente de framework, PostgreSQL no schema `better_auth`, adaptador Fastify temporário e uma interface de email que encapsula Resend. A API normaliza a sessão em `{ userId, email, role }`; o frontend usa o cliente React do Better Auth e cookies com `credentials: "include"`. A ativação do frontend tem um gate explícito: nenhuma tela autenticada pode continuar dependendo de JWT/RLS do Supabase quando o `AuthContext` for trocado.

**Tech Stack:** Node.js 24, TypeScript/ESM, Fastify 5, Better Auth 1.7.6, PostgreSQL 18/Neon, `pg` 8.23.0, Kysely 0.29.6, Resend 6.28.1, React/Vite, Vitest, Node test runner, Cloudflare Turnstile.

**Spec:** [`docs/superpowers/specs/2026-09-25-better-auth-migration-design.md`](../specs/2026-09-25-better-auth-migration-design.md)

## Global Constraints

- Não copiar ou preservar usuários, UUIDs, hashes, senhas, identities ou sessões do Supabase Auth.
- Não consultar `auth.users`, não adicionar bcrypt e não manter validadores Supabase/Better Auth em paralelo na API nova.
- Não usar Neon Managed Auth.
- Não aplicar SQL não ensaiado em `production`. Primeiro validar a migration em `preview.vapt`; depois aplicar o mesmo baseline e a mesma migration versionada em `production.vapt`, sem copiar usuários ou fixtures entre branches.
- Não versionar `DATABASE_URL`, `BETTER_AUTH_SECRET`, `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY` ou qualquer cookie/token.
- Não recriar HTML/assunto dos emails; enviar somente template ID/alias e variáveis.
- Não fazer trabalho de Vercel, Coolify, Easypanel, Hetzner ou DNS nesta fase.
- Não portar a API inteira para Workers/Hyperdrive neste plano; o núcleo Better Auth deve apenas ficar pronto para receber um adaptador Worker depois.
- Não remover `@supabase/supabase-js` enquanto consultas de negócio ainda existirem; remover apenas seu uso para autenticação.
- Não ativar o frontend Better Auth enquanto onboarding, dashboard, menu, cozinha e configurações autenticadas dependerem de um JWT Supabase para RLS. Concluir primeiro o cutover de dados de negócio previsto na Fase 4.
- Manter `docs/implementation-references/` intocado.
- Trabalhar nos branches existentes `codex/infra-foundation`; fazer commits locais por tarefa, sem push ou PR sem autorização explícita.

## Review Focus

- Separação completa entre o segredo de token público de pedidos e o segredo de autenticação.
- Nenhuma regressão de tenant: `request.auth.userId` sempre vem da sessão Better Auth e ownership continua consultado no banco.
- Cookie `HttpOnly`/`Secure` e verificações CSRF/origin permanecem ativas; não expor token ao JavaScript.
- CORS aceita credenciais somente para origins exatas e nunca com `*`.
- O adaptador Fastify preserva múltiplos headers `Set-Cookie` e não confia no header `Host` para construir callbacks.
- IDs de todas as tabelas Better Auth são UUID e `better_auth.user.id` cabe diretamente em `public.restaurants.owner_id`.
- Turnstile protege exatamente signup, signin e request-password-reset.
- Respostas de signup/reset não enumeram emails.
- Testes não conectam no Neon nem enviam email real; integração remota ocorre somente no gate final de preview.
- A troca de autenticação do frontend só é feita depois do gate de acesso a dados de negócio.

---

## Repository Map

### Frontend / infraestrutura — `D:\Projetos\vaptmesaflow`

- `infra/neon/`: migrations SQL e verificadores aplicados manualmente ao Neon.
- `src/contexts/AuthContext.tsx`: contrato de autenticação consumido pela UI.
- `src/lib/auth-client.ts`: novo cliente React Better Auth.
- `src/lib/vapt-api-client.ts` e `src/lib/n8n-client.ts`: clientes que passarão a transportar cookies.
- `src/pages/auth/`: login, signup, verificação e recuperação.
- `src/pages/dashboard/SettingsPage.tsx` e `src/components/DashboardLayout.tsx`: consumidores do shape de usuário.
- `src/test/`: testes Vitest da integração da UI.

### API — `D:\Projetos\vaptmesaflow\.worktrees\vapt-api-infra-foundation`

- `src/lib/config.ts`: única origem de configuração de runtime.
- `src/modules/auth/`: núcleo Better Auth, resolver de sessão e rotas.
- `src/email/`: fronteira e implementação Resend.
- `src/plugins/auth.ts`: decoração do request e `requireAuth`.
- `src/plugins/cors.ts`: CORS com credentials e allowlist.
- `src/app.ts`: composição e injeção das dependências.
- `src/modules/orders/` e `src/modules/payments/`: tokens públicos hoje acoplados indevidamente a `SUPABASE_JWT_SECRET`.

## Dependency Order

```text
Task 0 (gate Fase 4)
       ├── Tasks 1–5 podem avançar no backend
       └── Tasks 6–8 só podem ativar depois do gate verde

Task 1 → Task 2 → Task 3 → Task 4 → Task 5
                              │
Task 0 verde ─────────────────┴→ Task 6 → Task 7 → Task 8 → Task 9
```

---

### Task 0: Registrar e verificar o gate de cutover dos dados autenticados

**Files:**

- Create: `docs/infra-migration-phase-5-readiness.md`
- Read only: `src/pages/dashboard/**/*.tsx`
- Read only: `src/pages/onboarding/OnboardingPage.tsx`
- Read only: `src/contexts/RestaurantContext.tsx`
- Read only: `src/hooks/**/*.ts`
- Read only: `src/components/**/*.tsx`

**Interfaces:** Nenhuma interface de runtime muda nesta tarefa. O artefato deve separar imports públicos aceitáveis (cardápio/delivery) de operações autenticadas que exigem ownership.

- [x] **Step 1: Provar o estado atual**

Run from the frontend root:

```powershell
rg -l '@/lib/supabase|integrations/supabase/client' src/pages/dashboard src/pages/onboarding src/contexts src/hooks src/components
```

Expected now: a non-empty list including at least onboarding, settings, menu management and kitchen. This is the reason the frontend auth cutover is not yet safe.

- [x] **Step 2: Classificar cada ocorrência**

Write `docs/infra-migration-phase-5-readiness.md` with this exact table shape:

```md
| Surface | Operation | Public or authenticated | Current transport | Required transport before Better Auth cutover |
|---|---|---|---|---|
```

For every file returned in Step 1, record whether the operation is public read, public order flow, or authenticated owner operation. Authenticated owner operations must target an API route backed by Neon before Task 6 is activated.

- [x] **Step 3: Define the binary gate**

Add this exact acceptance rule to the report:

```text
GREEN only when no authenticated frontend operation depends on a Supabase access token or auth.uid().
Public anonymous reads may remain temporarily only when explicitly listed and scheduled for later removal.
```

Re-run the inventory after the Fase 4 data-access work. Expected before Task 6: no protected surface requires Supabase auth. If still RED, stop after Task 5 and execute a separate Fase 4 data-access plan; do not add a Supabase JWT bridge.

- [x] **Step 4: Commit the evidence**

```powershell
git add docs/infra-migration-phase-5-readiness.md
git commit -m "docs: gate Better Auth on business data cutover"
```

---

### Task 1: Decouple public order tokens from the Supabase JWT secret

**Files:**

- Modify: `src/lib/config.ts`
- Modify: `src/lib/config.test.ts`
- Modify: `src/lib/config-mercado-pago.test.ts`
- Modify: `src/modules/orders/routes.ts`
- Modify: `src/modules/payments/routes.ts`
- Modify: `src/app.ts`
- Modify: `src/modules/payments/manual-payment.test.ts`
- Modify: `src/modules/payments/providers/mercado-pago/oauth.test.ts`
- Modify: `src/modules/storage/routes.test.ts`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:** Add `security.publicOrderTokenSecret: string` to `AppConfig`. Keep `supabase.jwtSecret` only until Task 5 removes Supabase JWT validation. Every `createOrderService(..., tokenSecret)` call must receive `config.security.publicOrderTokenSecret`.

- [x] **Step 1: Write failing config tests**

Add tests to `src/lib/config.test.ts`:

```ts
test("requires a dedicated public order token secret", () => {
  assert.throws(
    () => createConfig({ ...validEnv, PUBLIC_ORDER_TOKEN_SECRET: "" }),
    /Missing required environment variable: PUBLIC_ORDER_TOKEN_SECRET/,
  );
});

test("keeps public order signing independent from Supabase auth", () => {
  const config = createConfig({
    ...validEnv,
    PUBLIC_ORDER_TOKEN_SECRET: "order-token-secret",
    SUPABASE_JWT_SECRET: "supabase-auth-secret",
  });
  assert.equal(config.security.publicOrderTokenSecret, "order-token-secret");
  assert.notEqual(config.security.publicOrderTokenSecret, config.supabase.jwtSecret);
});
```

Run:

```powershell
npx tsx --test src/lib/config.test.ts
```

Expected: FAIL because `PUBLIC_ORDER_TOKEN_SECRET` is not parsed and `security` does not exist.

- [x] **Step 2: Implement the dedicated secret**

Add to `AppConfig` and `createConfig`:

```ts
security: {
  publicOrderTokenSecret: string;
};
```

```ts
const publicOrderTokenSecret = requireValue(env, "PUBLIC_ORDER_TOKEN_SECRET");
```

Return it under `security`. Replace all order/public-token uses of `config.supabase.jwtSecret`; auth validation remains unchanged until Task 5.

- [x] **Step 3: Update all test fixtures and docs**

Add `PUBLIC_ORDER_TOKEN_SECRET=replace-me` to `.env.example`, document it as an HMAC secret for public order tokens, and update every `AppConfig` literal or env fixture reported by:

```powershell
rg -n 'AppConfig\s*=|satisfies AppConfig|SUPABASE_JWT_SECRET|supabase\.jwtSecret' src .env.example README.md
```

Expected after edits: `supabase.jwtSecret` remains only in `src/plugins/auth.ts`, auth tests and config until Task 5; order/payment/storage signatures use `security.publicOrderTokenSecret`.

- [x] **Step 4: Verify**

```powershell
npm test
npm run build
```

Expected: PASS.

- [x] **Step 5: Commit**

```powershell
git add src .env.example README.md
git commit -m "refactor: separate public order token secret"
```

---

### Task 2: Pin Better Auth dependencies and add typed configuration

**Files:**

- Modify: API `package.json`
- Modify: API `package-lock.json`
- Modify: API `src/lib/config.ts`
- Modify: API `src/lib/config.test.ts`
- Modify: API `.env.example`
- Modify: API `README.md`
- Modify: frontend `package.json`
- Modify: frontend `package-lock.json`

**Interfaces:**

```ts
type BetterAuthConfig = {
  secret: string;
  url: URL;
  trustedOrigins: string[];
  databaseUrl: string;
  turnstileSecretKey: string;
  email: {
    resendApiKey: string;
    from: string;
    verifyAccountTemplate: string;
    resetPasswordTemplate: string;
  };
};
```

Add `betterAuth: BetterAuthConfig` to `AppConfig`. `BETTER_AUTH_URL` is the API origin; the default Better Auth base path remains `/api/auth`.

- [x] **Step 1: Write failing parser tests**

Table-drive the required variables in `src/lib/config.test.ts`:

```ts
const requiredBetterAuthVariables = [
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_TRUSTED_ORIGINS",
  "DATABASE_URL",
  "TURNSTILE_SECRET_KEY",
  "RESEND_API_KEY",
  "RESEND_TEMPLATE_VERIFY_ACCOUNT",
  "RESEND_TEMPLATE_RESET_PASSWORD",
  "EMAIL_FROM",
] as const;
```

For each key, blank it and assert `ConfigError`. Add tests that reject non-absolute `BETTER_AUTH_URL` and normalize `BETTER_AUTH_TRUSTED_ORIGINS` into exact origins without paths, credentials, query strings or fragments.

Run:

```powershell
npx tsx --test src/lib/config.test.ts
```

Expected: FAIL because the new config is not parsed.

- [x] **Step 2: Install exact versions**

API:

```powershell
npm install --save-exact better-auth@1.7.6 pg@8.23.0 kysely@0.29.6 resend@6.28.1
npm install --save-dev --save-exact @types/pg@8.20.0
```

Frontend:

```powershell
npm install --save-exact better-auth@1.7.6
```

Expected: lockfiles pin exact versions. Do not use `latest` in `package.json`.

- [x] **Step 3: Implement parser and fixtures**

Parse the nine variables into `config.betterAuth`; preserve `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` because business repositories still use them until the data cutover. Add the variables to `.env.example` with non-secret dummy values.

`BETTER_AUTH_SECRET` must be at least 32 characters; `BETTER_AUTH_TRUSTED_ORIGINS` uses the same comma-separated input convention as `CORS_ORIGINS`, but every entry is reduced to `new URL(value).origin` and duplicate origins are rejected.

- [x] **Step 4: Verify both projects**

API:

```powershell
npx tsx --test src/lib/config.test.ts
npm run build
```

Frontend:

```powershell
npm run build
```

Expected: PASS.

- [x] **Step 5: Commit separately**

API:

```powershell
git add package.json package-lock.json src/lib/config.ts src/lib/config.test.ts .env.example README.md
git commit -m "build: add Better Auth runtime dependencies"
```

Frontend:

```powershell
git add package.json package-lock.json
git commit -m "build: add Better Auth client"
```

---

### Task 3: Build and verify the Resend auth-email boundary

**Files:**

- Create: API `src/email/types.ts`
- Create: API `src/email/resend.client.ts`
- Create: API `src/email/email.service.ts`
- Create: API `src/email/email.service.test.ts`
- Create: frontend `docs/infra-migration-phase-6-resend.md`

**Interfaces:**

```ts
export type AuthEmailService = {
  sendVerification(input: {
    to: string;
    confirmationCode: string;
    confirmationUrl: string;
  }): Promise<void>;
  sendPasswordReset(input: {
    to: string;
    resetPasswordUrl: string;
  }): Promise<void>;
};

export type AccountConfirmationTemplateVariables = {
  CONFIRMATION_CODE: string;
  CONFIRMATION_URL: string;
};

export type PasswordResetTemplateVariables = {
  RESET_PASSWORD_URL: string;
};
```

- [x] **Step 1: Inventory the real templates before remote sending**

In the Resend dashboard or authenticated API, inspect the two published templates configured by `RESEND_TEMPLATE_VERIFY_ACCOUNT` and `RESEND_TEMPLATE_RESET_PASSWORD`. Record in `docs/infra-migration-phase-6-resend.md`:

- template ID or alias;
- published status;
- configured sender;
- exact variable names and fallback behavior;
- whether `USER_NAME` and `ACTION_URL` exist.

Do not record the API key. If variable names differ, use the exact published names in the type and tests below; do not edit remote HTML merely to fit this plan.

- [x] **Step 2: Write failing unit tests**

Use a fake with the same `emails.send` surface as the Resend SDK. Assert verification and reset calls send exactly:

```ts
{
  from: "Vapt <contato@vapt.example>",
  to: "gestor@vapt.test",
  template: {
    id: "account-confirmation",
    variables: {
      CONFIRMATION_CODE: "verification-token-redacted",
      CONFIRMATION_URL: "https://api.preview.example/api/auth/verify-email?token=redacted",
    },
  },
}
```

Also assert the payload has no `html`, `text` or `subject`, and that a Resend `{ error }` result rejects with an error that contains no recipient or action URL.

Run:

```powershell
npx tsx --test src/email/email.service.test.ts
```

Expected: FAIL because the service does not exist.

- [x] **Step 3: Implement the adapter**

`createResendAuthEmailService(client, config)` maps the two domain methods to the correct template ID and variables. Log only template kind and Resend request ID; never log `to`, any URL variable or token.

- [x] **Step 4: Verify and commit**

API:

```powershell
npx tsx --test src/email/email.service.test.ts
npm run build
git add src/email
git commit -m "feat: add Resend auth email service"
```

Frontend docs:

```powershell
git add docs/infra-migration-phase-6-resend.md
git commit -m "docs: inventory Resend auth templates"
```

---

### Task 4: Create the framework-neutral Better Auth runtime and schema migration

**Files:**

- Create: API `src/modules/auth/runtime.ts`
- Create: API `src/modules/auth/better-auth.ts`
- Create: API `src/modules/auth/better-auth.test.ts`
- Create: API `src/modules/auth/cli-auth.ts`
- Create: frontend `infra/neon/003_better_auth_schema.sql` (generated, then reviewed)
- Create: frontend `infra/neon/verify-better-auth.sql`
- Modify: frontend `docs/infra-migration-phase-4-neon.md`

**Interfaces:**

```ts
export type BetterAuthSession = {
  user: { id: string; email: string; name: string };
  session: { id: string; userId: string; expiresAt: Date };
};

export type AuthRuntime = {
  handler(request: Request): Promise<Response>;
  getSession(headers: Headers): Promise<BetterAuthSession | null>;
  close(): Promise<void>;
};

export type BackgroundTaskRunner = (task: Promise<unknown>) => void;
```

- [x] **Step 1: Write failing factory tests**

Test through exported pure option builders, not a real database:

- `database.schemaName === "better_auth"`;
- `advanced.database.generateId === "uuid"`;
- `emailAndPassword.enabled === true`;
- `emailAndPassword.requireEmailVerification === true`;
- `emailVerification.sendOnSignUp === true`;
- `emailVerification.sendOnSignIn === true`;
- trusted origins equal config;
- CAPTCHA provider is `cloudflare-turnstile` and its protected endpoints are exactly `/sign-up/email`, `/sign-in/email`, `/request-password-reset`;
- the verification callback passes `{ to, confirmationCode: token, confirmationUrl: url }` and the reset callback passes `{ to, resetPasswordUrl: url }` to the fake email service through `BackgroundTaskRunner`.

Run:

```powershell
npx tsx --test src/modules/auth/better-auth.test.ts
```

Expected: FAIL because the runtime does not exist.

- [x] **Step 2: Implement the core**

Use a Kysely PostgreSQL dialect so the schema is explicit:

```ts
database: {
  dialect: new PostgresDialect({ pool }),
  type: "postgres",
  schemaName: "better_auth",
},
advanced: {
  database: {
    generateId: "uuid",
    joins: true,
  },
},
```

Configure Better Auth with `baseURL`, `secret`, `trustedOrigins`, the official CAPTCHA plugin, `requireEmailVerification`, and the injected email service. Keep CSRF and origin checks enabled. `close()` ends only a pool created by this runtime.

`cli-auth.ts` exports the concrete Better Auth instance created by the same option builder, so generation cannot drift from runtime.

- [x] **Step 3: Generate the SQL with the pinned CLI**

With the preview `DATABASE_URL` present only in the current process, run from the API worktree:

```powershell
npx auth@1.7.6 generate --config src/modules/auth/cli-auth.ts --output ../../infra/neon/003_better_auth_schema.sql --yes
```

Expected: the file starts with `create schema if not exists "better_auth"` and creates schema-qualified `user`, `session`, `account`, and `verification` tables. Review the generated diff before any database application.

- [x] **Step 4: Harden and verify the migration**

Append explicit hardening to the generated SQL:

```sql
REVOKE ALL ON SCHEMA better_auth FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA better_auth FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA better_auth FROM PUBLIC;
```

Create `verify-better-auth.sql` that raises if:

- schema `better_auth` is absent;
- any of the four core tables is absent;
- any core `id` column is not PostgreSQL `uuid`;
- `better_auth.user.id` and `public.restaurants.owner_id` have different types;
- PUBLIC has schema/table privileges;
- any FK from `public.restaurants.owner_id` to `better_auth.user` was created.

- [x] **Step 5: Verify locally without applying remotely**

```powershell
npx tsx --test src/modules/auth/better-auth.test.ts
npm run build
```

Expected: PASS. Do not run the migration on production or preview yet.

- [x] **Step 6: Commit in each repository**

API:

```powershell
git add src/modules/auth/runtime.ts src/modules/auth/better-auth.ts src/modules/auth/better-auth.test.ts src/modules/auth/cli-auth.ts
git commit -m "feat: add Better Auth core runtime"
```

Frontend/infra:

```powershell
git add infra/neon/003_better_auth_schema.sql infra/neon/verify-better-auth.sql docs/infra-migration-phase-4-neon.md
git commit -m "feat: version Better Auth Neon schema"
```

---

### Task 5: Replace Supabase JWT validation with Better Auth sessions in Fastify

**Files:**

- Create: `src/modules/auth/fastify-handler.ts`
- Create: `src/modules/auth/session-resolver.ts`
- Create: `src/modules/auth/fastify-handler.test.ts`
- Modify: `src/plugins/auth.ts`
- Modify: `src/plugins/cors.ts`
- Modify: `src/modules/auth/routes.ts`
- Rewrite: `src/modules/auth/auth.test.ts`
- Modify: `src/app.ts`
- Modify: `src/app.test.ts`
- Modify: `src/lib/config.ts`
- Modify: `src/lib/config.test.ts`
- Delete: `src/lib/jwt.ts`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**

```ts
export type AuthContext = {
  userId: string;
  email: string | null;
  role: "authenticated";
};

export type SessionResolver = (
  headers: NodeJS.Dict<string | string[]>,
) => Promise<AuthContext | null>;

export type BuildAppDependencies = {
  authRuntime?: AuthRuntime;
};
```

- [ ] **Step 1: Write failing session tests**

Replace JWT construction in `auth.test.ts` with a fake `AuthRuntime`. Cover:

1. no cookie/session → 401;
2. invalid cookie/session → 401;
3. valid session → `/auth/me` returns `{ userId, email, role: "authenticated" }`;
4. a legacy `Authorization: Bearer <supabase-jwt>` with no Better Auth cookie → 401;
5. ownership lookup receives the UUID returned by Better Auth;
6. forbidden restaurant remains 403.

Run:

```powershell
npx tsx --test src/modules/auth/auth.test.ts
```

Expected: FAIL while `requireAuth` still parses bearer JWTs.

- [ ] **Step 2: Write failing Fastify bridge tests**

In `fastify-handler.test.ts`, inject a fake handler and assert:

- GET and POST under `/api/auth/*` are forwarded;
- request URL is based on configured `BETTER_AUTH_URL`, not an attacker-controlled `Host`;
- JSON body and `x-captcha-response` reach the Fetch `Request`;
- status/body/content-type are forwarded;
- multiple `Set-Cookie` headers survive as distinct response cookies;
- thrown handler errors become the API's generic 500 contract without token/cookie content.

- [ ] **Step 3: Implement the session resolver and auth guard**

Use `fromNodeHeaders` from `better-auth/node`. `requireAuth` must receive a `SessionResolver`, throw the existing generic 401 when it returns null, and never inspect `Authorization`.

Keep the existing Fastify request decoration and downstream `request.auth` contract.

- [ ] **Step 4: Mount Better Auth and inject runtime**

Change `buildApp` to:

```ts
export async function buildApp(
  config: AppConfig,
  dependencies: BuildAppDependencies = {},
) { /* ... */ }
```

Construct the real runtime only when no fake is provided, register its `close()` in `app.addHook("onClose", ...)`, mount `/api/auth/*`, then register `/auth/me` and ownership routes with the resolver.

- [ ] **Step 5: Enable credentialed exact-origin CORS**

Configure:

```ts
{
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Captcha-Response"],
}
```

Keep the existing exact allowlist callback. Add preflight tests proving an allowed origin gets `access-control-allow-credentials: true`, the response echoes only that origin, and an unknown origin is rejected.

- [ ] **Step 6: Remove the old JWT secret and verifier**

Delete `src/lib/jwt.ts`, remove `SUPABASE_JWT_SECRET` and `supabase.jwtSecret`, and update fixtures. Confirm the dedicated `PUBLIC_ORDER_TOKEN_SECRET` remains.

```powershell
rg -n 'SUPABASE_JWT_SECRET|supabase\.jwtSecret|verifySupabaseToken' src .env.example README.md
```

Expected: no matches.

- [ ] **Step 7: Verify and commit**

```powershell
npx tsx --test src/modules/auth/auth.test.ts src/modules/auth/fastify-handler.test.ts src/app.test.ts
npm test
npm run build
git add src .env.example README.md
git commit -m "feat: authenticate API sessions with Better Auth"
```

Expected: PASS.

---

### Task 6: Replace the frontend auth client and context — only after Task 0 is GREEN

**Gate:** Do not start this task while authenticated business operations still require Supabase JWT/RLS. If Task 0 is RED, stop here and finish the Fase 4 data-access cutover first.

**Files:**

- Create: `src/lib/auth-client.ts`
- Rewrite: `src/contexts/AuthContext.tsx`
- Rewrite: `src/test/auth-captcha-options.test.tsx`
- Create: `src/test/auth-session.test.tsx`
- Modify: `src/test/setup.ts`

**Interfaces:**

```ts
export type VaptUser = {
  id: string;
  email: string;
  name: string;
};

export type VaptSession = {
  id: string;
  userId: string;
  expiresAt: Date;
};

type AuthResult = { error: Error | null };

interface AuthContextValue {
  user: VaptUser | null;
  session: VaptSession | null;
  loading: boolean;
  signUp(email: string, password: string, name: string, captchaToken?: string): Promise<AuthResult>;
  signIn(email: string, password: string, captchaToken?: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string, captchaToken?: string): Promise<AuthResult>;
  resetPassword(token: string, newPassword: string): Promise<AuthResult>;
  updateName(name: string): Promise<AuthResult>;
  changePassword(currentPassword: string, newPassword: string): Promise<AuthResult>;
}
```

- [ ] **Step 1: Write failing client-contract tests**

Mock `@/lib/auth-client` and assert:

- signup calls `authClient.signUp.email({ email, password, name, callbackURL, fetchOptions.headers["x-captcha-response"] })`;
- signin uses the same header convention;
- password-reset request uses `redirectTo: ${window.location.origin}/reset-password` and the CAPTCHA header;
- reset uses `{ token, newPassword }`;
- `updateName` calls `authClient.updateUser({ name })`;
- password change uses `{ currentPassword, newPassword, revokeOtherSessions: true }`;
- no method calls `supabase.auth` or returns a token.

Run:

```powershell
npm test -- src/test/auth-captcha-options.test.tsx src/test/auth-session.test.tsx
```

Expected: FAIL.

- [ ] **Step 2: Create the Better Auth React client**

```ts
export const authClient = createAuthClient({
  baseURL: ENV.vaptApiBaseUrl,
  fetchOptions: { credentials: "include" },
});
```

Do not add local/session storage or a token getter.

- [ ] **Step 3: Rewrite the provider**

Use `authClient.useSession()` as the source of truth and normalize its data to `VaptUser`/`VaptSession`. After successful sign-in, sign-out, name update or password change, refetch the session. Convert Better Auth errors to `Error` without exposing server internals.

Set signup callback to `${window.location.origin}/login?verified=1`. Do not navigate from the provider.

- [ ] **Step 4: Verify**

```powershell
npm test -- src/test/auth-captcha-options.test.tsx src/test/auth-session.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/auth-client.ts src/contexts/AuthContext.tsx src/test/auth-captcha-options.test.tsx src/test/auth-session.test.tsx src/test/setup.ts
git commit -m "feat: use Better Auth in frontend context"
```

---

### Task 7: Implement verification, recovery and account-management UI

**Files:**

- Create: `src/pages/auth/VerifyEmailPage.tsx`
- Create: `src/pages/auth/ForgotPasswordPage.tsx`
- Create: `src/pages/auth/ResetPasswordPage.tsx`
- Modify: `src/pages/auth/LoginPage.tsx`
- Modify: `src/pages/auth/SignupPage.tsx`
- Modify: `src/pages/dashboard/SettingsPage.tsx`
- Modify: `src/components/DashboardLayout.tsx`
- Modify: `src/App.tsx`
- Modify: `src/test/login-turnstile.test.tsx`
- Create: `src/test/better-auth-flows.test.tsx`
- Modify: `src/test/settings-payment-tab.test.tsx`

**Interfaces:** UI consumes only the Task 6 `AuthContextValue`; pages never import `authClient` or Supabase auth directly.

- [ ] **Step 1: Write failing flow tests**

Cover:

- successful signup navigates to `/verify-email`, never `/onboarding`;
- verify page states that an email was sent without revealing whether an account already existed;
- login shows a confirmation when `?verified=1`;
- login status 403 produces a “verifique seu email” message without credential detail;
- forgot-password requires Turnstile when enabled and always shows the same success copy;
- reset page rejects missing/invalid token locally and calls `resetPassword` with a valid token;
- `DashboardLayout` displays `user.name`;
- Settings changes name through `updateName`;
- Settings requires current password, validates an 8-character minimum and uses `changePassword`.

Run:

```powershell
npm test -- src/test/login-turnstile.test.tsx src/test/better-auth-flows.test.tsx src/test/settings-payment-tab.test.tsx
```

Expected: FAIL.

- [ ] **Step 2: Add routes and pages**

Add public routes:

```tsx
<Route path="/verify-email" element={<VerifyEmailPage />} />
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/reset-password" element={<ResetPasswordPage />} />
```

The reset page reads `token` and `error` from `URLSearchParams`. Neither value is logged or persisted.

- [ ] **Step 3: Update existing screens**

Signup navigates to `/verify-email` after the generic successful result. Login gains a forgot-password link and resets Turnstile after success or terminal error. Settings replaces `user.user_metadata.full_name` with `user.name`, removes `supabase.auth.updateUser`, and adds the current-password field required by Better Auth.

- [ ] **Step 4: Verify and commit**

```powershell
npm test -- src/test/login-turnstile.test.tsx src/test/better-auth-flows.test.tsx src/test/settings-payment-tab.test.tsx
npm run build
git add src
git commit -m "feat: add Better Auth account flows"
```

Expected: PASS.

---

### Task 8: Move protected API traffic from bearer tokens to cookies

**Files:**

- Modify: `src/lib/vapt-api-client.ts`
- Modify: `src/lib/n8n-client.ts`
- Create: `src/test/api-cookie-credentials.test.ts`

**Interfaces:** Preserve existing public function names and response/error shapes. `requireAuth` remains an internal request option only to choose `credentials: "include"` versus `credentials: "omit"`; it no longer performs a client-side token check.

- [ ] **Step 1: Write failing transport tests**

Mock `fetch` and assert:

```ts
expect(fetch).toHaveBeenCalledWith(
  expect.any(String),
  expect.objectContaining({ credentials: "include" }),
);
expect(fetch.mock.calls[0][1]?.headers).not.toHaveProperty("Authorization");
```

Also assert a request with `requireAuth: false` uses `credentials: "omit"`, and a server 401 still becomes the existing typed client error.

Run:

```powershell
npm test -- src/test/api-cookie-credentials.test.ts
```

Expected: FAIL because both clients read `supabase.auth.getSession()` and send bearer tokens.

- [ ] **Step 2: Implement cookie transport**

Delete Supabase imports and `getAccessToken` helpers. Set:

```ts
credentials: requireAuth ? "include" : "omit"
```

Never construct an `Authorization` header. Let the API return 401 after validating the cookie.

- [ ] **Step 3: Prove auth code no longer imports Supabase**

```powershell
rg -n 'supabase\.auth|getSession\(\).*access_token|Authorization.*Bearer' src/contexts src/lib src/pages/auth src/pages/dashboard/SettingsPage.tsx src/components/DashboardLayout.tsx
```

Expected: no auth-related matches. Business-data Supabase imports may remain only where Task 0 explicitly classified them and only if the gate has a corresponding API cutover.

- [ ] **Step 4: Verify and commit**

```powershell
npm test -- src/test/api-cookie-credentials.test.ts
npm test
npm run build
git add src/lib/vapt-api-client.ts src/lib/n8n-client.ts src/test/api-cookie-credentials.test.ts
git commit -m "refactor: authenticate API requests with cookies"
```

Expected: PASS.

---

### Task 9: Validate in Neon preview, then promote the same migrations to production

**Files:**

- Modify: `docs/infra-migration-phase-4-neon.md`
- Create: `docs/infra-migration-phase-5-better-auth.md`
- Read: `infra/neon/003_better_auth_schema.sql`
- Read: `infra/neon/verify-better-auth.sql`

**Interfaces:** No new code interface. This task changes Neon preview first and production only after every preview gate passes; it records non-secret evidence for both.

- [ ] **Step 1: Re-run all local verification before external writes**

API:

```powershell
npm test
npm run build
```

Frontend:

```powershell
npm test
npm run build
```

Expected: all tests/builds PASS. Stop on any failure.

- [ ] **Step 2: Confirm the target by immutable IDs**

Before applying SQL, verify both targets in Neon:

```text
Project: dawn-morning-27332079
Branch: preview / br-rough-dew-b6ydeygb
Database: vapt
Branch: production / br-odd-term-b6j2n9ms
Database: vapt
```

Keep the preview and production SQL editor tabs visibly identified. Every initial application and integration test below targets preview; production is touched only in Step 6.

- [ ] **Step 3: Demonstrate RED then apply once**

Run `infra/neon/verify-better-auth.sql` against `preview.vapt` first. Expected: FAIL because `better_auth` is absent.

Apply `infra/neon/003_better_auth_schema.sql` once to `preview.vapt`. Then re-run the verifier. Expected: PASS.

Do not apply either file to production before Steps 4 and 5 are green.

- [ ] **Step 4: Run a live local preview flow**

Run frontend and API locally using:

- Neon preview `DATABASE_URL`;
- a local `BETTER_AUTH_URL` matching the API;
- exact localhost origins in CORS and Better Auth trusted origins;
- preview Turnstile keys;
- Resend preview/test recipient policy and the inventoried templates.

Execute:

```text
signup → verification email → verify → login → onboarding
logout → refresh remains logged out
forgot password → reset → old sessions rejected → new password login succeeds
ownership → the new Better Auth UUID equals restaurants.owner_id
```

If Fase 4 data access is not GREEN, do not fake this acceptance and do not mint a Supabase JWT bridge; record the blocker and stop before frontend activation.

- [ ] **Step 5: Validate database evidence**

In a transaction, verify the newly created identity uses UUID and can own a synthetic restaurant. Roll back any diagnostic-only insert. Confirm zero reads from Supabase `auth.*` and no imported legacy accounts.

- [ ] **Step 6: Promote the validated baseline and auth schema to production**

Because `production.vapt` is empty and has no customers, apply the already validated files in this exact order:

```text
infra/neon/001_business_schema.sql
infra/neon/002_business_routines.sql
infra/neon/003_better_auth_schema.sql
```

Then run:

```text
infra/neon/verify-baseline.sql
infra/neon/verify-routines.sql
infra/neon/verify-integrity.sql
infra/neon/verify-better-auth.sql
```

Expected: all verifiers PASS on `production.vapt`. Do not copy preview users, restaurants or fixtures; production starts empty and receives accounts only through its own public signup flow.

- [ ] **Step 7: Record the outcome without secrets**

`docs/infra-migration-phase-5-better-auth.md` must include:

- commit SHAs from both repositories;
- package versions;
- Neon project plus preview/production branch/database IDs;
- schema verifier result;
- template aliases/IDs but no API key;
- local acceptance result for each flow;
- explicit statement that legacy users/UUIDs/sessions were not migrated;
- explicit statement that production received only the validated migrations and no copied preview identities/data;
- explicit statement that Vercel/Coolify/Easypanel/Hetzner/DNS were not touched;
- rollback: redeploy previous frontend/API commit and leave `better_auth` idle.

- [ ] **Step 8: Final regression and commit**

```powershell
git add docs/infra-migration-phase-4-neon.md docs/infra-migration-phase-5-better-auth.md
git commit -m "docs: record Better Auth preview validation"
```

Expected: both worktrees clean except the pre-existing untracked `docs/implementation-references/` directory in the frontend repository.

---

## Final Acceptance Checklist

- [ ] No legacy account, UUID, password, hash or session was read or copied.
- [ ] `SUPABASE_JWT_SECRET`, `verifySupabaseToken` and bearer auth are absent from the new auth path.
- [ ] Public order tokens use `PUBLIC_ORDER_TOKEN_SECRET`.
- [ ] Better Auth tables exist under `better_auth` in both `preview.vapt` and `production.vapt`; both start without migrated legacy users.
- [ ] New identity IDs are PostgreSQL UUIDs compatible with `restaurants.owner_id`.
- [ ] Cookies are HTTP-only/secure in non-local environments and never exposed to frontend JavaScript.
- [ ] CORS and trusted origins are exact allowlists with credential support.
- [ ] Turnstile protects signup, signin and password-reset request.
- [ ] Resend uses existing published templates and no HTML/subject is duplicated in code.
- [ ] `/auth/me` and restaurant access preserve their existing response/error contracts.
- [ ] Authenticated business operations no longer depend on Supabase JWT/RLS before frontend activation.
- [ ] Production Neon received only migrations that passed preview; DNS, Vercel, Coolify, Easypanel and Hetzner were not changed.
- [ ] API/frontend tests and builds pass from clean checkouts.
