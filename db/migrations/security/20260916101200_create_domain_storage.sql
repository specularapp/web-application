-- Os baldes dos domínios de negócio. A pasta do arquivo é sempre o id da organização, e a permissão sai
-- daí: a mesma receita do balde das logos, num lugar só para os quatro.
--
-- Público é o que o cliente abre por link ou o que o portfólio mostra (capa de projeto, arte de catálogo,
-- documento de contrato). Privado é anexo de tarefa, que só a equipe vê e que por isso é servido por URL
-- assinada e de prazo curto.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('client-avatars', 'client-avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('catalog-images', 'catalog-images', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/avif']),
  ('project-covers', 'project-covers', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/avif']),
  ('contract-files', 'contract-files', false, 26214400, array['application/pdf', 'image/png']),
  ('task-files', 'task-files', false, 26214400, null)
on conflict (id) do nothing;

-- Quem é da organização dona da pasta escreve; a conversão do primeiro trecho do caminho em uuid fica dentro
-- de um bloco com tratamento, para caminho torto negar em vez de derrubar a policy com erro de sintaxe.
create or replace function public.can_manage_org_file(p_name text)
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

  return public.is_member(v_organization_id);
end;
$$;

create policy domain_public_files_read on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('client-avatars', 'catalog-images', 'project-covers'));

create policy domain_private_files_read on storage.objects
  for select to authenticated
  using (bucket_id in ('contract-files', 'task-files') and public.can_manage_org_file(name));

create policy domain_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('client-avatars', 'catalog-images', 'project-covers', 'contract-files', 'task-files')
    and public.can_manage_org_file(name)
  );

create policy domain_files_update on storage.objects
  for update to authenticated
  using (
    bucket_id in ('client-avatars', 'catalog-images', 'project-covers', 'contract-files', 'task-files')
    and public.can_manage_org_file(name)
  )
  with check (
    bucket_id in ('client-avatars', 'catalog-images', 'project-covers', 'contract-files', 'task-files')
    and public.can_manage_org_file(name)
  );

create policy domain_files_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('client-avatars', 'catalog-images', 'project-covers', 'contract-files', 'task-files')
    and public.can_manage_org_file(name)
  );

revoke execute on function public.can_manage_org_file(text) from public, anon;
grant execute on function public.can_manage_org_file(text) to authenticated;
