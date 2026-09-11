create or replace function public.create_organization_for_current_user(
  organization_name text,
  organization_cnpj text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_organization_id uuid;
  new_organization_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication_required';
  end if;
  if length(trim(organization_name)) < 3 then
    raise exception 'invalid_organization_name';
  end if;
  if organization_cnpj is not null and organization_cnpj !~ '^[0-9]{14}$' then
    raise exception 'invalid_cnpj';
  end if;

  select organization_id into existing_organization_id
  from public.organization_members
  where user_id = current_user_id
  limit 1;
  if existing_organization_id is not null then
    return existing_organization_id;
  end if;

  insert into public.organizations (legal_name, cnpj, vertical, plan, status)
  values (trim(organization_name), organization_cnpj, 'licita-pecas', 'piloto', 'active')
  returning id into new_organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_organization_id, current_user_id, 'owner');
  insert into public.supplier_profiles (organization_id)
  values (new_organization_id);
  insert into public.alert_preferences (organization_id)
  values (new_organization_id);

  return new_organization_id;
end;
$$;

revoke all on function public.create_organization_for_current_user(text, text) from public;
grant execute on function public.create_organization_for_current_user(text, text) to authenticated;
