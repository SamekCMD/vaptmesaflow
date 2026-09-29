import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOutboxRepository } from './outbox-repository.js';
import type { DeliveryLease, QueryRunner } from './outbox-repository.js';
import { snapshotFor } from './templates.js';

const id = '8b4cddbe-4598-47a5-92aa-10f0a2ea998e';
const now = new Date('2026-09-28T12:00:00.000Z');
const snapshot = snapshotFor('subscription_activated', 'Restaurante Teste', 'pro', 'test@example.com');
const lease: DeliveryLease = {
  outboxId: id, attemptCount: 1, emailKind: 'subscription_activated', planType: 'pro',
  restaurantName: 'Restaurante Teste', recipientEmail: 'test@example.com',
  snapshot: null, firstSendAttemptAt: null,
};

function recorded(rows: Record<string, unknown>[] = []) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query: QueryRunner = async (sql, params) => {
    calls.push({ sql, params });
    return rows;
  };
  return { repository: buildOutboxRepository(query), calls };
}

test('reserves only a bounded due batch atomically for five minutes', async () => {
  const { repository, calls } = recorded([{ id }]);
  assert.deepEqual(await repository.reserveDispatch(now, 20), [{ outboxId: id, correlationId: id }]);
  assert.match(calls[0]!.sql, /FOR UPDATE SKIP LOCKED/i);
  assert.match(calls[0]!.sql, /UPDATE public\.billing_email_outbox/i);
  assert.match(calls[0]!.sql, /interval '5 minutes'/i);
  assert.match(calls[0]!.sql, /SET delivery_status\s*=\s*'pending'/i);
  assert.match(calls[0]!.sql, /RETURNING/i);
  assert.deepEqual(calls[0]!.params, [now.toISOString(), 20]);
  await assert.rejects(() => repository.reserveDispatch(now, 21));
});

test('defers a failed publish without changing delivery state', async () => {
  const nextAt = new Date(now.getTime() + 60_000);
  const { repository, calls } = recorded([{ id }]);
  assert.equal(await repository.deferDispatch(id, nextAt), true);
  assert.match(calls[0]!.sql, /next_attempt_at/i);
  assert.doesNotMatch(calls[0]!.sql, /delivery_status\s*=/i);
  assert.deepEqual(calls[0]!.params, [id, nextAt.toISOString()]);
});

test('claims one delivery lease and joins owner email and restaurant name', async () => {
  const { repository, calls } = recorded([{
    id, attempt_count: 1, email_kind: 'subscription_activated', plan_type: 'pro',
    restaurant_name: 'Restaurante Teste', recipient_email: null, owner_email: 'test@example.com',
    template_alias: null, template_variables: null, first_send_attempt_at: null,
  }]);
  assert.deepEqual(await repository.claimDelivery(id, now), lease);
  assert.match(calls[0]!.sql, /better_auth\."user"/i);
  assert.match(calls[0]!.sql, /processing_started_at/i);
  assert.match(calls[0]!.sql, /attempt_count\s*=\s*attempt_count\s*\+\s*1/i);
  assert.match(calls[0]!.sql, /delivery_status\s*=\s*'pending'/i);
  assert.match(calls[0]!.sql, /next_attempt_at\s*>\s*\$2::timestamptz/i);
  assert.equal(await recorded().repository.claimDelivery(id, now), null);
});

test('saves a snapshot only once under the lease and returns the frozen request', async () => {
  const { repository, calls } = recorded([{
    recipient_email: snapshot.to, template_alias: snapshot.templateAlias,
    template_variables: snapshot.variables,
  }]);
  assert.deepEqual(await repository.saveSnapshot(lease, snapshot, now), snapshot);
  assert.match(calls[0]!.sql, /coalesce\(recipient_email,/i);
  assert.match(calls[0]!.sql, /coalesce\(template_alias,/i);
  assert.match(calls[0]!.sql, /coalesce\(template_variables,/i);
  assert.match(calls[0]!.sql, /first_send_attempt_at/i);
  assert.match(calls[0]!.sql, /attempt_count\s*=\s*\$2/i);
  assert.equal(await recorded().repository.saveSnapshot(lease, snapshot, now), null);
});

test('sent, retry and dead-letter transitions fence stale attempts', async () => {
  const { repository, calls } = recorded([{ id }]);
  assert.equal(await repository.markSent(lease, 'resend-test-id', now), true);
  assert.equal(await repository.scheduleRetry(lease, 'rate_limited', new Date(now.getTime() + 60_000)), true);
  assert.equal(await repository.markDeadLetter(lease, 'invalid_template'), true);
  for (const call of calls) {
    assert.match(call.sql, /attempt_count\s*=\s*\$2/i);
    assert.match(call.sql, /delivery_status\s*=\s*'processing'/i);
  }
  assert.match(calls[0]!.sql, /resend_email_id/i);
  assert.match(calls[1]!.sql, /'pending_retry'/i);
  assert.match(calls[2]!.sql, /'dead_letter'/i);
  assert.equal(await recorded().repository.markSent(lease, 'resend-test-id', now), false);
});

test('expired leases return to retry inside 24 hours and park uncertain sends outside it', async () => {
  const { repository, calls } = recorded([
    { delivery_status: 'pending_retry' }, { delivery_status: 'dead_letter' },
  ]);
  assert.deepEqual(await repository.reapExpired(now), { retried: 1, deadLettered: 1 });
  assert.match(calls[0]!.sql, /interval '15 minutes'/i);
  assert.match(calls[0]!.sql, /interval '24 hours'/i);
  assert.match(calls[0]!.sql, /first_send_attempt_at/i);
  assert.match(calls[0]!.sql, /attempt_count\s*>=\s*8/i);
});
