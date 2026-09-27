-- Phase 7: additive Stripe billing state, retryable event claims and email intents.
-- Apply the exact reviewed file to preview first; production remains schema-only.
begin;

alter table public.restaurants
  add column stripe_subscription_item_id text,
  add column stripe_current_period_end timestamptz,
  add column stripe_cancel_at_period_end boolean not null default false,
  add column stripe_state_updated_at timestamptz,
  add column stripe_checkout_session_id text,
  add column stripe_checkout_plan_type text,
  add column stripe_checkout_expires_at timestamptz,
  add constraint restaurants_plan_status_check check (
    plan_status in (
      'trialing', 'active', 'past_due', 'incomplete', 'unpaid', 'paused',
      'expired', 'cancelled'
    )
  ),
  add constraint restaurants_stripe_checkout_check check (
    (stripe_checkout_session_id is null and stripe_checkout_plan_type is null
      and stripe_checkout_expires_at is null)
    or
    (stripe_checkout_session_id is not null and stripe_checkout_plan_type is not null
      and stripe_checkout_expires_at is not null
      and stripe_checkout_plan_type in ('starter', 'pro', 'business'))
  );

create unique index restaurants_stripe_customer_uidx
  on public.restaurants (stripe_customer_id) where stripe_customer_id is not null;
create unique index restaurants_stripe_subscription_uidx
  on public.restaurants (stripe_subscription_id) where stripe_subscription_id is not null;

alter table public.billing_provider_events
  alter column processed_at drop not null,
  alter column processed_at drop default,
  add column processing_status text not null default 'received',
  add column attempt_count integer not null default 0,
  add column processing_started_at timestamptz,
  add column last_error text,
  add constraint billing_provider_events_processing_status_check check (
    processing_status in ('received', 'processing', 'processed', 'pending_retry', 'ignored')
  ),
  add constraint billing_provider_events_attempt_count_check check (attempt_count >= 0);

-- Old gateway rows used a default processed_at even before successful processing.
-- Preserve their complete payloads, while honoring the explicit legacy status.
update public.billing_provider_events
   set provider = case when provider = 'stripe_gateway' then 'stripe' else provider end,
       processing_status = case payload #>> '{gateway,status}'
         when 'received' then 'received'
         when 'pending_retry' then 'pending_retry'
         else 'processed'
       end,
       processed_at = case payload #>> '{gateway,status}'
         when 'received' then null
         when 'pending_retry' then null
         else processed_at
       end;

create index billing_provider_events_retry_idx
  on public.billing_provider_events (processing_status, processing_started_at)
  where processing_status in ('received', 'processing', 'pending_retry');

create table public.billing_email_outbox (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  provider_event_id text not null,
  email_kind text not null,
  payload jsonb not null default '{}'::jsonb,
  delivery_status text not null default 'pending',
  attempt_count integer not null default 0,
  processing_started_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_email_outbox_restaurant_fkey foreign key (restaurant_id)
    references public.restaurants(id) on delete cascade,
  constraint billing_email_outbox_event_kind_key unique (provider_event_id, email_kind),
  constraint billing_email_outbox_kind_check check (
    email_kind in (
      'subscription_activated', 'subscription_renewed', 'payment_failed',
      'subscription_cancelled'
    )
  ),
  constraint billing_email_outbox_delivery_status_check check (
    delivery_status in ('pending', 'processing', 'sent', 'pending_retry', 'dead_letter')
  ),
  constraint billing_email_outbox_attempt_count_check check (attempt_count >= 0),
  constraint billing_email_outbox_payload_check check (jsonb_typeof(payload) = 'object')
);

create index billing_email_outbox_delivery_idx
  on public.billing_email_outbox (next_attempt_at, created_at)
  where delivery_status in ('pending', 'pending_retry');

create trigger billing_email_outbox_updated_at
  before update on public.billing_email_outbox
  for each row execute function public.update_updated_at_column();

revoke all on table public.billing_email_outbox from public;

commit;
