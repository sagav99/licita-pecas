-- Snapshot estruturado dos itens oficiais do PNCP. Itens removidos ficam
-- inativos para auditoria; a substituição lógica e o evento são transacionais.
alter table public.procurements
  add column if not exists items_checked_at timestamptz,
  add column if not exists items_hash text;

alter table public.procurement_items
  add column if not exists active boolean not null default true;

create index if not exists procurements_item_scan_idx
  on public.procurements (source_id, items_checked_at asc nulls first);

create or replace function public.replace_procurement_items(
  target_procurement_id uuid,
  target_items jsonb,
  target_items_hash text,
  target_checked_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_hash text;
  target_lot_id uuid;
  target_object text;
  item_count integer;
  change_type text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if jsonb_typeof(target_items) <> 'array' or
     target_items_hash is null or
     target_items_hash !~ '^[0-9a-f]{64}$' or
     target_checked_at is null then
    raise exception 'invalid_procurement_items';
  end if;

  select items_hash, object into previous_hash, target_object
  from public.procurements
  where id = target_procurement_id
  for update;
  if target_object is null then
    raise exception 'procurement_not_found';
  end if;

  if previous_hash = target_items_hash then
    update public.procurements
    set items_checked_at = target_checked_at
    where id = target_procurement_id;
    return jsonb_build_object(
      'changeType', 'unchanged',
      'itemCount', jsonb_array_length(target_items)
    );
  end if;

  insert into public.lots (procurement_id, external_id, description)
  values (target_procurement_id, 'pncp-items', target_object)
  on conflict (procurement_id, external_id) do update
    set description = excluded.description
  returning id into target_lot_id;

  update public.procurement_items
  set active = false
  where lot_id = target_lot_id;

  insert into public.procurement_items (
    lot_id, external_id, description, codes, quantity, unit,
    technical_requirements, active
  )
  select
    target_lot_id,
    item->>'externalId',
    item->>'description',
    coalesce(item->'codes', '[]'::jsonb),
    case when item->>'quantity' is null then null
      else (item->>'quantity')::numeric end,
    item->>'unit',
    coalesce(item->'technicalRequirements', '{}'::jsonb),
    true
  from jsonb_array_elements(target_items) item
  where item->>'externalId' is not null and item->>'description' is not null
  on conflict (lot_id, external_id) do update set
    description = excluded.description,
    codes = excluded.codes,
    quantity = excluded.quantity,
    unit = excluded.unit,
    technical_requirements = excluded.technical_requirements,
    active = true;

  get diagnostics item_count = row_count;
  change_type := case
    when previous_hash is null then 'items_added'
    else 'items_changed'
  end;

  update public.procurements
  set items_hash = target_items_hash,
      items_checked_at = target_checked_at
  where id = target_procurement_id;

  insert into public.source_events (
    procurement_id, event_type, previous_hash, current_hash, dedupe_key
  ) values (
    target_procurement_id, change_type, previous_hash, target_items_hash,
    'items:' || target_procurement_id::text || ':' || target_items_hash
  )
  on conflict (dedupe_key) do nothing;

  return jsonb_build_object(
    'changeType', change_type,
    'itemCount', item_count
  );
end;
$$;

revoke all on function public.replace_procurement_items(
  uuid, jsonb, text, timestamptz
) from public;
revoke all on function public.replace_procurement_items(
  uuid, jsonb, text, timestamptz
) from authenticated;
grant execute on function public.replace_procurement_items(
  uuid, jsonb, text, timestamptz
) to service_role;
