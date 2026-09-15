begin;

-- A autorizacao desta RPC interna e garantida pelo privilegio EXECUTE.
-- O PostgREST self-hosted pode fornecer apenas request.jwt.claims, enquanto
-- a versao instalada da funcao ainda consulta o GUC legado por papel.
revoke all on function public.create_public_order_v2(text, text, integer, jsonb, jsonb, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_public_order_v2(text, text, integer, jsonb, jsonb, text, text, text)
  to service_role;

alter function public.create_public_order_v2(text, text, integer, jsonb, jsonb, text, text, text)
  set "request.jwt.claim.role" = 'service_role';

commit;
