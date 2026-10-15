import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchDue } from './dispatcher.js';
import type { OutboxMessage } from './contracts.js';
import type { OutboxRepository } from './outbox-repository.js';

const now = new Date('2026-09-28T12:00:00.000Z');
const ids = Array.from({ length: 20 }, (_, index) => `8b4cddbe-4598-47a5-92aa-${index.toString().padStart(12, '0')}`);

function fakeRepository(candidates = ids.map((id) => ({ outboxId: id, correlationId: id }))) {
  const calls: string[] = [];
  const deferred: { id: string; nextAt: Date }[] = [];
  let reserved = false;
  const repository = {
    async reapExpired() { calls.push('reap'); return { retried: 1, deadLettered: 2 }; },
    async reserveDispatch(_now: Date, limit: number) {
      calls.push(`reserve:${limit}`);
      if (reserved) return [];
      reserved = true;
      return candidates.slice(0, limit);
    },
    async deferDispatch(id: string, nextAt: Date) {
      calls.push('defer'); deferred.push({ id, nextAt }); return true;
    },
  } as unknown as OutboxRepository;
  return { repository, calls, deferred };
}

test('reaps stale leases then publishes at most 20 ID-only messages', async () => {
  const { repository, calls } = fakeRepository();
  const messages: OutboxMessage[] = [];
  const summary = await dispatchDue(repository, { async send(message) { messages.push(message); } }, now);
  assert.deepEqual(calls.slice(0, 2), ['reap', 'reserve:20']);
  assert.equal(messages.length, 20);
  assert.deepEqual(messages[0], { version: 1, outboxId: ids[0], correlationId: ids[0] });
  assert.ok(messages.every((message) => Object.keys(message).sort().join(',') === 'correlationId,outboxId,version'));
  assert.deepEqual(summary, { retried: 1, deadLettered: 2, reserved: 20, published: 20, deferred: 0 });
});

test('Queue outage defers failed publication by 60 seconds', async () => {
  const { repository, deferred } = fakeRepository([{ outboxId: ids[0]!, correlationId: ids[0]! }]);
  const summary = await dispatchDue(repository, { async send() { throw new Error('Queue offline'); } }, now);
  assert.deepEqual(summary, { retried: 1, deadLettered: 2, reserved: 1, published: 0, deferred: 1 });
  assert.deepEqual(deferred, [{ id: ids[0], nextAt: new Date(now.getTime() + 60_000) }]);
});

test('overlapping Cron invocations publish a database-reserved row only once', async () => {
  const { repository } = fakeRepository([{ outboxId: ids[0]!, correlationId: ids[0]! }]);
  const messages: OutboxMessage[] = [];
  const queue = { async send(message: OutboxMessage) { messages.push(message); } };
  await Promise.all([dispatchDue(repository, queue, now), dispatchDue(repository, queue, now)]);
  assert.equal(messages.length, 1);
});

test('failed deferral rejects Cron so the reservation can recover later', async () => {
  const { repository } = fakeRepository([{ outboxId: ids[0]!, correlationId: ids[0]! }]);
  repository.deferDispatch = async () => false;
  await assert.rejects(() => dispatchDue(repository, { async send() { throw new Error('offline'); } }, now),
    /Failed to defer billing dispatch/);
});
