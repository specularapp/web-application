create or replace function public.is_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id and user_id = (select auth.uid())
  );
$$;

create or replace function public.has_role(p_organization_id uuid, p_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id
      and user_id = (select auth.uid())
      and role = any (p_roles)
  );
$$;

create or replace function public.shares_org_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id
  );
$$;

create or replace function public.current_org()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select current_organization_id from public.profiles where id = (select auth.uid());
$$;

create policy organizations_select on public.organizations
  for select to authenticated
  using (public.is_member(id));

create policy organizations_insert on public.organizations
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy organizations_update on public.organizations
  for update to authenticated
  using (public.has_role(id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_role(id, array['owner', 'admin']::public.member_role[]));

create policy organizations_delete on public.organizations
  for delete to authenticated
  using (public.has_role(id, array['owner']::public.member_role[]));

create policy organization_members_select on public.organization_members
  for select to authenticated
  using (public.is_member(organization_id));

create policy organization_members_update on public.organization_members
  for update to authenticated
  using (public.has_role(organization_id, array['owner']::public.member_role[]))
  with check (public.has_role(organization_id, array['owner']::public.member_role[]));

create policy organization_members_delete on public.organization_members
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_role(organization_id, array['owner', 'admin']::public.member_role[])
  );

create policy organization_invites_select on public.organization_invites
  for select to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

create policy organization_invites_delete on public.organization_invites
  for delete to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

drop policy profiles_select_own on public.profiles;

create policy profiles_select_own_or_same_org on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id or public.shares_org_with(id));

drop policy profiles_update_own on public.profiles;

create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check (
    (select auth.uid()) = id
    and (current_organization_id is null or public.is_member(current_organization_id))
  );
