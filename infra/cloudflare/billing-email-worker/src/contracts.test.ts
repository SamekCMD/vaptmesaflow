import assert from 'node:assert/strict';
import test from 'node:test';
import { assertQueueSource, parseMessage, parseSnapshot } from './contracts.js';

const id = '8b4cddbe-4598-47a5-92aa-10f0a2ea998e';

test('accepts only the three-field ID-only Queue message', () => {
  assert.deepEqual(parseMessage({ version: 1, outboxId: id, correlationId: id }), {
    version: 1,
    outboxId: id,
    correlationId: id,
  });
  assert.throws(() => parseMessage({ version: 1, outboxId: id, correlationId: id, to: 'private@example.com' }));
});

test('rejects malformed Queue identities and versions', () => {
  for (const value of [
    null,
    { version: 2, outboxId: id, correlationId: id },
    { version: 1, outboxId: 'bad', correlationId: id },
    { version: 1, outboxId: id, correlationId: 'bad' },
    { version: 1, outboxId: id },
  ]) {
    assert.throws(() => parseMessage(value));
  }
});

test('rejects a batch from the wrong environment Queue', () => {
  assert.doesNotThrow(() => assertQueueSource('vapt-emails-preview', 'preview'));
  assert.doesNotThrow(() => assertQueueSource('vapt-emails-production', 'production'));
  assert.throws(() => assertQueueSource('vapt-emails-production', 'preview'));
  assert.throws(() => assertQueueSource('vapt-emails-preview', 'production'));
  assert.throws(() => assertQueueSource('unrecognized', 'preview'));
});

test('frozen snapshot rejects missing and extra variables', () => {
  const base = {
    to: 'teste@example.com',
    templateAlias: 'billing-subscription-activated',
    variables: {
      RESTAURANT_NAME: 'Restaurante Teste',
      PLAN_NAME: 'Pro',
      BILLING_URL: 'https://vapt.app.br/dashboard/subscription',
    },
  };
  assert.deepEqual(parseSnapshot(base), base);
  assert.throws(() => parseSnapshot({ ...base, variables: { RESTAURANT_NAME: 'Teste', PLAN_NAME: 'Pro' } }));
  assert.throws(() => parseSnapshot({ ...base, variables: { ...base.variables, SECRET: 'oops' } }));
  assert.throws(() => parseSnapshot({ ...base, stripePayload: { customer: 'private' } }));
  assert.throws(() => parseSnapshot({ ...base, variables: { ...base.variables, BILLING_URL: 'https://elsewhere.example' } }));
  assert.throws(() => parseSnapshot({ ...base, templateAlias: 'account-confirmation' }));
});
