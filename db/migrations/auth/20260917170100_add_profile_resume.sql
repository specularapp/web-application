-- O currículo mora no perfil da pessoa (2026-09-17, a pedido das páginas pendentes).
--
-- Currículo é da pessoa, e não da equipe: quem muda de estúdio leva o dele. Por isso as colunas entram em
-- `profiles`, que já é a ficha de quem entra, e não numa tabela por organização. O endereço público
-- (`/cv/<slug>`) é próprio e só serve quando a pessoa liga o currículo público.

alter table public.profiles
  add column headline text check (headline is null or char_length(headline) <= 120),
  add column bio text check (bio is null or char_length(bio) <= 1200),
  add column location text check (location is null or char_length(location) <= 80),
  add column skills text[] not null default '{}' check (cardinality(skills) <= 30),
  /* Lista de `{ label, url }`, fechada pelo zod; aqui só se garante que é lista. */
  add column links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
  add column resume_slug text unique
    check (resume_slug is null or (resume_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(resume_slug) between 3 and 40)),
  add column resume_public boolean not null default false;

-- A leitura pública do currículo: a pessoa, o que ela escreveu e os projetos públicos das equipes de que
-- ela faz parte. Só sai quando o currículo está ligado. `service_role` só, como toda leitura pública.
create or replace function public.public_resume(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', p.full_name,
    'avatarUrl', p.avatar_url,
    'headline', p.headline,
    'bio', p.bio,
    'location', p.location,
    'skills', p.skills,
    'links', p.links,
    'team', (
      select jsonb_build_object('name', o.name, 'slug', o.slug, 'logoUrl', o.logo_url, 'website', o.website)
      from public.organizations o
      where o.id = p.current_organization_id and o.archived_at is null
    ),
    'projects', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', pr.id,
            'name', pr.name,
            'description', pr.description,
            'url', pr.url,
            'coverUrl', pr.cover_url,
            'logoUrl', pr.logo_url,
            'tags', pr.tags,
            'tools', pr.tools,
            'hue', pr.hue,
            'startedAt', pr.started_at,
            'status', pr.status
          )
          order by pr.started_at desc
        )
        from public.projects pr
        join public.organization_members m on m.organization_id = pr.organization_id and m.user_id = p.id
        where pr.is_public = true
      ),
      '[]'::jsonb
    )
  )
  from public.profiles p
  where p.resume_slug = p_slug and p.resume_public = true
  limit 1;
$$;

revoke execute on function public.public_resume(text) from public, anon, authenticated;
grant execute on function public.public_resume(text) to service_role;

-- A foto da pessoa. A pasta é o id de quem entra, e só ela escreve na própria pasta; ler é público, porque
-- o rosto aparece no currículo e nos documentos que a equipe manda.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-avatars', 'user-avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy user_avatars_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'user-avatars');

create policy user_avatars_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'user-avatars' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy user_avatars_update on storage.objects
  for update to authenticated
  using (bucket_id = 'user-avatars' and split_part(name, '/', 1) = (select auth.uid())::text)
  with check (bucket_id = 'user-avatars' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy user_avatars_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'user-avatars' and split_part(name, '/', 1) = (select auth.uid())::text);
