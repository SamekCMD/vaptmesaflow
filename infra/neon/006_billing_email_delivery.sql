-- Phase 8: additive immutable email request and delivery metadata.
begin;

alter table public.billing_email_outbox
  add column first_send_attempt_at timestamptz,
  add column recipient_email text,
  add column template_alias text,
  add column template_variables jsonb,
  add column resend_email_id text,
  add constraint billing_email_outbox_template_variables_check check (
    template_variables is null or jsonb_typeof(template_variables) = 'object'
  );

create index billing_email_outbox_processing_lease_idx
  on public.billing_email_outbox (processing_started_at)
  where delivery_status = 'processing';

commit;
