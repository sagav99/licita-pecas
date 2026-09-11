-- Buckets privados. Caminhos seguem:
-- catalog-imports/<organization_id>/<arquivo>
-- procurement-documents/<procurement_id>/<arquivo>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'catalog-imports',
    'catalog-imports',
    false,
    15728640,
    array[
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  ),
  (
    'procurement-documents',
    'procurement-documents',
    false,
    52428800,
    array['application/pdf', 'image/png', 'image/jpeg', 'image/tiff']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "members can read own catalog files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'catalog-imports'
    and exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id::text = (storage.foldername(name))[1]
    )
  );

create policy "members can upload own catalog files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'catalog-imports'
    and exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id::text = (storage.foldername(name))[1]
    )
  );

create policy "members can delete own catalog files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'catalog-imports'
    and owner_id = auth.uid()::text
    and exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id::text = (storage.foldername(name))[1]
    )
  );

create policy "members can read matched procurement files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'procurement-documents'
    and exists (
      select 1 from public.procurement_documents pd
      where pd.procurement_id::text = (storage.foldername(name))[1]
        and public.can_access_procurement(pd.procurement_id)
    )
  );

-- Uploads de editais ficam restritos ao backend/service role. Não existe
-- policy de INSERT para clientes no bucket procurement-documents.
