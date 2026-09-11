-- Estado comercial informado pelo cliente, separado do resultado recalculável
-- do motor de aderência.
create table public.opportunity_states (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  procurement_id uuid not null references public.procurements(id) on delete cascade,
  saved boolean not null default false,
  workflow_status text check (
    workflow_status is null or workflow_status in (
      'avaliando',
      'vai_disputar',
      'nao_atende',
      'perdida'
    )
  ),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, procurement_id),
  check (saved or workflow_status is not null)
);

alter table public.opportunity_states enable row level security;

create policy "members can read own opportunity states"
  on public.opportunity_states for select to authenticated
  using (public.is_org_member(organization_id));

create policy "members can insert own opportunity states"
  on public.opportunity_states for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and updated_by = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.organization_id = opportunity_states.organization_id
        and m.procurement_id = opportunity_states.procurement_id
    )
  );

create policy "members can update own opportunity states"
  on public.opportunity_states for update to authenticated
  using (public.is_org_member(organization_id))
  with check (
    public.is_org_member(organization_id)
    and updated_by = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.organization_id = opportunity_states.organization_id
        and m.procurement_id = opportunity_states.procurement_id
    )
  );

create policy "members can delete own opportunity states"
  on public.opportunity_states for delete to authenticated
  using (public.is_org_member(organization_id));

comment on table public.opportunity_states is
  'Estado humano por organização; não altera a classificação produzida pelo matcher.';
