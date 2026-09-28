import { parseMessage } from './contracts.js';
import { snapshotFor } from './templates.js';
import type { BillingEmailGateway } from './resend-gateway.js';
import type { DeliveryLease, OutboxRepository } from './outbox-repository.js';

const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

function logOutcome(lease: DeliveryLease, outcome: string, code?: string): void {
  console.info('billing_email_outcome', {
    outboxId: lease.outboxId,
    kind: lease.emailKind,
    attempt: lease.attemptCount,
    outcome,
    ...(code ? { code } : {}),
  });
}

export async function consumeBillingMessage(
  message: unknown,
  repository: OutboxRepository,
  gateway: BillingEmailGateway,
  now: Date,
): Promise<'ack' | 'retry'> {
  let outboxId: string;
  try {
    outboxId = parseMessage(message).outboxId;
  } catch {
    return 'retry';
  }

  try {
    const lease = await repository.claimDelivery(outboxId, now);
    if (!lease) return 'ack';

    let requested = lease.snapshot;
    if (!requested) {
      try {
        if (!lease.restaurantName || !lease.planType || !lease.recipientEmail) {
          throw new Error('Missing delivery context');
        }
        requested = snapshotFor(lease.emailKind, lease.restaurantName, lease.planType, lease.recipientEmail);
      } catch {
        const parked = await repository.markDeadLetter(lease, 'invalid_delivery_context');
        if (parked) logOutcome(lease, 'dead_letter', 'invalid_delivery_context');
        return parked ? 'ack' : 'retry';
      }
    }

    const frozen = await repository.saveSnapshot(lease, requested, now);
    if (!frozen) return 'retry';
    const firstAttempt = lease.firstSendAttemptAt ?? now;
    if (now.getTime() - firstAttempt.getTime() >= IDEMPOTENCY_WINDOW_MS) {
      const parked = await repository.markDeadLetter(lease, 'uncertain_result_window_expired');
      if (parked) logOutcome(lease, 'dead_letter', 'uncertain_result_window_expired');
      return parked ? 'ack' : 'retry';
    }

    const result = await gateway.sendBillingEmail(frozen, outboxId);
    if (result.kind === 'sent') {
      const saved = await repository.markSent(lease, result.resendId, now);
      if (saved) logOutcome(lease, 'sent');
      return saved ? 'ack' : 'retry';
    }
    if (result.kind === 'permanent' || lease.attemptCount >= 8) {
      const code = lease.attemptCount >= 8 && result.kind !== 'permanent'
        ? 'send_attempt_limit' : result.code;
      const parked = await repository.markDeadLetter(lease, code);
      if (parked) logOutcome(lease, 'dead_letter', code);
      return parked ? 'ack' : 'retry';
    }
    const delaySeconds = Math.min(3600, 60 * 2 ** Math.max(0, lease.attemptCount - 1));
    const scheduled = await repository.scheduleRetry(lease, result.code,
      new Date(now.getTime() + delaySeconds * 1000));
    if (scheduled) logOutcome(lease, 'pending_retry', result.code);
    return scheduled ? 'ack' : 'retry';
  } catch {
    return 'retry';
  }
}
