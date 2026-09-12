# Recovery email: link only

Template: public/auth-email-recovery.html. Signup confirmation is unchanged.
Recovery has no OTP entry screen, so its email contains only a reset button
and a fallback link. Both use {{ .ConfirmationURL }}; do not substitute SiteURL
or a hardcoded reset page, which would omit the verification token.

## Activation in the existing deployment

1. Publish this frontend branch. Verify /auth-email-recovery.html on the new
   deployment returns the actual HTML template, not a login page or SPA fallback.
2. Use the existing EasyPanel mailer configuration path. The Auth setting is
   GOTRUE_MAILER_TEMPLATES_RECOVERY, pointing to that published HTML URL. A Compose
   Environment alias such as MAILER_TEMPLATES_RECOVERY only works if the current
   source already maps it into Auth. Verify that mapping before instructing a
   change; adding an unmapped variable alone has no effect.
3. Do not fork EasyPanel, change images/volumes, or rebuild infrastructure for
   this template. Preserve SITE_URL, API_EXTERNAL_URL, SMTP, and redirect allowlist.
   Do not overwrite the confirmation template setting.
4. After merge/publication to the stable domain, the intended template URL is
   https://vapt.app.br/auth-email-recovery.html. Do not use it before publication.
   A verified publicly accessible preview URL can be used for testing first.
5. If the mailer setting changes, apply it through the existing EasyPanel Deploy
   control. No SQL migration or Vapt API code change is needed. A frontend push
   alone does not activate a new Supabase email template.

Validate one recovery email: Vapt styling, no numeric OTP, reset button and
fallback link. Do not log or share actual recovery links. If activation fails,
restore only the previous recovery template setting using the same mechanism.

Reference: https://supabase.com/docs/guides/self-hosting/custom-email-templates
