# Phase 6 — Resend auth-template inventory

Inventory date: 2026-09-25; live contract validation: 2026-09-27

This inventory was read from the authenticated Resend dashboard. It contains no API key and no recipient data.

## Published templates

| Purpose | Template ID | Alias | Status | Configured sender | Published variables | Fallback/default |
| --- | --- | --- | --- | --- | --- | --- |
| Account confirmation | `8aedd871-bd59-4922-b153-3750efc154b8` | `account-confirmation` | Published | `no-reply <no-reply@vapt.app.br>` | `confirmation_code`, `CONFIRMATION_URL` | None declared; both variables are treated as required |
| Password reset | `555aa2c7-fd51-42d9-b687-9d8100839ff6` | `password-reset` | Published | `No-reply <no-reply@vapt.app.br>` | `RESET_PASSWORD_URL` | None declared; the variable is treated as required |

The account-confirmation editor also showed an unpublished draft. The integration targets the published template by alias and must not assume that draft content is active.

## Contract ruling

The published templates do not contain `USER_NAME` or `ACTION_URL`. The API boundary therefore uses the exact variables accepted by a live Resend send:

- verification: `confirmation_code` receives the Better Auth verification token and `CONFIRMATION_URL` receives its verification URL;
- password reset: `RESET_PASSWORD_URL` receives the Better Auth password-reset URL.

The dashboard preview renders the confirmation placeholder in uppercase, but the
published send contract is case-sensitive and accepts `confirmation_code` in
lowercase. The live preview gate first rejected `CONFIRMATION_CODE` with a
sanitized 422 missing-variable response; after the adapter was corrected, the
published template was delivered successfully. This remote result is authoritative
over the earlier visual inventory.

No HTML, plain text, or subject is duplicated in code. Runtime configuration should use `account-confirmation` for `RESEND_TEMPLATE_VERIFY_ACCOUNT`, `password-reset` for `RESEND_TEMPLATE_RESET_PASSWORD`, and an approved sender at `no-reply@vapt.app.br` for `EMAIL_FROM`.

## Activation gate completed

On 2026-09-27, the Better Auth preview flow sent both templates through a
domain-scoped, sending-only Resend API key to the official
`delivered@resend.dev` test address. The Resend dashboard reported `Delivered`
for both subjects:

- `Confirme seu e-mail para começar no Vapt`;
- `Redefina sua senha do Vapt`.

No recipient, token, action URL, API key or Resend request ID was written to Git.
The key value was used only in the validation process and removed from the
process environment and clipboard afterward.
