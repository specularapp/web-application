insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-logos',
  'organization-logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- A pasta do arquivo é o id da organização. Converter fora de um bloco com tratamento de exceção
-- deixaria a policy quebrar com erro de sintaxe de uuid em vez de simplesmente negar.
create or replace function public.can_manage_logo(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
begin
  begin
    v_organization_id := split_part(p_name, '/', 1)::uuid;
  exception
    when others then return false;
  end;

  return public.has_role(v_organization_id, array['owner', 'admin']::public.member_role[]);
end;
$$;

drop policy if exists organization_logos_read on storage.objects;
drop policy if exists organization_logos_insert on storage.objects;
drop policy if exists organization_logos_update on storage.objects;
drop policy if exists organization_logos_delete on storage.objects;

create policy organization_logos_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'organization-logos');

create policy organization_logos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'organization-logos' and public.can_manage_logo(name));

create policy organization_logos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'organization-logos' and public.can_manage_logo(name))
  with check (bucket_id = 'organization-logos' and public.can_manage_logo(name));

create policy organization_logos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'organization-logos' and public.can_manage_logo(name));

revoke execute on function public.can_manage_logo(text) from public, anon;
