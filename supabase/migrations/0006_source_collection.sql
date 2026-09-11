-- Estado operacional e lease do coletor. A função fica restrita ao service
-- role para que usuários autenticados nunca possam disparar escrita global.
alter table public.sources
  add column if not exists source_key text unique,
  add column if not exists last_success_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists lease_until timestamptz;

insert into public.sources (
  source_key, name, type, base_url, active, schedule, health_status
)
values (
  'pncp',
  'Portal Nacional de Contratações Públicas',
  'pncp',
  'https://pncp.gov.br/api/consulta/v1',
  true,
  'hourly',
  'healthy'
)
on conflict (type, base_url) do update set
  source_key = excluded.source_key,
  name = excluded.name;

create or replace function public.claim_source_collection(
  target_source_key text,
  lease_minutes integer default 10
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if lease_minutes < 1 or lease_minutes > 60 then
    raise exception 'invalid_lease_minutes';
  end if;
  update public.sources
  set lease_until = now() + make_interval(mins => lease_minutes),
      last_checked_at = now()
  where source_key = target_source_key
    and active = true
    and (retry_after is null or retry_after <= now())
    and (lease_until is null or lease_until <= now());
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

revoke all on function public.claim_source_collection(text, integer) from public;
revoke all on function public.claim_source_collection(text, integer) from authenticated;
grant execute on function public.claim_source_collection(text, integer) to service_role;

-- Rollback/mitigação: revogar a função interrompe novas coletas imediatamente.
-- As colunas são expansivas e devem permanecer até uma migration posterior
-- confirmar que nenhum estado operacional precisa ser preservado.
