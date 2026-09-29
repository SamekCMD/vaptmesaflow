import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { neon } from '@neondatabase/serverless';
import { dispatchDue } from './dispatcher.js';
import type { OutboxMessage } from './contracts.js';
import { createOutboxRepository } from './outbox-repository.js';
import { snapshotFor } from './templates.js';

const databaseUrl = process.env.NEON_PREVIEW_POOLED_URL;

test('preview Postgres grants one lease, fences stale writes, and preserves the frozen snapshot',
  { skip: databaseUrl ? false : 'NEON_PREVIEW_POOLED_URL is not set' }, async (context) => {
    const sql = neon(databaseUrl!);
    const existing = await sql.query(`SELECT count(*)::int AS count FROM public.billing_email_outbox
      WHERE delivery_status IN ('pending', 'pending_retry', 'processing')`);
    if (existing[0]?.count !== 0) {
      context.skip('preview has other active outbox rows; do not dispatch them in a smoke test');
      return;
    }
    const repository = createOutboxRepository(databaseUrl!);
    const restaurantId = randomUUID();
    const outboxId = randomUUID();
    const eventId = `evt_billing_queue_smoke_${randomUUID()}`;
    // Keep this synthetic row ahead of the live Cron while exercising time with explicit dates.
    const now = new Date(Date.now() + 60 * 60_000);
    const original = snapshotFor('subscription_activated', 'Restaurante Sintético', 'pro', 'delivered@resend.dev');
    try {
      await sql.query(`INSERT INTO public.restaurants (id, owner_id, name, slug)
        VALUES ($1::uuid, $2::uuid, $3, $4)`,
      [restaurantId, randomUUID(), 'Restaurante Sintético', `billing-queue-smoke-${restaurantId}`]);
      await sql.query(`INSERT INTO public.billing_email_outbox
        (id, restaurant_id, provider_event_id, email_kind, billing_resource_id, payload, next_attempt_at)
        VALUES ($1::uuid, $2::uuid, $3, 'subscription_activated', $4, $5::jsonb, $6::timestamptz)`,
      [outboxId, restaurantId, eventId, `invoice_${outboxId}`, JSON.stringify({ planType: 'pro' }), now.toISOString()]);

      assert.deepEqual(await repository.reserveDispatch(now, 20), [{ outboxId, correlationId: outboxId }]);

      const claims = await Promise.all([
        repository.claimDelivery(outboxId, now), repository.claimDelivery(outboxId, now),
      ]);
      assert.equal(claims.filter(Boolean).length, 1);
      const first = claims.find(Boolean)!;
      assert.equal(first.attemptCount, 1);
      assert.deepEqual(await repository.saveSnapshot(first, original, now), original);
      assert.equal(await repository.scheduleRetry(first, 'smoke_retry', new Date(now.getTime() + 60_000)), true);

      const early = await repository.claimDelivery(outboxId, new Date(now.getTime() + 1000));
      assert.equal(early, null, 'a duplicate Queue message must not bypass the retry deadline');
      const waiting = await sql.query(`SELECT delivery_status, attempt_count FROM public.billing_email_outbox
        WHERE id = $1::uuid`, [outboxId]);
      assert.equal(waiting[0]?.delivery_status, 'pending_retry');
      assert.equal(waiting[0]?.attempt_count, 1);

      const retryTime = new Date(now.getTime() + 61_000);
      assert.deepEqual(await repository.reserveDispatch(retryTime, 20), [{ outboxId, correlationId: outboxId }]);
      const second = await repository.claimDelivery(outboxId, retryTime);
      assert.ok(second);
      assert.equal(second.attemptCount, 2);
      assert.deepEqual(second.snapshot, original);
      const changed = snapshotFor('subscription_activated', 'Nome Alterado', 'business', 'changed@example.com');
      assert.deepEqual(await repository.saveSnapshot(second, changed, retryTime), original);
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

test('preview Postgres republishes an unconsumed ID after the five-minute reservation expires',
  { skip: databaseUrl ? false : 'NEON_PREVIEW_POOLED_URL is not set' }, async (context) => {
    const sql = neon(databaseUrl!);
    const existing = await sql.query(`SELECT count(*)::int AS count FROM public.billing_email_outbox
      WHERE delivery_status IN ('pending', 'pending_retry', 'processing')`);
    if (existing[0]?.count !== 0) {
      context.skip('preview has other active outbox rows; do not dispatch them in a smoke test');
      return;
    }
    const repository = createOutboxRepository(databaseUrl!);
    const restaurantId = randomUUID();
    const outboxId = randomUUID();
    const now = new Date();
    const messages: OutboxMessage[] = [];
    const queue = { async send(message: OutboxMessage) { messages.push(message); } };
    try {
      await sql.query(`INSERT INTO public.restaurants (id, owner_id, name, slug)
        VALUES ($1::uuid, $2::uuid, $3, $4)`,
      [restaurantId, randomUUID(), 'Restaurante Sintético', `billing-dispatch-smoke-${restaurantId}`]);
      await sql.query(`INSERT INTO public.billing_email_outbox
        (id, restaurant_id, provider_event_id, email_kind, billing_resource_id, payload, next_attempt_at)
        VALUES ($1::uuid, $2::uuid, $3, 'subscription_activated', $4, $5::jsonb, $6::timestamptz)`,
      [outboxId, restaurantId, `evt_dispatch_smoke_${outboxId}`, `invoice_${outboxId}`,
        JSON.stringify({ planType: 'pro' }), now.toISOString()]);

      await Promise.all([dispatchDue(repository, queue, now), dispatchDue(repository, queue, now)]);
      assert.deepEqual(messages, [{ version: 1, outboxId, correlationId: outboxId }]);
      await dispatchDue(repository, queue, new Date(now.getTime() + 4 * 60_000));
      assert.equal(messages.length, 1);
      await dispatchDue(repository, queue, new Date(now.getTime() + 6 * 60_000));
      assert.deepEqual(messages, [
        { version: 1, outboxId, correlationId: outboxId },
        { version: 1, outboxId, correlationId: outboxId },
      ]);
      const rows = await sql.query(`SELECT delivery_status, attempt_count, sent_at
        FROM public.billing_email_outbox WHERE id = $1::uuid`, [outboxId]);
      assert.equal(rows[0]?.delivery_status, 'pending');
      assert.equal(rows[0]?.attempt_count, 0);
      assert.equal(rows[0]?.sent_at, null);
    } finally {
      await sql.query('DELETE FROM public.billing_email_outbox WHERE id = $1::uuid', [outboxId]);
      await sql.query('DELETE FROM public.restaurants WHERE id = $1::uuid', [restaurantId]);
    }
  });
