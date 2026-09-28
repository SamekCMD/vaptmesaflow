import type { OutboxMessage } from './contracts.js';
import type { OutboxRepository, ReapSummary } from './outbox-repository.js';

export type QueueSender = { send(message: OutboxMessage): Promise<void> };
export type DispatchSummary = ReapSummary & { reserved: number; published: number; deferred: number };

export async function dispatchDue(
  repository: OutboxRepository,
  queue: QueueSender,
  now: Date,
): Promise<DispatchSummary> {
  const recovered = await repository.reapExpired(now);
  const candidates = await repository.reserveDispatch(now, 20);
  const summary: DispatchSummary = {
    ...recovered,
    reserved: candidates.length,
    published: 0,
    deferred: 0,
  };
  for (const candidate of candidates) {
    const message: OutboxMessage = {
      version: 1,
      outboxId: candidate.outboxId,
      correlationId: candidate.correlationId,
    };
    try {
      await queue.send(message);
      summary.published += 1;
    } catch {
      const deferred = await repository.deferDispatch(candidate.outboxId, new Date(now.getTime() + 60_000));
      if (!deferred) throw new Error('Failed to defer billing dispatch');
      summary.deferred += 1;
    }
  }
  return summary;
}
