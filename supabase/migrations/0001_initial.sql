-- Licita Peças: schema inicial. Nunca execute em produção sem revisar e aplicar
-- via pipeline de migration do projeto Supabase.
create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  cnpj text,
  vertical text not null default 'licita-pecas',
  plan text not null default 'piloto',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  primary key (organization_id, user_id)
);

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sku text not null,
  description text not null,
  oem text,
  manufacturer_code text,
  brand text,
  category text,
  application text,
  originalidade text,
  stock numeric,
  lead_time_days integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, sku)
);

create table if not exists public.procurements (
  id uuid primary key default gen_random_uuid(),
  source_id text not null,
  external_id text not null,
  agency text not null,
  municipality text,
  state text,
  modality text,
  status text,
  object text not null,
  published_at timestamptz,
  session_at timestamptz,
  deadline_at timestamptz,
  total_value numeric,
  source_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  procurement_id uuid not null references public.procurements(id) on delete cascade,
  catalog_item_id uuid references public.catalog_items(id) on delete set null,
  status text not null,
  score integer,
  reasons jsonb not null default '[]'::jsonb,
  evidence_quote text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  unique (organization_id, procurement_id, catalog_item_id)
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  procurement_id uuid not null references public.procurements(id) on delete cascade,
  type text not null,
  channel text not null default 'email',
  dedupe_key text not null,
  sent_at timestamptz,
  read_at timestamptz,
  unique (organization_id, dedupe_key)
);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.catalog_items enable row level security;
alter table public.procurements enable row level security;
alter table public.matches enable row level security;
alter table public.alerts enable row level security;

create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_org and user_id = auth.uid()
  );
$$;

create policy "members can read own organizations"
  on public.organizations for select
  using (public.is_org_member(id));
create policy "members can read own catalog"
  on public.catalog_items for select
  using (public.is_org_member(organization_id));
create policy "members can write own catalog"
  on public.catalog_items for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy "members can read procurements"
  on public.procurements for select
  using (exists (select 1 from public.matches m where m.procurement_id = id and public.is_org_member(m.organization_id)));
create policy "members can read own matches"
  on public.matches for select
  using (public.is_org_member(organization_id));
create policy "members can update own matches"
  on public.matches for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy "members can read own alerts"
  on public.alerts for select
  using (public.is_org_member(organization_id));
create policy "members can update own alerts"
  on public.alerts for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
