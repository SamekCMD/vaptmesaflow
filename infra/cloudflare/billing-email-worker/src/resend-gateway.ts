import { Resend } from 'resend';
import type { CreateEmailOptions, CreateEmailRequestOptions, CreateEmailResponse } from 'resend';
import { parseSnapshot } from './contracts.js';
import type { EmailSnapshot } from './contracts.js';

export type SendResult =
  | { kind: 'sent'; resendId: string }
  | { kind: 'retry' | 'permanent' | 'unknown'; code: string };

export type BillingEmailGateway = {
  sendBillingEmail(snapshot: EmailSnapshot, outboxId: string): Promise<SendResult>;
};

export type ResendSender = {
  emails: {
    send(payload: CreateEmailOptions, options?: CreateEmailRequestOptions): Promise<CreateEmailResponse>;
  };
};

export function buildResendGateway(sender: ResendSender): BillingEmailGateway {
  return {
    async sendBillingEmail(snapshot, outboxId) {
      let frozen: EmailSnapshot;
      try {
        frozen = parseSnapshot(snapshot);
      } catch {
        return { kind: 'permanent', code: 'invalid_snapshot' };
      }
      const payload: CreateEmailOptions = {
        from: 'no-reply <no-reply@vapt.app.br>',
        to: frozen.to,
        template: { id: frozen.templateAlias, variables: frozen.variables },
      };
      try {
        const response = await sender.emails.send(payload, { idempotencyKey: `billing/${outboxId}` });
        if (response.error) {
          const { name, statusCode } = response.error;
          if (name === 'concurrent_idempotent_requests') {
            return { kind: 'retry', code: 'idempotency_in_progress' };
          }
          if (name === 'invalid_idempotent_request') {
            return { kind: 'permanent', code: 'idempotency_payload_mismatch' };
          }
          if (name === 'rate_limit_exceeded' || statusCode === 429) {
            return { kind: 'retry', code: 'rate_limited' };
          }
          if (statusCode !== null && statusCode >= 500) {
            return { kind: 'retry', code: 'provider_unavailable' };
          }
          if (statusCode !== null && statusCode >= 400) {
            return { kind: 'permanent', code: 'resend_validation' };
          }
          return { kind: 'unknown', code: 'resend_uncertain' };
        }
        return response.data?.id
          ? { kind: 'sent', resendId: response.data.id }
          : { kind: 'unknown', code: 'resend_uncertain' };
      } catch {
        return { kind: 'unknown', code: 'resend_uncertain' };
      }
    },
  };
}

export function createResendGateway(apiKey: string): BillingEmailGateway {
  return buildResendGateway(new Resend(apiKey));
}
