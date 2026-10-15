# Phase 7 execution decisions

These are the complete execution rulings retained from the temporary task ledger.
They are not new requirements or authorization for remote actions.

1. Continue the approved `codex/infra-foundation` branch in the existing root
   checkout and isolated API worktree; do not create another checkout for the same
   already-started migration. Root changes share the checkout but remain on the
   feature branch.
2. Task 0 is documentation/inventory only: verify its read-only evidence and
   report, without inventing a test for prose.
3. Bash is unavailable on this Windows host. Preserve the skill's protocol
   manually with task briefs, base commits, test logs and completion records.
4. Begin local Task 1 while Task 0 waits for Dashboard authentication. Keep both
   completion records separate; code does not depend on Dashboard writes.
5. Normalize legacy `stripe_gateway` event identity to `stripe`, retaining payloads
   and explicit retry/received status translation. Conflicting event identities
   fail the additive migration atomically rather than reprocess legacy events.
6. Hold the restaurant billing lock across first Customer association and pending
   Checkout creation/reuse to prevent duplicate subscriptions. Stripe timeouts are
   bounded; provider latency may extend only that tenant's transaction.
7. Keep legacy repository forwarding methods only until Task 4 installs the new
   service composition, preserving a compiling intermediate commit; deployment
   remains gated on subsequent tasks.
8. During the intermediate API cutover, change/cancel routes return authorized
   410 responses instead of mutating through n8n. Task 7 deletes them entirely;
   no intermediate undeployed commit is represented as deploy-ready.
9. Migrate PricingPage as an additional discovered shared-modal consumer. Its
   legacy CP1252 encoding was converted losslessly to UTF-8 to allow the scoped
   edit; preserve layout and Portuguese copy, without visual redesign.
10. Do not broaden billing into existing auth/order/menu TypeScript errors. The
    prescribed root check passes but does not inspect app sources; actual app
    comparison has 21 existing diagnostics and zero new ones. Report that limit.
11. Retrieve canonical Stripe Subscription while holding the tenant lock. A
    before-lock fetch can overwrite newer canonical state or lose invoice-owned
    email intents. Event fencing and bounded SDK requests retain safe ordering.
12. Decouple the live payment-effect maintenance endpoint from removed n8n config
    using independent optional `PAYMENT_EFFECTS_ADMIN_SECRET`, at least 32 chars.
    Absent secret keeps manual processing closed; automatic reconciliation stays.
13. Review exclusions are explicit gates: real PostgreSQL/lifecycle/cleanup and
    empty production require Tasks 9/10 evidence. Queue email delivery, Worker
    deployment/performance, baseline frontend types and unrelated auth/payment/UI
    changes remain in their later phases, not implicitly verified here.
14. Interpret canonical Stripe `cancel_at` equal to the sole item's
    `current_period_end` as scheduled end-of-period cancellation even when
    `cancel_at_period_end` is false. The real Test Mode Portal emitted this
    shape; without normalization Neon misses a customer-visible cancellation.
    If an explicit `cancel_at` coincides with that same end boundary, it is
    likewise shown as end-of-period cancellation, matching its outcome.

## Review dispositions

The fresh whole-branch review found zero Critical, four Important and one Minor.
Every Important finding was reproduced RED before its correction:

- Customer-only trials retain purchase buttons through safe `canStartCheckout`,
  distinct from Portal availability.
- In-flight webhook claims return retryable 503; terminal duplicates alone return
  success without additional processing.
- Email intents deduplicate by business resource as well as Stripe event, with
  the final additive migration updated before any remote application.
- Canonical state under the tenant lock is not rejected due to host-clock skew.

Deferred Minor: response loss or database rollback followed by a new browser
attempt key can leave an orphan Checkout Session. No duplicate charging was
demonstrated. Durable server-side attempt recovery remains follow-up hardening.

The unchanged full frontend suite also exposed one existing async menu assertion
race on its first run; the repeat passed. No unrelated test was weakened.
