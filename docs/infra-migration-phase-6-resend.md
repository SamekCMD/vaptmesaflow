# Phase 6 — Resend auth-template inventory

Inventory date: 2026-09-25

This inventory was read from the authenticated Resend dashboard. It contains no API key and no recipient data.

## Published templates

| Purpose | Template ID | Alias | Status | Configured sender | Published variables | Fallback/default |
| --- | --- | --- | --- | --- | --- | --- |
| Account confirmation | `8aedd871-bd59-4922-b153-3750efc154b8` | `account-confirmation` | Published | `no-reply <no-reply@vapt.app.br>` | `CONFIRMATION_CODE`, `CONFIRMATION_URL` | None declared; both variables are treated as required |
| Password reset | `555aa2c7-fd51-42d9-b687-9d8100839ff6` | `password-reset` | Published | `No-reply <no-reply@vapt.app.br>` | `RESET_PASSWORD_URL` | None declared; the variable is treated as required |

The account-confirmation editor also showed an unpublished draft. The integration targets the published template by alias and must not assume that draft content is active.

## Contract ruling

The published templates do not contain `USER_NAME` or `ACTION_URL`. The API boundary therefore uses the exact published variables:

- verification: `CONFIRMATION_CODE` receives the Better Auth verification token and `CONFIRMATION_URL` receives its verification URL;
- password reset: `RESET_PASSWORD_URL` receives the Better Auth password-reset URL.

No HTML, plain text, or subject is duplicated in code. Runtime configuration should use `account-confirmation` for `RESEND_TEMPLATE_VERIFY_ACCOUNT`, `password-reset` for `RESEND_TEMPLATE_RESET_PASSWORD`, and an approved sender at `no-reply@vapt.app.br` for `EMAIL_FROM`.

## Activation gate

Before sending a real preview email, confirm that the published account-confirmation layout renders the Better Auth token acceptably in the confirmation-code block. This inventory and the unit-tested adapter do not send remote email.
