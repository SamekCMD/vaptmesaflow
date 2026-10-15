import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Independent expansion of our daily minute-step schedule, not a production parser.
// Catches continuous idle polling, missing timers and unintended hour/day restrictions.
function dailyDispatchMinutes(crons: string[]): number[] {
  const minutes: number[] = [];
  for (const cron of crons) {
    const [minute, ...otherFields] = cron.split(' ');
    assert.deepEqual(otherFields, ['*', '*', '*', '*'], 'dispatcher must run every day');
    const step = minute === '*' ? 1 : Number(/^\*\/(\d+)$/.exec(minute)?.[1]);
    assert.ok(Number.isInteger(step) && step > 0 && step <= 60, 'supported minute step');
    for (let hour = 0; hour < 24; hour += 1) {
      for (let value = 0; value < 60; value += step) minutes.push(hour * 60 + value);
    }
  }
  return minutes.sort((a, b) => a - b);
}

for (const environment of ['preview', 'production']) {
  test(`${environment} dispatches twice an hour with idle time for Neon suspension`, () => {
    const config = JSON.parse(readFileSync(new URL(`../wrangler.${environment}.jsonc`, import.meta.url), 'utf8'));
    const times = dailyDispatchMinutes(config.triggers.crons);
    assert.equal(times.length, 48, '48 dispatch opportunities per UTC day');
    assert.equal(times[0], 0);
    assert.equal(times.at(-1), 1410);
    const gaps = times.map((minute, index) => (times[index + 1] ?? 1440) - minute);
    assert.ok(gaps.every((gap) => gap === 30), 'no extra poll or gap above approved latency');
    assert.equal(config.name, `vapt-billing-email-${environment}`);
    assert.deepEqual(config.vars, { ENVIRONMENT: environment });
    assert.equal(config.workers_dev, false);
    assert.equal(config.preview_urls, false);
    assert.deepEqual(config.queues, {
      producers: [{ binding: 'BILLING_EMAIL_QUEUE', queue: `vapt-emails-${environment}` }],
      consumers: [{ queue: `vapt-emails-${environment}`, max_batch_size: 10, max_retries: 3,
        retry_delay: 60, dead_letter_queue: `vapt-emails-${environment}-dlq` }],
    });
  });
}
