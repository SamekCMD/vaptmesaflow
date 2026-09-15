import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const runner = await readFile(new URL("./apply-supabase-migrations.sh", import.meta.url), "utf8");
const sqlRunner = await readFile(new URL("./run-supabase-sql-tests.sh", import.meta.url), "utf8");

test("migration runner records and verifies SHA-256 checksums", () => {
  assert.match(runner, /checksum text not null/);
  assert.match(runner, /sha256sum/);
  assert.match(runner, /checksum mismatch/i);
});

test("pgTAP runner rejects assertion, plan and finish failures", () => {
  assert.match(sqlRunner, /not ok/);
  assert.match(sqlRunner, /# Looks like/);
  assert.match(sqlRunner, /1\\\.\\\./);
  assert.match(sqlRunner, /\[\[:space:\]\|\]/);
  assert.match(sqlRunner, /ON_ERROR_STOP=1/);

  const failedAssertion = /(^|[\s|])not ok(\s|$)/m;
  const finishFailure = /# Looks like/;
  const tapPlan = /(^|[\s|])1\.\.[0-9]+(\s|$)/m;
  assert.match("0|1..50\n1|ok 1 - works", tapPlan);
  assert.match("0|1..50\n2|not ok 2 - failure", failedAssertion);
  assert.match("1..3\n# Looks like you planned 3 tests but ran 2", finishFailure);
  assert.doesNotMatch("0|1..50\n1|ok 1 - works", failedAssertion);
});

test("migration runner rejects a non-empty Vapt schema before first baseline apply", () => {
  const canonicalTables = [
    "organizations", "organization_members", "organization_subscriptions",
    "restaurants", "account_preferences", "restaurant_activation_progress",
    "menu_items", "menu_item_variations", "table_sessions", "orders",
    "order_items", "order_feedback", "push_subscriptions",
    "payment_provider_accounts", "payment_transactions", "payment_webhook_events",
    "payment_oauth_states", "payment_effect_outbox",
  ];
  for (const table of canonicalTables) {
    assert.ok(runner.includes(`to_regclass('public.${table}')`), `preflight omits ${table}`);
  }
  assert.match(runner, /expected an empty Vapt schema/i);
});
