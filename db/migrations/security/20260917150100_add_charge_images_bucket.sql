-- O balde da foto da cobrança. Público, como a capa de projeto e a arte de catálogo, porque quem paga abre
-- a cobrança por link sem ter conta: com balde privado a imagem não apareceria para o pagador, que é
-- justamente quem ela existe para orientar.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('charge-images', 'charge-images', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

-- As policies de `20260916101200_create_domain_storage.sql` listam os baldes por extenso, então entrar na
-- lista é refazê-las. A regra não muda: a pasta é o id da organização e quem é dela escreve.
drop policy if exists domain_public_files_read on storage.objects;
drop policy if exists domain_files_insert on storage.objects;
drop policy if exists domain_files_update on storage.objects;
drop policy if exists domain_files_delete on storage.objects;

create policy domain_public_files_read on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('client-avatars', 'catalog-images', 'project-covers', 'charge-images'));

create policy domain_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('client-avatars', 'catalog-images', 'project-covers', 'charge-images', 'contract-files', 'task-files')
    and public.can_manage_org_file(name)
  );

create policy domain_files_update on storage.objects
  for update to authenticated
  using (
    bucket_id in ('client-avatars', 'catalog-images', 'project-covers', 'charge-images', 'contract-files', 'task-files')
    and public.can_manage_org_file(name)
  )
  with check (
    bucket_id in ('client-avatars', 'catalog-images', 'project-covers', 'charge-images', 'contract-files', 'task-files')
    and public.can_manage_org_file(name)
  );

create policy domain_files_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('client-avatars', 'catalog-images', 'project-covers', 'charge-images', 'contract-files', 'task-files')
    and public.can_manage_org_file(name)
  );
