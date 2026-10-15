import assert from 'node:assert/strict';
import test from 'node:test';
import { buildResendGateway } from './resend-gateway.js';
import type { ResendSender } from './resend-gateway.js';
import { snapshotFor } from './templates.js';

const id = '8b4cddbe-4598-47a5-92aa-10f0a2ea998e';
const restaurant = 'Restaurante Teste';
const recipient = 'delivered@resend.dev';
const url = 'https://vapt.app.br/dashboard/subscription';

test('all four billing kinds send only the published template, variables and stable key', async () => {
  for (const [kind, alias] of [
    ['subscription_activated', 'billing-subscription-activated'],
    ['subscription_renewed', 'billing-subscription-renewed'],
    ['payment_failed', 'billing-payment-failed'],
    ['subscription_cancelled', 'billing-subscription-cancelled'],
  ] as const) {
    const calls: unknown[][] = [];
    const sender: ResendSender = { emails: { async send(...args) {
      calls.push(args);
      return { data: { id: 'resend-id' }, error: null, headers: null };
    } } };
    const gateway = buildResendGateway(sender);
    const snapshot = snapshotFor(kind, restaurant, 'pro', recipient);
    assert.deepEqual(await gateway.sendBillingEmail(snapshot, id), { kind: 'sent', resendId: 'resend-id' });
    assert.deepEqual(calls, [[{
      from: 'no-reply <no-reply@vapt.app.br>',
      to: recipient,
      template: { id: alias, variables: {
        RESTAURANT_NAME: restaurant, PLAN_NAME: 'Pro', BILLING_URL: url,
      } },
    }, { idempotencyKey: `billing/${id}` }]]);
  }
});

test('a crash retry repeats the byte-equivalent request and key', async () => {
  const calls: unknown[][] = [];
  const sender: ResendSender = { emails: { async send(...args) {
    calls.push(args);
    return { data: { id: 'same-resend-id' }, error: null, headers: null };
  } } };
  const gateway = buildResendGateway(sender);
  const snapshot = snapshotFor('subscription_renewed', restaurant, 'business', recipient);
  await gateway.sendBillingEmail(snapshot, id);
  await gateway.sendBillingEmail(snapshot, id);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], calls[0]);
});

for (const [name, statusCode, expected] of [
  ['concurrent_idempotent_requests', 409, { kind: 'retry', code: 'idempotency_in_progress' }],
  ['invalid_idempotent_request', 409, { kind: 'permanent', code: 'idempotency_payload_mismatch' }],
  ['rate_limit_exceeded', 429, { kind: 'retry', code: 'rate_limited' }],
  ['internal_server_error', 503, { kind: 'retry', code: 'provider_unavailable' }],
  ['validation_error', 422, { kind: 'permanent', code: 'resend_validation' }],
] as const) {
  test(`${name} is classified without leaking the provider message`, async () => {
    const sender: ResendSender = { emails: { async send() {
      return { data: null, error: { name, statusCode, message: 'private recipient details' }, headers: null };
    } } };
    assert.deepEqual(await buildResendGateway(sender).sendBillingEmail(
      snapshotFor('payment_failed', restaurant, 'pro', recipient), id), expected);
  });
}

test('network timeout is uncertain and malformed snapshot never reaches Resend', async () => {
  let calls = 0;
  const sender: ResendSender = { emails: { async send() { calls++; throw new Error('timeout with private data'); } } };
  const gateway = buildResendGateway(sender);
  assert.deepEqual(await gateway.sendBillingEmail(
    snapshotFor('payment_failed', restaurant, 'pro', recipient), id),
  { kind: 'unknown', code: 'resend_uncertain' });
  assert.deepEqual(await gateway.sendBillingEmail({
    to: recipient, templateAlias: 'account-confirmation',
    variables: { RESTAURANT_NAME: restaurant, PLAN_NAME: 'Pro', BILLING_URL: url },
  }, id), { kind: 'permanent', code: 'invalid_snapshot' });
  assert.equal(calls, 1);
});
