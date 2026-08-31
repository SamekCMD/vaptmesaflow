# Termly and Turnstile Essential Script Design

## Context

Termly Auto Blocker intercepts the dynamically inserted Cloudflare Turnstile
script and classifies it as `unclassified`. Users who decline optional cookies
therefore cannot load the security challenge or submit login, signup, and
password-recovery forms.

## Decision

Define `window.TERMLY_CUSTOM_BLOCKING_MAP` before loading the Termly resource
blocker and classify only `challenges.cloudflare.com` as `essential`. This is
the narrowest rule that lets the security control run without granting consent
to analytics, advertising, performance, or social-networking scripts.

The existing Turnstile component remains responsible for loading the script,
rendering the widget, clearing expired tokens, and keeping form submission
disabled until a valid client token is available.

## Alternatives Rejected

- A Termly dashboard domain rule would keep behavior outside version control
  and make preview environments harder to reproduce.
- Requiring users to accept optional cookies would make authentication depend
  on unrelated consent and would block users who decline tracking.

## Verification

1. Run the frontend test suite, lint, and production build.
2. Deploy the preview and decline optional cookies.
3. Confirm the Turnstile script retains its executable `src`, creates its
   iframe, and does not receive Termly's `data-autoblocked` marker.
4. Confirm login, signup, and password recovery remain disabled until the
   challenge returns a token.

