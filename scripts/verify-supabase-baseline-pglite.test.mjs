import assert from "node:assert/strict";
import { test } from "node:test";
import { createSupabaseBaselineDatabase } from "./supabase-baseline-harness.mjs";

test("the recovery baseline applies cleanly to an empty Supabase-compatible database", async () => {
  const database = await createSupabaseBaselineDatabase();

  try {
    const tables = await database.query(`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
    `);
    const tableNames = new Set(tables.rows.map(({ table_name: tableName }) => tableName));

    for (const expectedTable of [
      "organizations",
      "organization_members",
      "restaurants",
      "account_preferences",
      "orders",
      "order_feedback",
      "payment_provider_accounts",
      "payment_transactions",
      "payment_webhook_events",
    ]) {
      assert.ok(tableNames.has(expectedTable), `missing table ${expectedTable}`);
    }

    const policies = await database.query(`
      select schemaname, tablename, policyname
      from pg_policies
      where schemaname in ('public', 'storage')
    `);
    assert.ok(policies.rows.length >= 20, "expected the baseline RLS policies");

    const grants = await database.query(`
      select
        has_table_privilege('authenticated', 'public.organizations', 'SELECT')
          as can_read_organizations,
        has_table_privilege('authenticated', 'public.organization_members', 'SELECT')
          as can_read_memberships,
        has_table_privilege('authenticated', 'public.restaurants', 'SELECT')
          as can_read_restaurants,
        has_table_privilege('authenticated', 'public.account_preferences', 'SELECT')
          as can_read_preferences,
        has_table_privilege('anon', 'public.organization_members', 'SELECT')
          as anon_can_read_memberships,
        has_table_privilege('service_role', 'public.orders', 'UPDATE')
          as service_can_update_orders,
        has_table_privilege('service_role', 'public.organization_subscriptions', 'UPDATE')
          as service_can_update_subscriptions
    `);
    assert.deepEqual(grants.rows[0], {
      can_read_organizations: true,
      can_read_memberships: true,
      can_read_restaurants: true,
      can_read_preferences: true,
      anon_can_read_memberships: false,
      service_can_update_orders: true,
      service_can_update_subscriptions: true,
    });

    const rpc = await database.query(`
      select to_regprocedure(
        'public.create_public_order_v3(text,text,integer,jsonb,jsonb,text,text,text)'
      ) as signature
    `);
    assert.equal(
      rpc.rows[0].signature,
      "create_public_order_v3(text,text,integer,jsonb,jsonb,text,text,text)",
    );

    const realtime = await database.query(`
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'orders'
    `);
    assert.equal(realtime.rows.length, 1);

    const buckets = await database.query(`
      select id, public from storage.buckets order by id
    `);
    assert.deepEqual(buckets.rows, [
      { id: "menu-images", public: true },
      { id: "restaurant-assets", public: true },
    ]);
  } finally {
    await database.close();
  }
});

test("anonymous feedback RPC accepts delivered orders but not pending orders", async () => {
  const database = await createSupabaseBaselineDatabase();
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const organizationId = "33333333-3333-4333-8333-333333333333";
  const restaurantId = "44444444-4444-4444-8444-444444444444";
  const deliveredOrderId = "55555555-5555-4555-8555-555555555555";
  const pendingOrderId = "66666666-6666-4666-8666-666666666666";
  const publicToken = "private-order-token";

  try {
    await database.query(`insert into auth.users(id) values ($1)`, [ownerId]);
    await database.query(`
      insert into public.organizations(id, name, created_by)
      values ($1, 'Tenant A', $2)
    `, [organizationId, ownerId]);
    await database.query(`
      insert into public.organization_members(organization_id, user_id, role)
      values ($1, $2, 'owner')
    `, [organizationId, ownerId]);
    await database.query(`
      insert into public.restaurants(id, organization_id, owner_id, name, slug)
      values ($1, $2, $3, 'Restaurant A', 'restaurant-a')
    `, [restaurantId, organizationId, ownerId]);
    await database.query(`
      insert into public.orders(id, restaurant_id, status, public_access_token_hash)
      values ($1, $3, 'delivered', encode(extensions.digest($4, 'sha256'), 'hex')),
             ($2, $3, 'pending', encode(extensions.digest($4, 'sha256'), 'hex'))
    `, [deliveredOrderId, pendingOrderId, restaurantId, publicToken]);

    await database.exec(`set role anon`);
    await assert.rejects(
      database.query(`
        insert into public.order_feedback(order_id, restaurant_id, rating)
        values ($1, $2, 4)
      `, [deliveredOrderId, restaurantId]),
      /permission denied/i,
    );
    await assert.rejects(database.query(`
      select public.submit_order_feedback($1::uuid, $2::uuid, 4, '{}'::text[], null, $3)
    `, [deliveredOrderId, restaurantId, "wrong-token"]), /invalid order access/i);
    await database.query(`
      select public.submit_order_feedback($1::uuid, $2::uuid, 4, '{}'::text[], null, $3)
    `, [deliveredOrderId, restaurantId, publicToken]);
    await assert.rejects(database.query(`
      select public.submit_order_feedback($1::uuid, $2::uuid, 5, '{}'::text[], null, $3)
    `, [deliveredOrderId, restaurantId, publicToken]), /feedback already submitted/i);
    await database.exec(`reset role`);
    const feedback = await database.query(`
      select rating from public.order_feedback where order_id = $1
    `, [deliveredOrderId]);
    assert.equal(feedback.rows[0].rating, 4);

    await assert.rejects(
      database.query(`
        select public.submit_order_feedback($1::uuid, $2::uuid, 2, '{}'::text[], null, $3)
      `, [pendingOrderId, restaurantId, publicToken]),
      /order is not delivered/i,
    );
  } finally {
    await database.close();
  }
});

test("restaurant staff can read subscriptions and update operations but cannot alter payment fields", async () => {
  const database = await createSupabaseBaselineDatabase();
  const staffId = "88888888-8888-4888-8888-888888888888";
  const organizationId = "99999999-9999-4999-8999-999999999999";
  const restaurantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const orderId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  try {
    await database.query(`insert into auth.users(id) values ($1)`, [staffId]);
    await database.query(`insert into public.organizations(id, name, created_by) values ($1, 'Tenant', $2)`, [organizationId, staffId]);
    await database.query(`insert into public.organization_members(organization_id, user_id, role) values ($1, $2, 'staff')`, [organizationId, staffId]);
    await database.query(`insert into public.organization_subscriptions(organization_id, plan_type, plan_status) values ($1, 'starter', 'trialing')`, [organizationId]);
    await database.query(`insert into public.restaurants(id, organization_id, owner_id, name, slug) values ($1, $2, $3, 'Tenant Restaurant', 'tenant-restaurant')`, [restaurantId, organizationId, staffId]);
    await database.query(`insert into public.orders(id, restaurant_id, status, payment_status) values ($1, $2, 'pending', 'PENDING')`, [orderId, restaurantId]);

    await database.exec(`set role authenticated; set request.jwt.claim.sub = '${staffId}';`);
    const subscription = await database.query(`select plan_type from public.organization_subscriptions where organization_id = $1`, [organizationId]);
    assert.equal(subscription.rows[0]?.plan_type, "starter");
    await database.query(`update public.orders set status = 'preparing', updated_at = now() where id = $1`, [orderId]);
    await assert.rejects(database.query(`update public.orders set payment_status = 'CONFIRMED' where id = $1`, [orderId]), /permission denied/i);
    await assert.rejects(database.query(`update public.orders set payment_confirmed_at = now() where id = $1`, [orderId]), /permission denied/i);
    const grants = await database.query(`select has_column_privilege('authenticated', 'public.orders', 'payment_status', 'UPDATE') as payment_update, has_column_privilege('authenticated', 'public.orders', 'status', 'UPDATE') as status_update`);
    assert.deepEqual(grants.rows[0], { payment_update: false, status_update: true });
  } finally {
    await database.close();
  }
});

test("account and restaurant RLS separates organization members", async () => {
  const database = await createSupabaseBaselineDatabase();
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const outsiderId = "22222222-2222-4222-8222-222222222222";
  const organizationId = "33333333-3333-4333-8333-333333333333";
  const restaurantId = "44444444-4444-4444-8444-444444444444";

  try {
    await database.query(`
      insert into auth.users(id) values ($1), ($2)
    `, [ownerId, outsiderId]);
    await database.query(`
      insert into public.organizations(id, name, created_by)
      values ($1, 'Tenant A', $2)
    `, [organizationId, ownerId]);
    await database.query(`
      insert into public.organization_members(organization_id, user_id, role)
      values ($1, $2, 'owner')
    `, [organizationId, ownerId]);
    await database.query(`
      insert into public.restaurants(id, organization_id, owner_id, name, slug)
      values ($1, $2, $3, 'Restaurant A', 'restaurant-a')
    `, [restaurantId, organizationId, ownerId]);

    await database.exec(`
      set role authenticated;
      set request.jwt.claim.sub = '${ownerId}';
    `);
    const ownerView = await database.query(`
      select
        (select count(*) from public.organizations) as organizations,
        (select count(*) from public.organization_members) as memberships,
        (select count(*) from public.restaurants) as restaurants
    `);
    assert.deepEqual(ownerView.rows[0], {
      organizations: 1,
      memberships: 1,
      restaurants: 1,
    });
    const storagePath =
      `organizations/${organizationId}/restaurants/${restaurantId}/branding/logo.png`;
    const ownerStorage = await database.query(`
      select public.can_manage_restaurant_storage_object(
        'restaurant-assets', $1::text
      ) as allowed
    `, [storagePath]);
    assert.equal(ownerStorage.rows[0].allowed, true);

    await database.exec(`set request.jwt.claim.sub = '${outsiderId}';`);
    const outsiderView = await database.query(`
      select
        (select count(*) from public.organizations) as organizations,
        (select count(*) from public.organization_members) as memberships,
        (select count(*) from public.restaurants) as restaurants
    `);
    assert.deepEqual(outsiderView.rows[0], {
      organizations: 0,
      memberships: 0,
      restaurants: 0,
    });
    const outsiderStorage = await database.query(`
      select public.can_manage_restaurant_storage_object(
        'restaurant-assets', $1::text
      ) as allowed
    `, [storagePath]);
    assert.equal(outsiderStorage.rows[0].allowed, false);
  } finally {
    await database.close();
  }
});

test("a new Auth user can bootstrap organization membership and onboarding", async () => {
  const database = await createSupabaseBaselineDatabase();
  const ownerId = "77777777-7777-4777-8777-777777777777";

  try {
    await database.query(`insert into auth.users(id) values ($1)`, [ownerId]);
    await database.exec(`
      set role authenticated;
      set request.jwt.claim.sub = '${ownerId}';
    `);
    const draft = await database.query(`
      select id, organization_id, onboarding_status
      from public.save_onboarding_draft(
        'Fresh Restaurant', 'fresh-restaurant', 0,
        null::uuid, null::uuid, null::text,
        '#5C8A72', '#111114', 1, true, false
      )
    `);
    assert.equal(draft.rows.length, 1);
    assert.equal(draft.rows[0].onboarding_status, "draft");

    const account = await database.query(`
      select member.role, member.status, restaurant.owner_id
      from public.organization_members member
      join public.restaurants restaurant
        on restaurant.organization_id = member.organization_id
      where restaurant.id = $1::uuid
    `, [draft.rows[0].id]);
    assert.deepEqual(account.rows, [{
      role: "owner",
      status: "active",
      owner_id: ownerId,
    }]);

    const finalized = await database.query(`
      select onboarding_status
      from public.finalize_onboarding($1::uuid)
    `, [draft.rows[0].id]);
    assert.equal(finalized.rows[0].onboarding_status, "complete");
  } finally {
    await database.close();
  }
});
