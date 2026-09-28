import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorker } from './index.js';
import type { OutboxMessage } from './contracts.js';
import type { OutboxRepository } from './outbox-repository.js';

const id = '8b4cddbe-4598-47a5-92aa-10f0a2ea998e';
const scheduledTime = Date.parse('2026-09-28T12:00:00.000Z');

test('scheduled handler uses the branch-scoped URL and publishes only the ID-only message', async () => {
  const urls: string[] = [];
  const messages: OutboxMessage[] = [];
  const unexpected = async (): Promise<never> => { throw new Error('unexpected repository call'); };
  const repository: OutboxRepository = {
    async reapExpired() { return { retried: 0, deadLettered: 0 }; },
    async reserveDispatch() { return [{ outboxId: id, correlationId: id }]; },
    deferDispatch: unexpected,
    claimDelivery: unexpected,
    saveSnapshot: unexpected,
    markSent: unexpected,
    scheduleRetry: unexpected,
    markDeadLetter: unexpected,
  };
  const worker = createWorker((url) => { urls.push(url); return repository; });
  await worker.scheduled({ scheduledTime }, {
    ENVIRONMENT: 'preview', DATABASE_URL: 'preview-pooled-url',
    BILLING_EMAIL_QUEUE: { async send(message: OutboxMessage) { messages.push(message); } },
  });
  assert.deepEqual(urls, ['preview-pooled-url']);
  assert.deepEqual(messages, [{ version: 1, outboxId: id, correlationId: id }]);
});

test('scheduled handler rejects an unknown environment before opening a database', async () => {
  let opened = false;
  const worker = createWorker(() => { opened = true; throw new Error('unexpected database access'); });
  await assert.rejects(() => worker.scheduled({ scheduledTime }, {
    ENVIRONMENT: 'unknown', DATABASE_URL: 'unused',
    BILLING_EMAIL_QUEUE: { async send() { throw new Error('unexpected publish'); } },
  }));
  assert.equal(opened, false);
});
