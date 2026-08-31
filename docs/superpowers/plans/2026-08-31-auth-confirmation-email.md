# Auth Confirmation Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar um email de confirmação Vapt com OTP e botão funcional, eliminando `localhost` dos links gerados pelo Auth self-hosted.

**Architecture:** O frontend hospeda um HTML estático, sem dependências externas, em `vapt.app.br`. O GoTrue v2.177 busca esse template por URL e injeta `Token` e `ConfirmationURL`; um fork mínimo do compose do EasyPanel repassa as duas variáveis de configuração que a fonte atual omite.

**Tech Stack:** HTML para clientes de email, Go templates do Supabase Auth, Vite, Vitest, Docker Compose, EasyPanel e Resend SMTP.

---

## File Map

- Create `public/auth-email-confirmation.html`: template remoto consumido pelo GoTrue.
- Create `src/test/auth-email-template.test.ts`: contrato automatizado do conteúdo e das variáveis do template.
- Modify `docs/auth-abuse-protection-runbook.md`: configuração exata, ordem de rollout, validação e rollback no EasyPanel.
- Modify `supabase/code/docker-compose.yml` no fork de `easypanel-io/compose`: repasse do assunto e URL de template ao serviço `auth`.

### Task 1: Contract Test for the Confirmation Template

**Files:**
- Create: `src/test/auth-email-template.test.ts`
- Test: `src/test/auth-email-template.test.ts`

- [ ] **Step 1: Write the failing template contract test**

```ts
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const templatePath = path.resolve(
  process.cwd(),
  "public/auth-email-confirmation.html",
);

describe("Auth confirmation email template", () => {
  const template = readFileSync(templatePath, "utf8");

  it("keeps the GoTrue confirmation variables intact", () => {
    expect(template).toContain("{{ .Token }}");
    expect(template).toContain('href="{{ .ConfirmationURL }}"');
    expect(template.match(/{{ \.ConfirmationURL }}/g)).toHaveLength(2);
  });

  it("contains the Vapt confirmation copy and email-safe structure", () => {
    expect(template).toContain("Confirme seu email");
    expect(template).toContain("Confirmar meu email");
    expect(template).toContain('role="presentation"');
    expect(template).not.toMatch(/<script\b/i);
    expect(template).not.toMatch(/<img\b/i);
  });

  it("never embeds a local or preview host", () => {
    expect(template).not.toMatch(/localhost|127\.0\.0\.1/i);
    expect(template).not.toMatch(/vercel\.app/i);
  });
});
```

- [ ] **Step 2: Run the test and verify the missing-file failure**

Run:

```bash
npm test -- src/test/auth-email-template.test.ts
```

Expected: FAIL because `public/auth-email-confirmation.html` does not exist.

- [ ] **Step 3: Commit the failing test**

```bash
git add src/test/auth-email-template.test.ts
git commit -m "test: define auth confirmation email contract"
```

### Task 2: Vapt Confirmation Email HTML

**Files:**
- Create: `public/auth-email-confirmation.html`
- Test: `src/test/auth-email-template.test.ts`

- [ ] **Step 1: Create the static email template**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light only">
    <title>Confirme seu email</title>
  </head>
  <body style="margin:0;padding:0;background:#f8f8f7;color:#121210;font-family:'DM Sans','Segoe UI',Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f8f8f7;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;">
            <tr>
              <td style="padding:0 0 18px;color:#3d6c57;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
                Vapt<span style="color:#5c8a75;">.</span>
              </td>
            </tr>
            <tr>
              <td style="border:1px solid #e5e5e1;border-radius:12px;background:#ffffff;padding:40px 36px;box-shadow:0 8px 28px rgba(18,18,16,0.06);">
                <h1 style="margin:0 0 12px;font-size:25px;line-height:1.25;font-weight:650;letter-spacing:-0.4px;color:#121210;">
                  Confirme seu email
                </h1>
                <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#6d6d68;">
                  Use o código abaixo para concluir seu cadastro na Vapt.
                </p>
                <div style="margin:0 0 28px;border:1px solid #dce8e1;border-radius:10px;background:#f1f7f4;padding:20px;text-align:center;">
                  <div style="margin:0 0 8px;font-size:12px;line-height:1.4;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#3d6c57;">
                    Código de verificação
                  </div>
                  <div style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;font-size:32px;line-height:1.2;font-weight:700;letter-spacing:8px;color:#121210;">
                    {{ .Token }}
                  </div>
                </div>
                <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#6d6d68;">
                  Se preferir, confirme diretamente pelo botão:
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
                  <tr>
                    <td style="border-radius:7px;background:#5c8a75;">
                      <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 22px;color:#ffffff;font-size:15px;line-height:1.2;font-weight:600;text-decoration:none;">
                        Confirmar meu email
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#92928c;">
                  Se o botão não funcionar, copie e cole este endereço no navegador:
                </p>
                <p style="margin:0;overflow-wrap:anywhere;word-break:break-word;font-size:12px;line-height:1.5;color:#5c8a75;">
                  {{ .ConfirmationURL }}
                </p>
                <div style="margin:30px 0 0;border-top:1px solid #eeeeeb;padding:22px 0 0;">
                  <p style="margin:0;font-size:12px;line-height:1.6;color:#92928c;">
                    Não solicitou este cadastro? Ignore esta mensagem. Não compartilhe este código com ninguém.
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 4px 0;font-size:12px;line-height:1.5;color:#92928c;">
                Vapt · Gestão simples para restaurantes
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

- [ ] **Step 2: Run the focused test**

Run:

```bash
npm test -- src/test/auth-email-template.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 3: Build and inspect the copied public asset**

Run:

```bash
npm run build
```

Expected: build succeeds and creates `dist/auth-email-confirmation.html`.

Run:

```bash
rg -n "{{ \.Token }}|{{ \.ConfirmationURL }}|localhost|vercel\.app" dist/auth-email-confirmation.html
```

Expected: `Token` and `ConfirmationURL` are present; no `localhost` or
`vercel.app` match is present.

- [ ] **Step 4: Commit the template**

```bash
git add public/auth-email-confirmation.html
git commit -m "feat: add Vapt auth confirmation email"
```

### Task 3: EasyPanel Runbook and Compose Contract

**Files:**
- Modify: `docs/auth-abuse-protection-runbook.md`
- Modify in compose fork: `supabase/code/docker-compose.yml:111-126`

- [ ] **Step 1: Document the public URL and template variables**

Add this configuration to the Auth section of the runbook:

```dotenv
SITE_URL=https://vapt.app.br
API_EXTERNAL_URL=https://samuel-supabase.br8r5p.easypanel.host
SUPABASE_PUBLIC_URL=https://samuel-supabase.br8r5p.easypanel.host
MAILER_SUBJECTS_CONFIRMATION=Seu código de verificação chegou
MAILER_TEMPLATES_CONFIRMATION=https://vapt.app.br/auth-email-confirmation.html
```

State explicitly that `API_EXTERNAL_URL` builds the `/auth/v1/verify` link,
while `SITE_URL` and the request's allowed `redirect_to` control the final
frontend destination.

- [ ] **Step 2: Document the compose mappings**

Add these lines under the existing `GOTRUE_MAILER_AUTOCONFIRM` entry in the
fork's `supabase/code/docker-compose.yml`:

```yaml
GOTRUE_MAILER_SUBJECTS_CONFIRMATION: ${MAILER_SUBJECTS_CONFIRMATION}
GOTRUE_MAILER_TEMPLATES_CONFIRMATION: ${MAILER_TEMPLATES_CONFIRMATION}
```

Do not alter the image tag, volumes, SMTP mappings, database configuration or
other services in the compose fork.

- [ ] **Step 3: Document rollout and rollback order**

Add the following operational sequence to the runbook:

1. Deploy the frontend and verify the template URL returns HTTP 200.
2. Push the two-line compose change to the fork.
3. Point EasyPanel Source to that fork and the pinned branch.
4. Deploy the compose application so the `auth` service is recreated.
5. Test signup with a new address.
6. On failure, remove `MAILER_TEMPLATES_CONFIRMATION` and redeploy Auth; never
   revert `API_EXTERNAL_URL` to localhost.

- [ ] **Step 4: Verify documentation and commit**

Run:

```bash
rg -n "API_EXTERNAL_URL|MAILER_SUBJECTS_CONFIRMATION|MAILER_TEMPLATES_CONFIRMATION|GOTRUE_MAILER_TEMPLATES_CONFIRMATION" docs/auth-abuse-protection-runbook.md
git diff --check
```

Expected: all four settings are documented and `git diff --check` is clean.

Commit:

```bash
git add docs/auth-abuse-protection-runbook.md
git commit -m "docs: add Auth email template rollout"
```

- [ ] **Step 5: Create and commit the compose fork patch**

Run in a separate clone of the authenticated GitHub fork:

```bash
gh repo fork easypanel-io/compose --clone=false
gh repo clone "$(gh api user --jq .login)/compose" compose-vapt
git -C compose-vapt checkout 28-08-2025
git -C compose-vapt switch -c vapt-auth-email-template
```

Edit only `compose-vapt/supabase/code/docker-compose.yml` with the two mappings
from Step 2, then run:

```bash
git -C compose-vapt diff --check
git -C compose-vapt diff -- supabase/code/docker-compose.yml
git -C compose-vapt add supabase/code/docker-compose.yml
git -C compose-vapt commit -m "feat: configure Supabase confirmation template"
git -C compose-vapt push -u origin vapt-auth-email-template
```

Expected: the diff contains exactly two added environment mappings in the Auth
service, and the branch is available to EasyPanel.

### Task 4: Full Verification and Controlled Rollout

**Files:**
- Verify: `public/auth-email-confirmation.html`
- Verify: `src/test/auth-email-template.test.ts`
- Verify: `docs/auth-abuse-protection-runbook.md`

- [ ] **Step 1: Run frontend quality gates**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all tests pass, ESLint exits zero, and Vite build succeeds.

- [ ] **Step 2: Push the frontend branch and deploy its Vercel preview**

Run:

```bash
git push origin codex/multitenant-v2
```

Expected: the remote branch includes the template and Vercel produces a passing
deployment.

- [ ] **Step 3: Publish the template on the stable frontend domain**

Merge or promote the frontend deployment so the file is available at:

```text
https://vapt.app.br/auth-email-confirmation.html
```

Verify:

```bash
curl --fail --silent --show-error https://vapt.app.br/auth-email-confirmation.html
```

Expected: HTTP 200 content containing literal `{{ .Token }}` and
`{{ .ConfirmationURL }}`.

- [ ] **Step 4: Activate the compose fork in EasyPanel**

Set EasyPanel Source to the authenticated user's compose fork, branch
`vapt-auth-email-template`, build path `/supabase/code`, and compose file
`docker-compose.yml`. Keep the approved Environment values and deploy the
compose application.

Expected: Auth health check passes and signup remains enabled.

- [ ] **Step 5: Perform end-to-end signup verification**

Using an unused email address:

1. Complete Turnstile and submit signup from the current Vercel preview.
2. Confirm the email subject is `Seu código de verificação chegou`.
3. Confirm the OTP is visible and works in `/verify-email`.
4. Repeat with another unused email and use the button instead.
5. Confirm the button starts at
   `https://samuel-supabase.br8r5p.easypanel.host/auth/v1/verify`.
6. Confirm the final redirect returns to the authorized Vercel preview.
7. Confirm neither email contains `localhost`.

Expected: both confirmation paths create a valid session and reach onboarding.

- [ ] **Step 6: Remove test accounts after validation**

In Supabase Studio, open Authentication > Users, locate each address created in
Step 5, open its action menu and choose `Delete user`. Confirm that the selected
address is one of the disposable validation accounts before accepting the
destructive action.

Expected: each disposable account disappears from Auth Users. Cascades remove
legacy `profiles`, `user_roles` and `account_preferences`; audit history may
remain.

- [ ] **Step 7: Record completion in the implementation plan**

Mark the corresponding manual verification items complete in
`docs/implementation-references/Vapt_Codex_Implementation_Plan.md`, recording
the frontend commit, compose commit, deployment URL and validation date without
recording email addresses, tokens, passwords or API keys.
