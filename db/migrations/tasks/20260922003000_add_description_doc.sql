-- A descrição da tarefa vira documento (2026-09-22, a pedido: "igual um notion funciona, ali conseguimos
-- colocar titulos, checkbox, lista, imagens estendidas e tudo mais").
--
-- O texto corrido de antes continua, em `description`, e passa a ser **derivado**: é o documento achatado em
-- texto puro, que é o que a busca por trigrama varre e o que o cartão e o resumo do índice mostram. O
-- documento em si vai em `description_doc`, como o contrato já guarda o corpo dele: JSON do editor, com a
-- lista de nós fechada pelo zod no servidor, e a tela desenhando nó por nó em vez de injetar HTML.
--
-- Guardar os dois é de propósito, e não redundância por descuido: procurar dentro de um jsonb aninhado com
-- índice de trigrama não existe, e o cartão do quadro não deve carregar a árvore inteira para mostrar duas
-- linhas. Um é o conteúdo, o outro é a leitura rasa dele.

alter table public.tasks
  add column description_doc jsonb check (description_doc is null or jsonb_typeof(description_doc) = 'object');

-- O texto puro de um documento é mais longo que o de um campo de formulário: o teto sobe para acompanhar o
-- que o editor permite escrever.
alter table public.tasks
  drop constraint tasks_description_check;

alter table public.tasks
  add constraint tasks_description_check check (char_length(description) <= 20000);

comment on column public.tasks.description_doc is
  'A descrição como documento do editor (nós do Tiptap). `description` guarda o mesmo conteúdo em texto puro, para busca e resumo.';

-- As imagens que entram no meio da descrição. Balde público, como a capa de projeto e a arte de catálogo: o
-- endereço é longo e aleatório, e a alternativa (balde privado com endereço assinado) faria cada imagem do
-- texto vencer sozinha e sumir da tarefa depois de um tempo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-images', 'task-images', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

-- As policies de `security/20260916101200_create_domain_storage.sql` listam os baldes por extenso, então
-- entrar na lista é refazê-las. A regra não muda: a pasta é o id da organização e quem é dela escreve.
drop policy if exists domain_public_files_read on storage.objects;
drop policy if exists domain_files_insert on storage.objects;
drop policy if exists domain_files_update on storage.objects;
drop policy if exists domain_files_delete on storage.objects;

create policy domain_public_files_read on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('client-avatars', 'catalog-images', 'project-covers', 'charge-images', 'task-images'));

create policy domain_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('client-avatars', 'catalog-images', 'project-covers', 'charge-images', 'task-images', 'contract-files', 'task-files')
    and public.can_manage_org_file(name)
  );

create policy domain_files_update on storage.objects
  for update to authenticated
  using (
    bucket_id in ('client-avatars', 'catalog-images', 'project-covers', 'charge-images', 'task-images', 'contract-files', 'task-files')
    and public.can_manage_org_file(name)
  )
  with check (
    bucket_id in ('client-avatars', 'catalog-images', 'project-covers', 'charge-images', 'task-images', 'contract-files', 'task-files')
    and public.can_manage_org_file(name)
  );

create policy domain_files_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('client-avatars', 'catalog-images', 'project-covers', 'charge-images', 'task-images', 'contract-files', 'task-files')
    and public.can_manage_org_file(name)
  );
