-- Completa a persistência do catálogo validado e permite que o importador
-- autenticado avance ou registre falha no próprio processamento.
alter table public.catalog_items
  add column if not exists compatible_vehicles text,
  add column if not exists part_type text,
  add column if not exists reference_price numeric
    check (reference_price is null or reference_price >= 0);

create policy "members can update own catalog imports"
  on public.catalog_imports for update to authenticated
  using (public.is_org_member(organization_id))
  with check (
    public.is_org_member(organization_id)
    and created_by = auth.uid()
  );

comment on column public.catalog_items.reference_price is
  'Preço comercial opcional informado pelo cliente; nunca representa preço de custo.';

-- Rollback de emergência (somente antes de haver dados dependentes): remover a
-- policy acima. As colunas devem permanecer em produção e ser retiradas apenas
-- por migration posterior, depois de exportar/verificar os dados.
