import { dispatchDue } from './dispatcher.js';
import type { QueueSender } from './dispatcher.js';
import { createOutboxRepository } from './outbox-repository.js';
import type { OutboxRepository } from './outbox-repository.js';

export type RepositoryFactory = (url: string) => OutboxRepository;
export type WorkerEnvironment = {
  ENVIRONMENT: string;
  DATABASE_URL: string;
  BILLING_EMAIL_QUEUE: QueueSender;
};
export type ScheduledEvent = { scheduledTime: number };

export function createWorker(repositoryFor: RepositoryFactory) {
  return {
    async scheduled(event: ScheduledEvent, env: WorkerEnvironment): Promise<void> {
      if (env.ENVIRONMENT !== 'preview' && env.ENVIRONMENT !== 'production') {
        throw new Error('Invalid billing Worker environment');
      }
      if (!env.DATABASE_URL || !env.BILLING_EMAIL_QUEUE || !Number.isFinite(event.scheduledTime)) {
        throw new Error('Incomplete billing Worker configuration');
      }
      const repository = repositoryFor(env.DATABASE_URL);
      const summary = await dispatchDue(repository, env.BILLING_EMAIL_QUEUE, new Date(event.scheduledTime));
      console.info('billing_dispatch_complete', { environment: env.ENVIRONMENT, ...summary });
    },
    queue(): never {
      throw new Error('Billing email consumer is not configured');
    },
  };
}

export default createWorker(createOutboxRepository);
