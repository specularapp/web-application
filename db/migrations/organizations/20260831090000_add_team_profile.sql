create type public.organization_industry as enum (
  'web_development',
  'mobile_development',
  'product_design',
  'brand_design',
  'design_and_development',
  'other'
);

alter table public.organizations
  add column industry public.organization_industry,
  add column website text check (website is null or char_length(website) between 4 and 200),
  add column onboarding_completed_at timestamptz;

alter table public.organization_invites
  add column name text check (name is null or char_length(name) between 2 and 120);

create or replace function public.team_members(p_organization_id uuid)
returns table (
  user_id uuid,
  name text,
  email text,
  avatar_url text,
  role public.member_role,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.user_id,
    p.full_name,
    p.email,
    p.avatar_url,
    m.role,
    m.created_at
  from public.organization_members m
  join public.profiles p on p.id = m.user_id
  where m.organization_id = p_organization_id
    and public.is_member(p_organization_id)
  order by m.created_at;
$$;

drop function if exists public.create_invite(uuid, text, public.member_role);

create or replace function public.create_invite(
  p_organization_id uuid,
  p_email text,
  p_name text default null,
  p_role public.member_role default 'member'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_token text;
begin
  if not public.has_role(p_organization_id, array['owner', 'admin']::public.member_role[]) then
    raise exception 'Sem permissão para convidar nesta organização';
  end if;

  if p_role = 'owner' then
    raise exception 'Convite não pode ter papel owner';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail inválido';
  end if;

  if exists (
    select 1
    from public.organization_members m
    join auth.users u on u.id = m.user_id
    where m.organization_id = p_organization_id and lower(u.email) = v_email
  ) then
    raise exception 'Essa pessoa já faz parte do time';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  delete from public.organization_invites
  where organization_id = p_organization_id and email = v_email and accepted_at is null;

  insert into public.organization_invites (organization_id, email, name, role, token_hash, invited_by)
  values (
    p_organization_id,
    v_email,
    v_name,
    p_role,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    (select auth.uid())
  );

  return v_token;
end;
$$;

create or replace function public.complete_onboarding(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(p_organization_id, array['owner', 'admin']::public.member_role[]) then
    raise exception 'Sem permissão para concluir a configuração desta organização';
  end if;

  update public.organizations
  set onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = p_organization_id;
end;
$$;

revoke execute on function public.team_members(uuid) from public, anon;
revoke execute on function public.create_invite(uuid, text, text, public.member_role) from public, anon;
revoke execute on function public.complete_onboarding(uuid) from public, anon;
