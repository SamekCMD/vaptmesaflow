import assert from 'node:assert/strict';
import test from 'node:test';
import { consumeBillingMessage } from './consumer.js';
import type { OutboxMessage } from './contracts.js';
import type { DeliveryLease, OutboxRepository } from './outbox-repository.js';
import type { BillingEmailGateway, SendResult } from './resend-gateway.js';
import { snapshotFor } from './templates.js';

const id = '8b4cddbe-4598-47a5-92aa-10f0a2ea998e';
const now = new Date('2026-09-28T12:00:00.000Z');
const message: OutboxMessage = { version: 1, outboxId: id, correlationId: id };
const frozen = snapshotFor('subscription_activated', 'Nome Original', 'pro', 'original@example.com');

function lease(overrides: Partial<DeliveryLease> = {}): DeliveryLease {
  return {
    outboxId: id, attemptCount: 1, emailKind: 'subscription_activated', planType: 'pro',
    restaurantName: 'Nome Original', recipientEmail: 'original@example.com',
    snapshot: null, firstSendAttemptAt: null, ...overrides,
  };
}

function repository(overrides: Partial<OutboxRepository> = {}): OutboxRepository {
  const unused = async (): Promise<never> => { throw new Error('unexpected repository call'); };
  return {
    reserveDispatch: unused, deferDispatch: unused, claimDelivery: unused,
    saveSnapshot: unused, markSent: unused, scheduleRetry: unused,
    markDeadLetter: unused, reapExpired: unused, ...overrides,
  };
}

function gateway(result: SendResult): BillingEmailGateway {
  return { async sendBillingEmail() { return result; } };
}

test('malformed Queue body retries without reading any database branch', async () => {
  const result = await consumeBillingMessage({ ...message, to: 'private@example.com' },
    repository(), gateway({ kind: 'sent', resendId: 'unused' }), now);
  assert.equal(result, 'retry');
});

test('already-sent or in-flight row is acknowledged without another send', async () => {
  const repo = repository({ async claimDelivery() { return null; } });
  const noSend: BillingEmailGateway = { async sendBillingEmail() { throw new Error('duplicate send'); } };
  assert.equal(await consumeBillingMessage(message, repo, noSend, now), 'ack');
});

test('retry uses frozen recipient and variables after owner and restaurant change', async () => {
  const stored = lease({ snapshot: frozen, restaurantName: 'Nome Novo', recipientEmail: 'new@example.com',
    firstSendAttemptAt: new Date(now.getTime() - 60_000), attemptCount: 2 });
  let request: unknown;
  let sent = false;
  const repo = repository({
    async claimDelivery() { return stored; },
    async saveSnapshot(_lease, snapshot) { assert.deepEqual(snapshot, frozen); return frozen; },
    async markSent() { sent = true; return true; },
  });
  const email: BillingEmailGateway = { async sendBillingEmail(snapshot, outboxId) {
    request = { snapshot, outboxId };
    return { kind: 'sent', resendId: 'same-resend-id' };
  } };
  assert.equal(await consumeBillingMessage(message, repo, email, now), 'ack');
  assert.deepEqual(request, { snapshot: frozen, outboxId: id });
  assert.equal(sent, true);
});

test('first delivery freezes the event plan, owner email and restaurant name before send', async () => {
  let saved: unknown;
  const repo = repository({
    async claimDelivery() { return lease(); },
    async saveSnapshot(_lease, snapshot) { saved = snapshot; return snapshot; },
    async markSent() { return true; },
  });
  const email: BillingEmailGateway = { async sendBillingEmail(snapshot) {
    assert.deepEqual(snapshot, frozen);
    return { kind: 'sent', resendId: 'sent-id' };
  } };
  assert.equal(await consumeBillingMessage(message, repo, email, now), 'ack');
  assert.deepEqual(saved, frozen);
});

test('uncertain result at the 24-hour boundary parks without another Resend request', async () => {
  let code: string | undefined;
  const repo = repository({
    async claimDelivery() { return lease({ snapshot: frozen,
      firstSendAttemptAt: new Date(now.getTime() - 24 * 3600_000), attemptCount: 2 }); },
    async saveSnapshot() { return frozen; },
    async markDeadLetter(_lease, value) { code = value; return true; },
  });
  const noSend: BillingEmailGateway = { async sendBillingEmail() { throw new Error('unsafe duplicate'); } };
  assert.equal(await consumeBillingMessage(message, repo, noSend, now), 'ack');
  assert.equal(code, 'uncertain_result_window_expired');
});

for (const [result, attempt, seconds] of [
  [{ kind: 'retry', code: 'rate_limited' }, 1, 60],
  [{ kind: 'retry', code: 'provider_unavailable' }, 3, 240],
  [{ kind: 'unknown', code: 'resend_uncertain' }, 2, 120],
  [{ kind: 'retry', code: 'provider_unavailable' }, 7, 3600],
] as const) {
  test(`${result.code} at attempt ${attempt} schedules bounded backoff`, async () => {
    let nextAt: Date | undefined;
    let savedCode: string | undefined;
    const repo = repository({
      async claimDelivery() { return lease({ snapshot: frozen, attemptCount: attempt }); },
      async saveSnapshot() { return frozen; },
      async scheduleRetry(_lease, code, next) { savedCode = code; nextAt = next; return true; },
    });
    assert.equal(await consumeBillingMessage(message, repo, gateway(result), now), 'ack');
    assert.equal(savedCode, result.code);
    assert.deepEqual(nextAt, new Date(now.getTime() + seconds * 1000));
  });
}

test('eighth failed send and permanent provider errors are dead-lettered', async () => {
  for (const [result, attempt, expectedCode] of [
    [{ kind: 'retry', code: 'provider_unavailable' }, 8, 'send_attempt_limit'],
    [{ kind: 'permanent', code: 'idempotency_payload_mismatch' }, 1, 'idempotency_payload_mismatch'],
  ] as const) {
    let code: string | undefined;
    const repo = repository({
      async claimDelivery() { return lease({ snapshot: frozen, attemptCount: attempt }); },
      async saveSnapshot() { return frozen; },
      async markDeadLetter(_lease, value) { code = value; return true; },
    });
    assert.equal(await consumeBillingMessage(message, repo, gateway(result), now), 'ack');
    assert.equal(code, expectedCode);
  }
});

test('failure to persist sent status asks Queue to retry', async () => {
  const repo = repository({
    async claimDelivery() { return lease({ snapshot: frozen }); },
    async saveSnapshot() { return frozen; },
    async markSent() { return false; },
  });
  assert.equal(await consumeBillingMessage(message, repo, gateway({ kind: 'sent', resendId: 'accepted' }), now), 'retry');
});

test('missing owner email is parked without calling Resend', async () => {
  let parkedCode: string | undefined;
  const repo = repository({
    async claimDelivery() { return lease({ recipientEmail: null }); },
    async markDeadLetter(_lease, code) { parkedCode = code; return true; },
  });
  const noSend: BillingEmailGateway = { async sendBillingEmail() { throw new Error('unexpected send'); } };
  assert.equal(await consumeBillingMessage(message, repo, noSend, now), 'ack');
  assert.equal(parkedCode, 'invalid_delivery_context');
});

test('snapshot, retry and dead-letter persistence failures ask Queue to retry', async () => {
  const noSend: BillingEmailGateway = { async sendBillingEmail() { throw new Error('unexpected send'); } };
  assert.equal(await consumeBillingMessage(message, repository({
    async claimDelivery() { return lease(); },
    async saveSnapshot() { return null; },
  }), noSend, now), 'retry');

  assert.equal(await consumeBillingMessage(message, repository({
    async claimDelivery() { return lease({ snapshot: frozen }); },
    async saveSnapshot() { return frozen; },
    async scheduleRetry() { return false; },
  }), gateway({ kind: 'retry', code: 'rate_limited' }), now), 'retry');

  assert.equal(await consumeBillingMessage(message, repository({
    async claimDelivery() { return lease({ snapshot: frozen }); },
    async saveSnapshot() { return frozen; },
    async markDeadLetter() { return false; },
  }), gateway({ kind: 'permanent', code: 'resend_validation' }), now), 'retry');
});
