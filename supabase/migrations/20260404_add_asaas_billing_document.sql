alter table public.restaurants
  add column if not exists asaas_billing_document text;

update public.restaurants
set asaas_billing_document = nullif(cnpj, '')
where asaas_billing_document is null
  and nullif(cnpj, '') is not null;
