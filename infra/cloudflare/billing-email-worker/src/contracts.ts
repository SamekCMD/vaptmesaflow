export type BillingEmailKind =
  | 'subscription_activated'
  | 'subscription_renewed'
  | 'payment_failed'
  | 'subscription_cancelled';

export type BillingPlanType = 'starter' | 'pro' | 'business';
export type EnvironmentName = 'preview' | 'production';

export type OutboxMessage = {
  version: 1;
  outboxId: string;
  correlationId: string;
};

export type EmailSnapshot = {
  to: string;
  templateAlias: string;
  variables: {
    RESTAURANT_NAME: string;
    PLAN_NAME: string;
    BILLING_URL: string;
  };
};

export const BILLING_URL = 'https://vapt.app.br/dashboard/subscription';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALIASES = new Set([
  'billing-subscription-activated',
  'billing-subscription-renewed',
  'billing-payment-failed',
  'billing-subscription-cancelled',
]);

function recordWithKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

export function parseMessage(value: unknown): OutboxMessage {
  if (!recordWithKeys(value, ['version', 'outboxId', 'correlationId'])
    || value.version !== 1
    || typeof value.outboxId !== 'string'
    || !UUID.test(value.outboxId)
    || typeof value.correlationId !== 'string'
    || !UUID.test(value.correlationId)) {
    throw new Error('Invalid billing Queue message');
  }
  return { version: 1, outboxId: value.outboxId, correlationId: value.correlationId };
}

export function assertQueueSource(queueName: string, expectedEnvironment: EnvironmentName): void {
  if (queueName !== `vapt-emails-${expectedEnvironment}`) {
    throw new Error('Unexpected billing Queue source');
  }
}

export function parseSnapshot(value: unknown): EmailSnapshot {
  if (!recordWithKeys(value, ['to', 'templateAlias', 'variables'])
    || typeof value.to !== 'string'
    || !EMAIL.test(value.to)
    || typeof value.templateAlias !== 'string'
    || !ALIASES.has(value.templateAlias)
    || !recordWithKeys(value.variables, ['RESTAURANT_NAME', 'PLAN_NAME', 'BILLING_URL'])
    || typeof value.variables.RESTAURANT_NAME !== 'string'
    || !value.variables.RESTAURANT_NAME.trim()
    || !['Starter', 'Pro', 'Business'].includes(String(value.variables.PLAN_NAME))
    || value.variables.BILLING_URL !== BILLING_URL) {
    throw new Error('Invalid billing email snapshot');
  }
  return {
    to: value.to,
    templateAlias: value.templateAlias,
    variables: {
      RESTAURANT_NAME: value.variables.RESTAURANT_NAME,
      PLAN_NAME: value.variables.PLAN_NAME as string,
      BILLING_URL,
    },
  };
}
