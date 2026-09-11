-- Expande o schema para o fluxo completo do piloto. Aplicar somente depois de
-- 0001_initial.sql e revisar no ambiente de staging antes de produção.

create table public.supplier_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  regions text[] not null default '{}',
  delivery_radius_km integer check (delivery_radius_km is null or delivery_radius_km >= 0),
  catalog_rules jsonb not null default '{}'::jsonb,
  exclusions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  base_url text not null,
  active boolean not null default true,
  schedule text not null,
  health_status text not null default 'healthy'
    check (health_status in ('healthy', 'degraded', 'paused')),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  retry_after timestamptz,
  last_checked_at timestamptz,
  unique (type, base_url)
);

create table public.procurement_documents (
  id uuid primary key default gen_random_uuid(),
  procurement_id uuid not null references public.procurements(id) on delete cascade,
  url text not null,
  document_type text not null,
  content_hash text not null,
  fetched_at timestamptz not null,
  extracted_text text,
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'native_text', 'ocr', 'failed')),
  previous_version_id uuid references public.procurement_documents(id) on delete set null,
  unique (procurement_id, url, content_hash)
);

create index procurement_documents_latest_idx
  on public.procurement_documents (procurement_id, url, fetched_at desc);

create table public.lots (
  id uuid primary key default gen_random_uuid(),
  procurement_id uuid not null references public.procurements(id) on delete cascade,
  external_id text not null,
  description text not null,
  value numeric,
  quantity numeric,
  unit text,
  unique (procurement_id, external_id)
);

create table public.procurement_items (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots(id) on delete cascade,
  external_id text not null,
  description text not null,
  codes jsonb not null default '[]'::jsonb,
  brand_requirement text,
  application text,
  quantity numeric,
  unit text,
  technical_requirements jsonb not null default '{}'::jsonb,
  unique (lot_id, external_id)
);

alter table public.matches
  add column if not exists item_id uuid references public.procurement_items(id) on delete cascade,
  add column if not exists negative_reasons jsonb not null default '[]'::jsonb,
  add column if not exists evidence jsonb not null default '[]'::jsonb;

create table public.source_events (
  id uuid primary key default gen_random_uuid(),
  procurement_id uuid not null references public.procurements(id) on delete cascade,
  event_type text not null,
  previous_hash text,
  current_hash text,
  changed_fields text[] not null default '{}',
  occurred_at timestamptz not null default now(),
  dedupe_key text not null unique
);

create table public.alert_preferences (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  email_enabled boolean not null default true,
  enabled_types text[] not null default array[
    'new_match',
    'procurement_changed',
    'deadline_near',
    'item_reclassified'
  ],
  unsubscribed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.match_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  rating text not null check (rating in ('correto', 'parcial', 'incorreto')),
  reason text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, match_id, created_by)
);

create table public.catalog_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  storage_path text not null,
  content_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'validated', 'imported', 'failed')),
  row_count integer check (row_count is null or row_count >= 0),
  error_summary text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (organization_id, content_hash)
);

create or replace function public.can_access_procurement(target_procurement uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.matches m
    where m.procurement_id = target_procurement
      and public.is_org_member(m.organization_id)
  );
$$;

alter table public.supplier_profiles enable row level security;
alter table public.sources enable row level security;
alter table public.procurement_documents enable row level security;
alter table public.lots enable row level security;
alter table public.procurement_items enable row level security;
alter table public.source_events enable row level security;
alter table public.alert_preferences enable row level security;
alter table public.match_feedback enable row level security;
alter table public.catalog_imports enable row level security;

create policy "members can read own membership"
  on public.organization_members for select
  using (user_id = auth.uid());

create policy "members can manage own supplier profile"
  on public.supplier_profiles for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "members can read related documents"
  on public.procurement_documents for select
  using (public.can_access_procurement(procurement_id));

create policy "members can read related lots"
  on public.lots for select
  using (public.can_access_procurement(procurement_id));

create policy "members can read related items"
  on public.procurement_items for select
  using (
    exists (
      select 1 from public.lots l
      where l.id = lot_id and public.can_access_procurement(l.procurement_id)
    )
  );

create policy "members can read related source events"
  on public.source_events for select
  using (public.can_access_procurement(procurement_id));

create policy "members can manage own alert preferences"
  on public.alert_preferences for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "members can read own feedback"
  on public.match_feedback for select
  using (public.is_org_member(organization_id));

create policy "members can create own feedback"
  on public.match_feedback for insert
  with check (
    public.is_org_member(organization_id)
    and created_by = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.organization_id = organization_id
    )
  );

create policy "members can read own catalog imports"
  on public.catalog_imports for select
  using (public.is_org_member(organization_id));

create policy "members can create own catalog imports"
  on public.catalog_imports for insert
  with check (
    public.is_org_member(organization_id)
    and created_by = auth.uid()
  );

-- `sources` não recebe policy de cliente: saúde e configuração permanecem
-- acessíveis somente pelo backend com service role.
