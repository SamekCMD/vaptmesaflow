import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";

const migrationsDir = path.resolve("supabase/migrations");
const databaseTestsDir = path.resolve("supabase/tests");
const expectedFiles = [
  "20260914180000_01_extensions_core_prerequisites.sql",
  "20260914180100_02_organizations_accounts_restaurants.sql",
  "20260914180200_03_menu_orders_operational_schema.sql",
  "20260914180300_04_current_payment_infrastructure.sql",
  "20260914180400_05_functions_triggers_rpcs.sql",
  "20260914180500_06_rls_grants_views.sql",
  "20260914180600_07_storage_realtime.sql",
];

test("the executable Supabase baseline contains only the seven ordered recovery migrations", async () => {
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  assert.deepEqual(files, expectedFiles);
});

test("the recovery baseline excludes lost-data backfills and retired infrastructure", async () => {
  const sql = (
    await Promise.all(expectedFiles.map((file) => readFile(path.join(migrationsDir, file), "utf8")))
  ).join("\n");

  for (const forbidden of [
    /asaas_/i,
    /billing_provider_events/i,
    /organization_subscription_backfill_conflicts/i,
    /stripe_customer_id/i,
    /stripe_subscription_id/i,
    /n8n/i,
  ]) {
    assert.doesNotMatch(sql, forbidden);
  }
});

test("the baseline creates dependencies before their first reference", async () => {
  const sql = (
    await Promise.all(expectedFiles.map((file) => readFile(path.join(migrationsDir, file), "utf8")))
  ).join("\n").toLowerCase();

  const positions = {
    organizations: sql.indexOf("create table public.organizations"),
    organizationMembers: sql.indexOf("create table public.organization_members"),
    restaurants: sql.indexOf("create table public.restaurants"),
    orders: sql.indexOf("create table public.orders"),
    paymentTransactions: sql.indexOf("create table public.payment_transactions"),
  };

  for (const [name, position] of Object.entries(positions)) {
    assert.notEqual(position, -1, `missing ${name}`);
  }

  assert.ok(positions.organizations < positions.organizationMembers);
  assert.ok(positions.organizations < positions.restaurants);
  assert.ok(positions.restaurants < positions.orders);
  assert.ok(positions.orders < positions.paymentTransactions);
});

test("active database regression tests do not depend on retired schema", async () => {
  const testFiles = (await readdir(databaseTestsDir)).filter((file) => file.endsWith(".sql"));
  const sql = (
    await Promise.all(testFiles.map((file) => readFile(path.join(databaseTestsDir, file), "utf8")))
  ).join("\n");

  for (const forbidden of [
    /asaas_api_key/i,
    /asaas_webhook_token/i,
    /organization_subscription_backfill_conflicts/i,
    /stripe_customer_id/i,
    /stripe_subscription_id/i,
  ]) {
    assert.doesNotMatch(sql, forbidden);
  }
});
