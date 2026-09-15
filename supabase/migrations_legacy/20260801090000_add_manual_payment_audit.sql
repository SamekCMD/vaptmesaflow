-- A confirmacao manual sempre registra o operador autenticado.
alter table public.payment_transactions
  add column if not exists manually_confirmed_by uuid;

alter table public.payment_transactions
  drop constraint if exists payment_transactions_manual_confirmer_check;

alter table public.payment_transactions
  add constraint payment_transactions_manual_confirmer_check
  check (
    (provider = 'manual' and manually_confirmed_by is not null)
    or (provider <> 'manual' and manually_confirmed_by is null)
  );

-- Uma troca de chave idempotente nao pode confirmar novamente o mesmo pedido.
create unique index if not exists payment_transactions_one_active_manual_per_order_idx
  on public.payment_transactions (order_id)
  where provider = 'manual'
    and status in ('created', 'pending', 'processing', 'paid');

comment on column public.payment_transactions.manually_confirmed_by is
  'JWT sub do operador que confirmou um recebimento manual.';

notify pgrst, 'reload schema';
