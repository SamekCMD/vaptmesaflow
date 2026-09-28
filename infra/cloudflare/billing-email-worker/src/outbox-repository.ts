import { neon } from '@neondatabase/serverless';
import { parseSnapshot } from './contracts.js';
import type { BillingEmailKind, BillingPlanType, EmailSnapshot } from './contracts.js';

export type DispatchCandidate = { outboxId: string; correlationId: string };
export type DeliveryLease = {
  outboxId: string;
  attemptCount: number;
  emailKind: BillingEmailKind;
  planType: BillingPlanType | null;
  restaurantName: string | null;
  recipientEmail: string | null;
  snapshot: EmailSnapshot | null;
  firstSendAttemptAt: Date | null;
};
export type ReapSummary = { retried: number; deadLettered: number };
export type QueryRunner = (sql: string, params: unknown[]) => Promise<Record<string, unknown>[]>;

export type OutboxRepository = {
  reserveDispatch(now: Date, limit: number): Promise<DispatchCandidate[]>;
  deferDispatch(outboxId: string, nextAt: Date): Promise<boolean>;
  claimDelivery(outboxId: string, now: Date): Promise<DeliveryLease | null>;
  saveSnapshot(lease: DeliveryLease, snapshot: EmailSnapshot, now: Date): Promise<EmailSnapshot | null>;
  markSent(lease: DeliveryLease, resendId: string, now: Date): Promise<boolean>;
  scheduleRetry(lease: DeliveryLease, code: string, nextAt: Date): Promise<boolean>;
  markDeadLetter(lease: DeliveryLease, code: string): Promise<boolean>;
  reapExpired(now: Date): Promise<ReapSummary>;
};

const kinds = new Set<string>([
  'subscription_activated', 'subscription_renewed', 'payment_failed', 'subscription_cancelled',
]);
const plans = new Set<string>(['starter', 'pro', 'business']);

function safeCode(code: string): string {
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(code)) throw new Error('Unsafe billing error code');
  return code;
}

function asDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error('Invalid outbox timestamp');
  return date;
}

function asLease(row: Record<string, unknown>): DeliveryLease {
  if (typeof row.id !== 'string'
    || !Number.isInteger(row.attempt_count)
    || typeof row.email_kind !== 'string'
    || !kinds.has(row.email_kind)) {
    throw new Error('Invalid outbox delivery lease');
  }
  const planType = typeof row.plan_type === 'string' && plans.has(row.plan_type)
    ? row.plan_type as BillingPlanType : null;
  const recipient = typeof row.recipient_email === 'string' ? row.recipient_email
    : typeof row.owner_email === 'string' ? row.owner_email : null;
  const restaurantName = typeof row.restaurant_name === 'string' ? row.restaurant_name : null;
  const frozenFields = [row.recipient_email, row.template_alias, row.template_variables];
  const existing = frozenFields.every((value) => value !== null && value !== undefined);
  const empty = frozenFields.every((value) => value === null || value === undefined);
  if (!existing && !empty) throw new Error('Partial billing email snapshot');
  const snapshot = existing ? parseSnapshot({
    to: row.recipient_email,
    templateAlias: row.template_alias,
    variables: row.template_variables,
  }) : null;
  return {
    outboxId: row.id,
    attemptCount: row.attempt_count as number,
    emailKind: row.email_kind as BillingEmailKind,
    planType,
    restaurantName,
    recipientEmail: recipient,
    snapshot,
    firstSendAttemptAt: asDate(row.first_send_attempt_at),
  };
}

export function buildOutboxRepository(query: QueryRunner): OutboxRepository {
  return {
    async reserveDispatch(now, limit) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error('Invalid dispatch limit');
      const rows = await query(`
        WITH due AS (
          SELECT id FROM public.billing_email_outbox
          WHERE delivery_status IN ('pending', 'pending_retry')
            AND next_attempt_at <= $1::timestamptz
            AND attempt_count < 8
          ORDER BY next_attempt_at, created_at
          FOR UPDATE SKIP LOCKED
          LIMIT $2
        )
        UPDATE public.billing_email_outbox AS outbox
        SET next_attempt_at = $1::timestamptz + interval '5 minutes'
        FROM due WHERE outbox.id = due.id
        RETURNING outbox.id
      `, [now.toISOString(), limit]);
      return rows.map((row) => {
        if (typeof row.id !== 'string') throw new Error('Invalid dispatch candidate');
        return { outboxId: row.id, correlationId: row.id };
      });
    },
    async deferDispatch(outboxId, nextAt) {
      const rows = await query(`
        UPDATE public.billing_email_outbox
        SET next_attempt_at = $2::timestamptz
        WHERE id = $1::uuid
          AND delivery_status IN ('pending', 'pending_retry')
          AND next_attempt_at > $2::timestamptz
        RETURNING id
      `, [outboxId, nextAt.toISOString()]);
      return rows.length > 0;
    },
    async claimDelivery(outboxId, now) {
      const rows = await query(`
        WITH claimed AS (
          UPDATE public.billing_email_outbox
          SET delivery_status = 'processing',
              processing_started_at = $2::timestamptz,
              attempt_count = attempt_count + 1
          WHERE id = $1::uuid
            AND delivery_status IN ('pending', 'pending_retry')
            AND attempt_count < 8
          RETURNING *
        )
        SELECT claimed.id, claimed.attempt_count, claimed.email_kind,
               claimed.payload->>'planType' AS plan_type,
               restaurant.name AS restaurant_name,
               claimed.recipient_email, auth.email AS owner_email,
               claimed.template_alias, claimed.template_variables,
               claimed.first_send_attempt_at
        FROM claimed
        JOIN public.restaurants AS restaurant ON restaurant.id = claimed.restaurant_id
        LEFT JOIN better_auth."user" AS auth ON auth.id = restaurant.owner_id
      `, [outboxId, now.toISOString()]);
      return rows.length ? asLease(rows[0]!) : null;
    },
    async saveSnapshot(lease, snapshot, now) {
      const validated = parseSnapshot(snapshot);
      const rows = await query(`
        UPDATE public.billing_email_outbox
        SET recipient_email = coalesce(recipient_email, $3::text),
            template_alias = coalesce(template_alias, $4::text),
            template_variables = coalesce(template_variables, $5::jsonb),
            first_send_attempt_at = coalesce(first_send_attempt_at, $6::timestamptz)
        WHERE id = $1::uuid AND attempt_count = $2
          AND delivery_status = 'processing'
          AND ((recipient_email IS NULL AND template_alias IS NULL AND template_variables IS NULL)
            OR (recipient_email IS NOT NULL AND template_alias IS NOT NULL AND template_variables IS NOT NULL))
        RETURNING recipient_email, template_alias, template_variables
      `, [lease.outboxId, lease.attemptCount, validated.to, validated.templateAlias,
        JSON.stringify(validated.variables), now.toISOString()]);
      if (!rows.length) return null;
      return parseSnapshot({
        to: rows[0]!.recipient_email,
        templateAlias: rows[0]!.template_alias,
        variables: rows[0]!.template_variables,
      });
    },
    async markSent(lease, resendId, now) {
      if (!resendId.trim()) throw new Error('Missing Resend message ID');
      const rows = await query(`
        UPDATE public.billing_email_outbox
        SET delivery_status = 'sent', sent_at = $4::timestamptz,
            resend_email_id = $3::text, processing_started_at = NULL, last_error = NULL
        WHERE id = $1::uuid AND attempt_count = $2 AND delivery_status = 'processing'
        RETURNING id
      `, [lease.outboxId, lease.attemptCount, resendId, now.toISOString()]);
      return rows.length > 0;
    },
    async scheduleRetry(lease, code, nextAt) {
      const rows = await query(`
        UPDATE public.billing_email_outbox
        SET delivery_status = CASE WHEN attempt_count >= 8 THEN 'dead_letter' ELSE 'pending_retry' END,
            next_attempt_at = $4::timestamptz, processing_started_at = NULL,
            last_error = CASE WHEN attempt_count >= 8 THEN 'send_attempt_limit' ELSE $3::text END
        WHERE id = $1::uuid AND attempt_count = $2 AND delivery_status = 'processing'
        RETURNING id
      `, [lease.outboxId, lease.attemptCount, safeCode(code), nextAt.toISOString()]);
      return rows.length > 0;
    },
    async markDeadLetter(lease, code) {
      const rows = await query(`
        UPDATE public.billing_email_outbox
        SET delivery_status = 'dead_letter', processing_started_at = NULL, last_error = $3::text
        WHERE id = $1::uuid AND attempt_count = $2 AND delivery_status = 'processing'
        RETURNING id
      `, [lease.outboxId, lease.attemptCount, safeCode(code)]);
      return rows.length > 0;
    },
    async reapExpired(now) {
      const rows = await query(`
        UPDATE public.billing_email_outbox
        SET delivery_status = CASE
              WHEN attempt_count >= 8 OR (first_send_attempt_at IS NOT NULL
                AND first_send_attempt_at <= $1::timestamptz - interval '24 hours')
                THEN 'dead_letter' ELSE 'pending_retry' END,
            next_attempt_at = $1::timestamptz,
            processing_started_at = NULL,
            last_error = CASE
              WHEN attempt_count >= 8 THEN 'send_attempt_limit'
              WHEN first_send_attempt_at IS NOT NULL
                AND first_send_attempt_at <= $1::timestamptz - interval '24 hours'
                THEN 'uncertain_result_window_expired'
              ELSE 'delivery_lease_expired' END
        WHERE delivery_status = 'processing'
          AND processing_started_at <= $1::timestamptz - interval '15 minutes'
        RETURNING delivery_status
      `, [now.toISOString()]);
      return {
        retried: rows.filter((row) => row.delivery_status === 'pending_retry').length,
        deadLettered: rows.filter((row) => row.delivery_status === 'dead_letter').length,
      };
    },
  };
}

export function createOutboxRepository(databaseUrl: string): OutboxRepository {
  const sql = neon(databaseUrl);
  return buildOutboxRepository((statement, params) => sql.query(statement, params));
}
