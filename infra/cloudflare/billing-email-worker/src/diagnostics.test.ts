import assert from 'node:assert/strict';
import test from 'node:test';
import { createBillingDiagnostics } from './diagnostics.js';

test('billing diagnostics write only fixed component, code and count once per invocation', () => {
  const points: unknown[] = [];
  const emit = createBillingDiagnostics({ writeDataPoint(point) { points.push(point); } });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    emit('scheduled_failed');
    emit('queue_failed');
    emit('queue_retry_requested');
  }
  assert.deepEqual(points, [
    { indexes: ['billing:scheduled_failed'], blobs: ['billing', 'scheduled_failed'], doubles: [1] },
    { indexes: ['billing:queue_failed'], blobs: ['billing', 'queue_failed'], doubles: [1] },
    { indexes: ['billing:queue_retry_requested'], blobs: ['billing', 'queue_retry_requested'], doubles: [1] },
  ]);
});

test('billing diagnostics discard runtime values outside the enum without coercion', () => {
  const points: unknown[] = [];
  let serialized = 0;
  const sensitive = {
    toJSON() { serialized += 1; throw new Error('private serialization'); },
    toString() { serialized += 1; throw new Error('private coercion'); },
    [Symbol.toPrimitive]() { serialized += 1; throw new Error('private coercion'); },
  };
  const emit = createBillingDiagnostics({ writeDataPoint(point) { points.push(point); } }) as (code: unknown) => void;
  const invalid = [null, undefined, 1, true, Symbol('private'), 1n, '', 'constructor', '__proto__',
    'queue_failed:private@example.com', new String('queue_failed'), sensitive,
    new Error('private@example.com'), new Request('https://private.example/?token=secret')];
  for (const value of invalid) assert.doesNotThrow(() => emit(value));
  assert.equal(serialized, 0);
  assert.deepEqual(points, []);
  emit('queue_failed');
  assert.deepEqual(points, [
    { indexes: ['billing:queue_failed'], blobs: ['billing', 'queue_failed'], doubles: [1] },
  ]);
});

test('billing diagnostics tolerate missing and throwing bindings without logs or retrying writes', (t) => {
  const logs = ['log', 'info', 'warn', 'error', 'debug'] as const;
  const logSpies = logs.map((method) => t.mock.method(console, method, () => {}));
  const absent = createBillingDiagnostics();
  assert.doesNotThrow(() => absent('queue_failed'));
  let writes = 0;
  let serialized = 0;
  const transportError = new Error('private@example.com');
  Object.assign(transportError, { toJSON() { serialized += 1; throw new Error('do not serialize'); } });
  const emit = createBillingDiagnostics({ writeDataPoint() { writes += 1; throw transportError; } });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    assert.doesNotThrow(() => emit('queue_failed'));
  }
  assert.equal(writes, 1);
  assert.equal(serialized, 0);
  for (const spy of logSpies) assert.equal(spy.mock.callCount(), 0);
});

test('billing diagnostic invocations have independent deduplication', () => {
  const points: unknown[] = [];
  const binding = { writeDataPoint(point: unknown) { points.push(point); } };
  const first = createBillingDiagnostics(binding);
  const second = createBillingDiagnostics(binding);
  first('queue_failed');
  second('queue_failed');
  first('queue_failed');
  second('queue_failed');
  assert.equal(points.length, 2);
});
