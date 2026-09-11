-- Expande a ingestão de documentos sem alterar registros existentes. O
-- registro e o evento de uma nova versão são gravados na mesma transação.
alter table public.procurements
  add column if not exists documents_checked_at timestamptz;

alter table public.procurement_documents
  add column if not exists title text,
  add column if not exists published_at timestamptz,
  add column if not exists storage_path text,
  add column if not exists byte_size bigint
    check (byte_size is null or byte_size between 1 and 52428800),
  add column if not exists last_verified_at timestamptz,
  add column if not exists structured_data jsonb,
  add column if not exists extraction_error_code text,
  add column if not exists processing_attempts integer not null default 0
    check (processing_attempts >= 0);

create index if not exists procurements_document_scan_idx
  on public.procurements (source_id, documents_checked_at asc nulls first);

create or replace function public.register_procurement_document_version(
  target_procurement_id uuid,
  target_url text,
  target_document_type text,
  target_title text,
  target_content_hash text,
  target_storage_path text,
  target_byte_size bigint,
  target_published_at timestamptz,
  target_fetched_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_document public.procurement_documents%rowtype;
  current_document_id uuid;
  change_type text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if target_url is null or target_url = '' or
     target_content_hash !~ '^[0-9a-f]{64}$' or
     target_storage_path is null or target_storage_path = '' or
     target_byte_size < 1 or target_byte_size > 52428800 then
    raise exception 'invalid_document_version';
  end if;

  select * into previous_document
  from public.procurement_documents
  where procurement_id = target_procurement_id and url = target_url
  order by fetched_at desc
  limit 1
  for update;

  if previous_document.id is not null and
     previous_document.content_hash = target_content_hash then
    update public.procurement_documents
    set last_verified_at = target_fetched_at
    where id = previous_document.id;
    return jsonb_build_object(
      'documentId', previous_document.id,
      'changeType', 'unchanged'
    );
  end if;

  insert into public.procurement_documents (
    procurement_id, url, document_type, title, content_hash, storage_path,
    byte_size, published_at, fetched_at, last_verified_at,
    previous_version_id
  ) values (
    target_procurement_id, target_url, target_document_type, target_title,
    target_content_hash, target_storage_path, target_byte_size,
    target_published_at, target_fetched_at, target_fetched_at,
    previous_document.id
  )
  returning id into current_document_id;

  change_type := case
    when previous_document.id is null then 'document_added'
    else 'document_changed'
  end;

  insert into public.source_events (
    procurement_id, event_type, previous_hash, current_hash, dedupe_key
  ) values (
    target_procurement_id,
    change_type,
    previous_document.content_hash,
    target_content_hash,
    'document:' || target_procurement_id::text || ':' || target_content_hash
  )
  on conflict (dedupe_key) do nothing;

  return jsonb_build_object(
    'documentId', current_document_id,
    'changeType', change_type
  );
end;
$$;

revoke all on function public.register_procurement_document_version(
  uuid, text, text, text, text, text, bigint, timestamptz, timestamptz
) from public;
revoke all on function public.register_procurement_document_version(
  uuid, text, text, text, text, text, bigint, timestamptz, timestamptz
) from authenticated;
grant execute on function public.register_procurement_document_version(
  uuid, text, text, text, text, text, bigint, timestamptz, timestamptz
) to service_role;
