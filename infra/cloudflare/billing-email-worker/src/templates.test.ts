import assert from 'node:assert/strict';
import test from 'node:test';
import { snapshotFor } from './templates.js';

const recipient = 'teste@example.com';
const restaurant = 'Restaurante Teste';
const url = 'https://vapt.app.br/dashboard/subscription';

for (const [kind, alias] of [
  ['subscription_activated', 'billing-subscription-activated'],
  ['subscription_renewed', 'billing-subscription-renewed'],
  ['payment_failed', 'billing-payment-failed'],
  ['subscription_cancelled', 'billing-subscription-cancelled'],
] as const) {
  test(`${kind} uses published billing template alias`, () => {
    assert.deepEqual(snapshotFor(kind, restaurant, 'pro', recipient), {
      to: recipient,
      templateAlias: alias,
      variables: {
        RESTAURANT_NAME: restaurant,
        PLAN_NAME: 'Pro',
        BILLING_URL: url,
      },
    });
  });
}

test('plan labels are the user-facing Starter, Pro and Business names', () => {
  for (const [plan, label] of [
    ['starter', 'Starter'],
    ['pro', 'Pro'],
    ['business', 'Business'],
  ] as const) {
    assert.equal(snapshotFor('subscription_renewed', restaurant, plan, recipient).variables.PLAN_NAME, label);
  }
});

test('snapshot rejects empty recipient and restaurant name', () => {
  assert.throws(() => snapshotFor('subscription_activated', ' ', 'pro', recipient));
  assert.throws(() => snapshotFor('subscription_activated', restaurant, 'pro', ' '));
});
