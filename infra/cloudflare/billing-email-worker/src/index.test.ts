import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorker } from './index.js';
import type { WorkerEnvironment } from './index.js';
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

test('Queue handler rejects a batch from the other environment before database access', async () => {
  let opened = false;
  const worker = createWorker(() => { opened = true; throw new Error('wrong branch read'); });
  const batch = { queue: 'vapt-emails-production', messages: [] };
  await assert.rejects(() => worker.queue(batch, {
    ENVIRONMENT: 'preview', DATABASE_URL: 'preview-pooled-url', RESEND_API_KEY: 'test-key',
    BILLING_EMAIL_QUEUE: { async send() {} },
  }), /Unexpected billing Queue source/);
  assert.equal(opened, false);
});

test('Queue handler acknowledges terminal rows and retries malformed messages', async () => {
  const actions: string[] = [];
  const unused = async (): Promise<never> => { throw new Error('unexpected repository call'); };
  const repo: OutboxRepository = {
    reserveDispatch: unused, deferDispatch: unused, claimDelivery: async () => null,
    saveSnapshot: unused, markSent: unused, scheduleRetry: unused,
    markDeadLetter: unused, reapExpired: unused,
  };
  const worker = createWorker(() => repo, () => ({ async sendBillingEmail() {
    throw new Error('unexpected send');
  } }));
  await worker.queue({ queue: 'vapt-emails-preview', messages: [
    { body: { version: 1, outboxId: id, correlationId: id }, ack() { actions.push('ack'); },
      retry() { actions.push('retry-valid'); } },
    { body: { version: 1, outboxId: id, to: 'private@example.com' },
      ack() { actions.push('ack-invalid'); }, retry() { actions.push('retry-invalid'); } },
  ] }, {
    ENVIRONMENT: 'preview', DATABASE_URL: 'preview-pooled-url', RESEND_API_KEY: 'test-key',
    BILLING_EMAIL_QUEUE: { async send() {} },
  });
  assert.deepEqual(actions, ['ack', 'retry-invalid']);
});

function idleRepository(overrides: Partial<OutboxRepository> = {}): OutboxRepository {
  const unused = async (): Promise<never> => { throw new Error('unexpected repository call'); };
  return {
    reapExpired: async () => ({ retried: 0, deadLettered: 0 }), reserveDispatch: async () => [],
    deferDispatch: unused, claimDelivery: async () => null, saveSnapshot: unused,
    markSent: unused, scheduleRetry: unused, markDeadLetter: unused, ...overrides,
  };
}

function productionEnvironment() {
  return {
    ENVIRONMENT: 'production', DATABASE_URL: 'production-pooled-url', RESEND_API_KEY: 'test-key',
    BILLING_EMAIL_QUEUE: { async send() {} },
  };
}

test('scheduled failure emits a fixed diagnostic and preserves the private exception identity', async () => {
  const points: unknown[] = [];
  let serialized = 0;
  const failure = Object.assign(new Error('private@example.com?token=secret'), {
    toJSON() { serialized += 1; throw new Error('must not serialize'); },
    toString() { serialized += 1; throw new Error('must not coerce'); },
  });
  const worker = createWorker(() => idleRepository({ async reapExpired() { throw failure; } }));
  const env = { ...productionEnvironment(), DIAGNOSTICS: { writeDataPoint(point: unknown) { points.push(point); } } };
  await assert.rejects(worker.scheduled({ scheduledTime }, env), (error) => error === failure);
  assert.equal(serialized, 0);
  assert.deepEqual(points, [
    { indexes: ['billing:scheduled_failed'], blobs: ['billing', 'scheduled_failed'], doubles: [1] },
  ]);
});

test('scheduled configuration failure emits diagnostics before any database access', async () => {
  const points: unknown[] = [];
  let opened = false;
  const worker = createWorker(() => { opened = true; throw new Error('unexpected database access'); });
  const env = { ...productionEnvironment(), DATABASE_URL: '',
    DIAGNOSTICS: { writeDataPoint(point: unknown) { points.push(point); } } };
  await assert.rejects(worker.scheduled({ scheduledTime }, env), /Incomplete billing Worker configuration/);
  assert.equal(opened, false);
  assert.deepEqual(points, [
    { indexes: ['billing:scheduled_failed'], blobs: ['billing', 'scheduled_failed'], doubles: [1] },
  ]);
});

test('Queue source mismatch emits queue_failed without opening the database or acknowledging messages', async () => {
  const points: unknown[] = [];
  let opened = false;
  const actions: string[] = [];
  const worker = createWorker(() => { opened = true; throw new Error('wrong branch access'); });
  const env = { ...productionEnvironment(), DIAGNOSTICS: { writeDataPoint(point: unknown) { points.push(point); } } };
  await assert.rejects(worker.queue({ queue: 'vapt-emails-preview', messages: [
    { body: {}, ack() { actions.push('ack'); }, retry() { actions.push('retry'); } },
  ] }, env), /Unexpected billing Queue source/);
  assert.equal(opened, false);
  assert.deepEqual(actions, []);
  assert.deepEqual(points, [
    { indexes: ['billing:queue_failed'], blobs: ['billing', 'queue_failed'], doubles: [1] },
  ]);
});

test('Queue configuration failure emits queue_failed before opening the database', async () => {
  const points: unknown[] = [];
  let opened = false;
  const worker = createWorker(() => { opened = true; throw new Error('unexpected database access'); });
  const env = { ...productionEnvironment(), RESEND_API_KEY: '',
    DIAGNOSTICS: { writeDataPoint(point: unknown) { points.push(point); } } };
  await assert.rejects(worker.queue({ queue: 'vapt-emails-production', messages: [] }, env),
    /Incomplete billing Worker configuration/);
  assert.equal(opened, false);
  assert.deepEqual(points, [
    { indexes: ['billing:queue_failed'], blobs: ['billing', 'queue_failed'], doubles: [1] },
  ]);
});

test('Queue retries emit once per batch before retry while preserving ack and retry options', async () => {
  const points: unknown[] = [];
  const actions: unknown[] = [];
  const worker = createWorker(() => idleRepository(), () => ({ async sendBillingEmail() {
    throw new Error('unexpected delivery');
  } }));
  const env = { ...productionEnvironment(), DIAGNOSTICS: { writeDataPoint(point: unknown) {
    points.push(point); actions.push('diagnostic');
  } } };
  const batch = { queue: 'vapt-emails-production', messages: [
    { body: { version: 1, outboxId: id, correlationId: id }, ack() { actions.push('ack'); },
      retry() { actions.push('unexpected-retry'); } },
    ...[1, 2].map(() => ({ body: { email: 'private@example.com' },
      ack() { actions.push('unexpected-ack'); }, retry(options?: { delaySeconds: number }) { actions.push(options); } })),
  ] };
  await worker.queue(batch, env);
  await worker.queue(batch, env);
  assert.deepEqual(actions, [
    'ack', 'diagnostic', { delaySeconds: 60 }, { delaySeconds: 60 },
    'ack', 'diagnostic', { delaySeconds: 60 }, { delaySeconds: 60 },
  ]);
  assert.deepEqual(points, [
    { indexes: ['billing:queue_retry_requested'], blobs: ['billing', 'queue_retry_requested'], doubles: [1] },
    { indexes: ['billing:queue_retry_requested'], blobs: ['billing', 'queue_retry_requested'], doubles: [1] },
  ]);
});

test('Queue callback failure emits queue_failed and preserves the original thrown value', async () => {
  const points: unknown[] = [];
  const failure = { private: 'private@example.com', toJSON() { throw new Error('must not serialize'); } };
  const worker = createWorker(() => idleRepository(), () => ({ async sendBillingEmail() {
    throw new Error('unexpected delivery');
  } }));
  const env = { ...productionEnvironment(), DIAGNOSTICS: { writeDataPoint(point: unknown) { points.push(point); } } };
  await assert.rejects(worker.queue({ queue: 'vapt-emails-production', messages: [
    { body: {}, ack() { throw new Error('unexpected ack'); }, retry() { throw failure; } },
  ] }, env), (error) => error === failure);
  assert.deepEqual(points, [
    { indexes: ['billing:queue_retry_requested'], blobs: ['billing', 'queue_retry_requested'], doubles: [1] },
    { indexes: ['billing:queue_failed'], blobs: ['billing', 'queue_failed'], doubles: [1] },
  ]);
});

for (const bindingState of ['absent', 'throwing'] as const) {
  test(`${bindingState} diagnostics preserve scheduled and Queue exceptions, ack and retry`, async () => {
    let writes = 0;
    const env = { ...productionEnvironment(), ...(bindingState === 'throwing' ? {
      DIAGNOSTICS: { writeDataPoint() { writes += 1; throw new Error('private transport error'); } },
    } : {}) };
    const failure = new Error('private business error');
    const brokenWorker = createWorker(() => { throw failure; });
    await assert.rejects(brokenWorker.scheduled({ scheduledTime }, env), (error) => error === failure);
    await assert.rejects(brokenWorker.queue({ queue: 'vapt-emails-production', messages: [] }, env),
      (error) => error === failure);
    const actions: unknown[] = [];
    const worker = createWorker(() => idleRepository(), () => ({ async sendBillingEmail() {
      throw new Error('unexpected delivery');
    } }));
    await worker.queue({ queue: 'vapt-emails-production', messages: [
      { body: { version: 1, outboxId: id, correlationId: id }, ack() { actions.push('ack'); },
        retry() { actions.push('unexpected-retry'); } },
      { body: {}, ack() { actions.push('unexpected-ack'); },
        retry(options) { actions.push(options); } },
      { body: {}, ack() { actions.push('unexpected-ack'); },
        retry(options) { actions.push(options); } },
    ] }, env);
    assert.deepEqual(actions, ['ack', { delaySeconds: 60 }, { delaySeconds: 60 }]);
    assert.equal(writes, bindingState === 'throwing' ? 3 : 0);
  });
}

test('preview and invalid environments never write to an accidentally supplied production diagnostic binding', async () => {
  let writes = 0;
  let opened = 0;
  const failure = new Error('private failure');
  const worker = createWorker(() => { opened += 1; throw failure; });
  for (const environment of ['preview', 'unknown']) {
    const env = { ...productionEnvironment(), ENVIRONMENT: environment,
      DIAGNOSTICS: { writeDataPoint() { writes += 1; } } };
    await assert.rejects(worker.scheduled({ scheduledTime }, env));
    await assert.rejects(worker.queue({ queue: 'vapt-emails-preview', messages: [] }, env));
  }
  assert.equal(opened, 2);
  assert.equal(writes, 0);
});

test('preview retry outcomes never write to an accidentally supplied production diagnostic binding', async () => {
  let writes = 0;
  const actions: unknown[] = [];
  const worker = createWorker(() => idleRepository(), () => ({ async sendBillingEmail() {
    throw new Error('unexpected delivery');
  } }));
  const env = { ...productionEnvironment(), ENVIRONMENT: 'preview',
    DIAGNOSTICS: { writeDataPoint() { writes += 1; } } };
  await worker.queue({ queue: 'vapt-emails-preview', messages: [
    { body: {}, ack() { actions.push('unexpected-ack'); }, retry(options) { actions.push(options); } },
  ] }, env);
  assert.equal(writes, 0);
  assert.deepEqual(actions, [{ delaySeconds: 60 }]);
});

test('successful production handlers do not emit diagnostic points', async () => {
  const points: unknown[] = [];
  const worker = createWorker(() => idleRepository(), () => ({ async sendBillingEmail() {
    throw new Error('unexpected delivery');
  } }));
  const env: WorkerEnvironment & { DIAGNOSTICS: { writeDataPoint(point: unknown): void } } = {
    ...productionEnvironment(), DIAGNOSTICS: { writeDataPoint(point) { points.push(point); } },
  };
  await worker.scheduled({ scheduledTime }, env);
  const actions: string[] = [];
  await worker.queue({ queue: 'vapt-emails-production', messages: [
    { body: { version: 1, outboxId: id, correlationId: id }, ack() { actions.push('ack'); },
      retry() { actions.push('unexpected-retry'); } },
  ] }, env);
  assert.deepEqual(actions, ['ack']);
  assert.deepEqual(points, []);
});
