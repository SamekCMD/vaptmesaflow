import { assertQueueSource } from './contracts.js';
import type { EnvironmentName } from './contracts.js';
import { consumeBillingMessage } from './consumer.js';
import { dispatchDue } from './dispatcher.js';
import type { QueueSender } from './dispatcher.js';
import { createOutboxRepository } from './outbox-repository.js';
import type { OutboxRepository } from './outbox-repository.js';
import { createResendGateway } from './resend-gateway.js';
import type { BillingEmailGateway } from './resend-gateway.js';

export type RepositoryFactory = (url: string) => OutboxRepository;
export type WorkerEnvironment = {
  ENVIRONMENT: string;
  DATABASE_URL: string;
  BILLING_EMAIL_QUEUE: QueueSender;
  RESEND_API_KEY?: string;
};
export type ScheduledEvent = { scheduledTime: number };
export type BillingQueueMessage = {
  body: unknown;
  ack(): void;
  retry(options?: { delaySeconds: number }): void;
};
export type BillingQueueBatch = { queue: string; messages: BillingQueueMessage[] };

export function createWorker(repositoryFor: RepositoryFactory,
  gatewayFor: (apiKey: string) => BillingEmailGateway = createResendGateway) {
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
    async queue(batch: BillingQueueBatch, env: WorkerEnvironment): Promise<void> {
      if (env.ENVIRONMENT !== 'preview' && env.ENVIRONMENT !== 'production') {
        throw new Error('Invalid billing Worker environment');
      }
      assertQueueSource(batch.queue, env.ENVIRONMENT as EnvironmentName);
      if (!env.DATABASE_URL || !env.RESEND_API_KEY) {
        throw new Error('Incomplete billing Worker configuration');
      }
      const repository = repositoryFor(env.DATABASE_URL);
      const gateway = gatewayFor(env.RESEND_API_KEY);
      for (const message of batch.messages) {
        const outcome = await consumeBillingMessage(message.body, repository, gateway, new Date());
        if (outcome === 'ack') message.ack();
        else message.retry({ delaySeconds: 60 });
      }
    },
  };
}

export default createWorker(createOutboxRepository);
