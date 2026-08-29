-- Auditoria somente leitura para decidir a retirada final do legado Asaas.
-- Execute no SQL Editor como postgres. Este arquivo nao altera dados.

with legacy_orders as (
  select distinct
    orders.id,
    orders.payment_status::text as payment_status,
    orders.status::text as order_status
  from public.orders
  join public.payment_provider_events events
    on events.order_id = orders.id
   and events.provider in ('asaas', 'asaas_gateway')
),
checks as (
  select
    1 as sort_order,
    'transacoes_asaas_v2_nao_finalizadas'::text as check_name,
    count(*)::bigint as affected_rows,
    true as blocks_removal,
    'Deve ser zero: cobrancas asaas_legacy ainda podem receber atualizacoes.'::text as criterion
  from public.payment_transactions
  where provider = 'asaas_legacy'
    and status in ('created', 'pending', 'processing')

  union all

  select
    2,
    'webhooks_asaas_v2_nao_processados',
    count(*)::bigint,
    true,
    'Deve ser zero: eventos recebidos, em processamento ou falhos precisam ser reconciliados.'
  from public.payment_webhook_events
  where provider = 'asaas_legacy'
    and status in ('received', 'processing', 'failed')

  union all

  select
    3,
    'eventos_gateway_asaas_pendentes',
    count(*)::bigint,
    true,
    'Deve ser zero: o encaminhamento legado ao n8n ainda nao terminou.'
  from public.payment_provider_events
  where provider = 'asaas_gateway'
    and coalesce(payload #>> '{gateway,status}', 'received') <> 'processed'

  union all

  select
    4,
    'pedidos_asaas_com_pagamento_nao_finalizado',
    count(*)::bigint,
    true,
    'Deve ser zero: pedidos historicos com pagamento pendente ainda dependem do webhook.'
  from legacy_orders
  where lower(coalesce(payment_status, '')) not in (
    'paid', 'confirmed', 'cancelled', 'canceled', 'refunded', 'failed'
  )

  union all

  select
    5,
    'efeitos_asaas_v2_pendentes',
    count(*)::bigint,
    true,
    'Deve ser zero: efeitos operacionais de transacoes legadas ainda precisam concluir.'
  from public.payment_effect_outbox effects
  join public.payment_transactions transactions
    on transactions.id = effects.payment_transaction_id
   and transactions.restaurant_id = effects.restaurant_id
  where transactions.provider = 'asaas_legacy'
    and effects.status in ('pending', 'processing', 'failed', 'dead_letter')

  union all

  select
    6,
    'eventos_asaas_recebidos_nos_ultimos_7_dias',
    count(*)::bigint,
    true,
    'Deve permanecer zero por toda a janela definida antes de desligar o receptor.'
  from public.payment_provider_events
  where provider in ('asaas', 'asaas_gateway')
    and created_at >= now() - interval '7 days'

  union all

  select
    7,
    'restaurantes_com_configuracao_asaas',
    count(*)::bigint,
    false,
    'Informativo: credenciais e tokens so devem ser limpos depois da retirada do webhook.'
  from public.restaurants
  where nullif(trim(asaas_api_key), '') is not null
     or nullif(trim(asaas_webhook_token), '') is not null
)
select
  check_name,
  affected_rows,
  blocks_removal,
  case
    when blocks_removal and affected_rows > 0 then 'BLOQUEADO'
    when blocks_removal then 'OK'
    else 'INFORMATIVO'
  end as result,
  criterion
from checks
order by sort_order;
