import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { neon } from '@neondatabase/serverless';
import { createOutboxRepository } from './outbox-repository.js';
import { snapshotFor } from './templates.js';

const databaseUrl = process.env.NEON_PREVIEW_POOLED_URL;

test('preview Postgres grants one lease, fences stale writes, and preserves the frozen snapshot',
  { skip: databaseUrl ? false : 'NEON_PREVIEW_POOLED_URL is not set' }, async () => {
    const sql = neon(databaseUrl!);
    const repository = createOutboxRepository(databaseUrl!);
    const restaurantId = randomUUID();
    const outboxId = randomUUID();
    const eventId = `evt_billing_queue_smoke_${randomUUID()}`;
    const now = new Date();
    const original = snapshotFor('subscription_activated', 'Restaurante Sintético', 'pro', 'delivered@resend.dev');
    try {
      await sql.query(`INSERT INTO public.restaurants (id, owner_id, name, slug)
        VALUES ($1::uuid, $2::uuid, $3, $4)`,
      [restaurantId, randomUUID(), 'Restaurante Sintético', `billing-queue-smoke-${restaurantId}`]);
      await sql.query(`INSERT INTO public.billing_email_outbox
        (id, restaurant_id, provider_event_id, email_kind, billing_resource_id, payload)
        VALUES ($1::uuid, $2::uuid, $3, 'subscription_activated', $4, $5::jsonb)`,
      [outboxId, restaurantId, eventId, `invoice_${outboxId}`, JSON.stringify({ planType: 'pro' })]);

      const claims = await Promise.all([
        repository.claimDelivery(outboxId, now), repository.claimDelivery(outboxId, now),
      ]);
      assert.equal(claims.filter(Boolean).length, 1);
      const first = claims.find(Boolean)!;
      assert.equal(first.attemptCount, 1);
      assert.deepEqual(await repository.saveSnapshot(first, original, now), original);
      assert.equal(await repository.scheduleRetry(first, 'smoke_retry', new Date(now.getTime() + 60_000)), true);

      const second = await repository.claimDelivery(outboxId, new Date(now.getTime() + 1000));
      assert.ok(second);
      assert.equal(second.attemptCount, 2);
      assert.deepEqual(second.snapshot, original);
      const changed = snapshotFor('subscription_activated', 'Nome Alterado', 'business', 'changed@example.com');
      assert.deepEqual(await repository.saveSnapshot(second, changed, new Date(now.getTime() + 1000)), original);
      assert.equal(await repository.markSent(first, 'stale-message', now), false);
      assert.equal(await repository.markSent(second, 'resend-smoke-id', now), true);

      const rows = await sql.query(`SELECT delivery_status, recipient_email, template_alias,
        template_variables, resend_email_id, attempt_count
        FROM public.billing_email_outbox WHERE id = $1::uuid`, [outboxId]);
      assert.equal(rows[0]?.delivery_status, 'sent');
      assert.equal(rows[0]?.recipient_email, original.to);
      assert.equal(rows[0]?.template_alias, original.templateAlias);
      assert.deepEqual(rows[0]?.template_variables, original.variables);
      assert.equal(rows[0]?.resend_email_id, 'resend-smoke-id');
      assert.equal(rows[0]?.attempt_count, 2);
    } finally {
      await sql.query('DELETE FROM public.billing_email_outbox WHERE id = $1::uuid', [outboxId]);
      await sql.query('DELETE FROM public.restaurants WHERE id = $1::uuid', [restaurantId]);
    }
  });
