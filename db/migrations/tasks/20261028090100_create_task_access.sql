-- O acesso do cargo "só tarefas" (2026-10-28): quem tem esse cargo enxerga só as páginas de tarefas (e as pastas)
-- que alguém liberou para ele, e mais nada da equipe. O muro é aqui, no banco, e não na tela: sem ele, a API, o
-- aplicativo ou o Supabase direto entregariam clientes, financeiro e CRM a quem só devia ver um quadro.
--
-- A virada é de uma linha: `is_member` passa a dizer "membro da equipe que vê a equipe" (todo cargo menos o de
-- tarefas), e `is_any_member` guarda o sentido antigo, para os poucos lugares que o cargo novo precisa (a própria
-- equipe, as pessoas, os avisos, o plano). Toda policy de domínio que já usa `is_member` passa a negar o cargo
-- novo sem ser tocada, e domínio novo nasce negando por padrão.

create or replace function public.is_any_member(p_organization_id uuid)
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

create or replace function public.is_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id and user_id = (select auth.uid()) and role <> 'tasks'
  );
$$;

-- O que foi liberado: uma página (um quadro de tarefas) ou uma pasta inteira, para uma pessoa. Pasta libera
-- tudo o que está dentro dela, inclusive as pastas de dentro.
create table public.task_access (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  folder_id uuid references public.project_folders (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint task_access_target check ((project_id is null) <> (folder_id is null))
);

create unique index task_access_project_idx on public.task_access (user_id, project_id) where project_id is not null;
create unique index task_access_folder_idx on public.task_access (user_id, folder_id) where folder_id is not null;
create index task_access_organization_idx on public.task_access (organization_id);

alter table public.task_access enable row level security;

-- A equipe vê e muda quem tem acesso (é a mesma gente que cria e edita as páginas); a pessoa do cargo vê só as
-- próprias linhas, para a tela saber o que mostrar.
create policy task_access_select on public.task_access
  for select to authenticated using (public.is_member(organization_id) or user_id = (select auth.uid()));
create policy task_access_write on public.task_access
  for all to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));

grant select, insert, update, delete on public.task_access to authenticated;
grant all on public.task_access to service_role;

create trigger task_access_project_same_organization
  before insert or update of project_id, organization_id on public.task_access
  for each row execute function public.assert_same_organization('projects', 'project_id');

create trigger task_access_folder_same_organization
  before insert or update of folder_id, organization_id on public.task_access
  for each row execute function public.assert_same_organization('project_folders', 'folder_id');

-- A pasta está liberada para quem consulta, por ela mesma ou por qualquer pasta acima dela.
create or replace function public.task_folder_granted(p_folder_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive chain as (
    select id, parent_id from public.project_folders where id = p_folder_id
    union
    select f.id, f.parent_id from public.project_folders f join chain c on f.id = c.parent_id
  )
  select exists (
    select 1 from public.task_access a
    join chain c on c.id = a.folder_id
    where a.user_id = (select auth.uid())
  );
$$;

-- A página de tarefas é visível: a equipe vê todas; o cargo de tarefas vê a liberada direto ou por uma pasta.
create or replace function public.task_board_visible(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and (
        public.is_member(p.organization_id)
        or (
          public.is_any_member(p.organization_id)
          and (
            exists (select 1 from public.task_access a where a.project_id = p.id and a.user_id = (select auth.uid()))
            or (p.folder_id is not null and public.task_folder_granted(p.folder_id))
          )
        )
      )
  );
$$;

-- A pasta aparece no menu: a equipe vê todas; o cargo de tarefas vê a liberada (e o que está dentro dela) e as
-- pastas acima do que foi liberado, que são o caminho até lá. Sem o caminho, a página liberada ficaria
-- pendurada numa pasta que a árvore não mostra.
create or replace function public.task_folder_visible(p_folder_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive mine as (
    select a.folder_id as id from public.task_access a where a.user_id = (select auth.uid()) and a.folder_id is not null
    union
    select p.folder_id from public.task_access a join public.projects p on p.id = a.project_id
    where a.user_id = (select auth.uid()) and p.folder_id is not null
  ),
  above as (
    select f.id, f.parent_id from public.project_folders f join mine m on m.id = f.id
    union
    select f.id, f.parent_id from public.project_folders f join above c on f.id = c.parent_id
  )
  select exists (
    select 1 from public.project_folders f
    where f.id = p_folder_id
      and (
        public.is_member(f.organization_id)
        or (public.is_any_member(f.organization_id) and (public.task_folder_granted(f.id) or exists (select 1 from above where above.id = f.id)))
      )
  );
$$;

-- A tarefa é visível quando a página dela é. Tarefa sem página ("sem projeto") é só da equipe.
create or replace function public.task_visible(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id
      and (public.is_member(t.organization_id) or (t.project_id is not null and public.task_board_visible(t.project_id)))
  );
$$;

-- Escrever numa tarefa: quem vê a página e passou pelo fator duplo, como o `can_write` da equipe.
create or replace function public.can_write_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.mfa_satisfied() and public.task_visible(p_task_id);
$$;

create or replace function public.can_write_task_board(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.mfa_satisfied() and public.task_board_visible(p_project_id);
$$;

-- ---------- A equipe, as pessoas, os avisos e o plano: o cargo de tarefas precisa deles para a tela abrir ----------

drop policy organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select to authenticated using (public.is_any_member(id) or created_by = (select auth.uid()));

drop policy organization_members_select on public.organization_members;
create policy organization_members_select on public.organization_members
  for select to authenticated using (public.is_any_member(organization_id));

drop policy notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated using (user_id = (select auth.uid()) and public.is_any_member(organization_id));

drop policy profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id and (current_organization_id is null or public.is_any_member(current_organization_id)));

drop policy time_entries_select on public.time_entries;
drop policy time_entries_insert on public.time_entries;
drop policy time_entries_update on public.time_entries;
drop policy time_entries_delete on public.time_entries;
create policy time_entries_select on public.time_entries
  for select to authenticated using (public.is_any_member(organization_id) and user_id = (select auth.uid()));
create policy time_entries_insert on public.time_entries
  for insert to authenticated with check (public.is_any_member(organization_id) and user_id = (select auth.uid()));
create policy time_entries_update on public.time_entries
  for update to authenticated
  using (public.is_any_member(organization_id) and user_id = (select auth.uid()))
  with check (public.is_any_member(organization_id) and user_id = (select auth.uid()));
create policy time_entries_delete on public.time_entries
  for delete to authenticated using (public.is_any_member(organization_id) and user_id = (select auth.uid()));

create or replace function public.set_current_org(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_any_member(p_organization_id) then
    raise exception 'Sem acesso a esta organização';
  end if;

  if exists (
    select 1 from public.organizations
    where id = p_organization_id and archived_at is not null
  ) then
    raise exception 'Esta equipe está arquivada';
  end if;

  update public.profiles
  set current_organization_id = p_organization_id
  where id = (select auth.uid());
end;
$$;

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
    and public.is_any_member(p_organization_id)
  order by m.created_at;
$$;

create or replace function public.organization_plan(p_organization_id uuid)
returns public.billing_plan
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plan public.billing_plan;
begin
  if (select auth.uid()) is not null and not public.is_any_member(p_organization_id) then
    raise exception 'Sem acesso a esta organização' using errcode = '42501';
  end if;

  if public.platform_unlocked(p_organization_id) then
    return 'alliance'::public.billing_plan;
  end if;

  select s.plan into v_plan
  from public.organization_subscriptions s
  where s.organization_id = p_organization_id
    and s.status in ('trialing', 'active', 'past_due');

  return coalesce(v_plan, 'free'::public.billing_plan);
end;
$$;

create or replace function public.organization_plans(p_organization_ids uuid[])
returns table (organization_id uuid, plan public.billing_plan)
language sql
stable
security definer
set search_path = ''
as $$
  select id, public.organization_plan(id)
  from unnest(p_organization_ids) as id
  where public.is_any_member(id);
$$;

-- O histórico de uma tarefa que o cargo de tarefas mexe: ele grava e lê só o das tarefas que vê.
create or replace function public.log_record_event(
  p_organization_id uuid,
  p_record_type public.record_kind,
  p_record_id uuid,
  p_action public.history_action,
  p_summary text,
  p_changes jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not (public.is_member(p_organization_id) or (p_record_type = 'task' and public.task_visible(p_record_id))) then
    raise exception 'Sem acesso a esta organização';
  end if;

  insert into public.record_history (organization_id, record_type, record_id, actor_id, action, summary, changes)
  values (
    p_organization_id,
    p_record_type,
    p_record_id,
    (select auth.uid()),
    p_action,
    p_summary,
    coalesce(p_changes, '[]'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

drop policy record_history_select on public.record_history;
create policy record_history_select on public.record_history
  for select to authenticated
  using (public.is_member(organization_id) or (record_type = 'task' and public.task_visible(record_id)));

-- Os contadores do menu respeitam o que cada um vê: a equipe conta tudo; o cargo de tarefas, só as páginas dele.
create or replace function public.task_open_counts(p_organization_id uuid)
returns table (project_id uuid, total integer)
language sql
stable
security definer
set search_path = ''
as $$
  select t.project_id, count(*)::integer
  from public.tasks t
  join public.task_stages s on s.id = t.stage_id
  where t.organization_id = p_organization_id
    and s.kind <> 'done'
    and (public.is_member(p_organization_id) or (t.project_id is not null and public.task_board_visible(t.project_id)))
  group by t.project_id;
$$;

-- ---------- As tarefas: a equipe como antes; o cargo de tarefas, só nas páginas liberadas ----------

drop policy projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated using (public.is_member(organization_id) or public.task_board_visible(id));

drop policy project_folders_select on public.project_folders;
create policy project_folders_select on public.project_folders
  for select to authenticated using (public.is_member(organization_id) or public.task_folder_visible(id));

drop policy project_stages_select on public.project_stages;
create policy project_stages_select on public.project_stages
  for select to authenticated using (public.is_member(organization_id) or public.task_board_visible(project_id));

drop policy task_stages_select on public.task_stages;
create policy task_stages_select on public.task_stages
  for select to authenticated using (public.is_any_member(organization_id));

drop policy tasks_select on public.tasks;
drop policy tasks_insert on public.tasks;
drop policy tasks_update on public.tasks;
drop policy tasks_delete on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated
  using (public.is_member(organization_id) or (project_id is not null and public.task_board_visible(project_id)));
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (public.can_write(organization_id) or (project_id is not null and public.can_write_task_board(project_id)));
create policy tasks_update on public.tasks
  for update to authenticated
  using (public.can_write(organization_id) or (project_id is not null and public.can_write_task_board(project_id)))
  with check (public.can_write(organization_id) or (project_id is not null and public.can_write_task_board(project_id)));
create policy tasks_delete on public.tasks
  for delete to authenticated
  using (public.can_write(organization_id) or (project_id is not null and public.can_write_task_board(project_id)));

drop policy task_people_select on public.task_people;
drop policy task_people_write on public.task_people;
create policy task_people_select on public.task_people
  for select to authenticated using (public.is_member(organization_id) or public.task_visible(task_id));
create policy task_people_write on public.task_people
  for all to authenticated
  using (public.can_write(organization_id) or public.can_write_task(task_id))
  with check (public.can_write(organization_id) or public.can_write_task(task_id));

drop policy subtasks_select on public.subtasks;
drop policy subtasks_write on public.subtasks;
create policy subtasks_select on public.subtasks
  for select to authenticated using (public.is_member(organization_id) or public.task_visible(task_id));
create policy subtasks_write on public.subtasks
  for all to authenticated
  using (public.can_write(organization_id) or public.can_write_task(task_id))
  with check (public.can_write(organization_id) or public.can_write_task(task_id));

drop policy task_links_select on public.task_links;
drop policy task_links_write on public.task_links;
create policy task_links_select on public.task_links
  for select to authenticated using (public.is_member(organization_id) or public.task_visible(task_id));
create policy task_links_write on public.task_links
  for all to authenticated
  using (public.can_write(organization_id) or public.can_write_task(task_id))
  with check (public.can_write(organization_id) or public.can_write_task(task_id));

drop policy task_attachments_select on public.task_attachments;
drop policy task_attachments_write on public.task_attachments;
create policy task_attachments_select on public.task_attachments
  for select to authenticated using (public.is_member(organization_id) or public.task_visible(task_id));
create policy task_attachments_write on public.task_attachments
  for all to authenticated
  using (public.can_write(organization_id) or public.can_write_task(task_id))
  with check (public.can_write(organization_id) or public.can_write_task(task_id));

drop policy task_events_select on public.task_events;
drop policy task_events_insert on public.task_events;
create policy task_events_select on public.task_events
  for select to authenticated using (public.is_member(organization_id) or public.task_visible(task_id));
create policy task_events_insert on public.task_events
  for insert to authenticated
  with check ((public.can_write(organization_id) or public.can_write_task(task_id)) and actor_id = (select auth.uid()));

-- ---------- Os arquivos das tarefas: o cargo de tarefas sobe imagem e anexo, e só nas pastas de tarefa ----------

create or replace function public.can_manage_task_file(p_name text)
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

  return public.is_any_member(v_organization_id);
end;
$$;

drop policy if exists domain_private_files_read on storage.objects;
create policy domain_private_files_read on storage.objects
  for select to authenticated
  using (
    (bucket_id = 'contract-files' and public.can_manage_org_file(name))
    or (bucket_id = 'task-files' and public.can_manage_task_file(name))
  );

drop policy if exists domain_files_insert on storage.objects;
drop policy if exists domain_files_update on storage.objects;
drop policy if exists domain_files_delete on storage.objects;

create policy domain_files_insert on storage.objects
  for insert to authenticated
  with check (
    (bucket_id in ('client-avatars', 'catalog-images', 'project-covers', 'charge-images', 'contract-files') and public.can_manage_org_file(name))
    or (bucket_id in ('task-images', 'task-files') and public.can_manage_task_file(name))
  );

create policy domain_files_update on storage.objects
  for update to authenticated
  using (
    (bucket_id in ('client-avatars', 'catalog-images', 'project-covers', 'charge-images', 'contract-files') and public.can_manage_org_file(name))
    or (bucket_id in ('task-images', 'task-files') and public.can_manage_task_file(name))
  )
  with check (
    (bucket_id in ('client-avatars', 'catalog-images', 'project-covers', 'charge-images', 'contract-files') and public.can_manage_org_file(name))
    or (bucket_id in ('task-images', 'task-files') and public.can_manage_task_file(name))
  );

create policy domain_files_delete on storage.objects
  for delete to authenticated
  using (
    (bucket_id in ('client-avatars', 'catalog-images', 'project-covers', 'charge-images', 'contract-files') and public.can_manage_org_file(name))
    or (bucket_id in ('task-images', 'task-files') and public.can_manage_task_file(name))
  );

revoke execute on function public.is_any_member(uuid) from public, anon;
revoke execute on function public.task_folder_granted(uuid) from public, anon;
revoke execute on function public.task_board_visible(uuid) from public, anon;
revoke execute on function public.task_folder_visible(uuid) from public, anon;
revoke execute on function public.task_visible(uuid) from public, anon;
revoke execute on function public.can_write_task(uuid) from public, anon;
revoke execute on function public.can_write_task_board(uuid) from public, anon;
revoke execute on function public.can_manage_task_file(text) from public, anon;

grant execute on function public.is_any_member(uuid) to authenticated;
grant execute on function public.task_folder_granted(uuid) to authenticated;
grant execute on function public.task_board_visible(uuid) to authenticated;
grant execute on function public.task_folder_visible(uuid) to authenticated;
grant execute on function public.task_visible(uuid) to authenticated;
grant execute on function public.can_write_task(uuid) to authenticated;
grant execute on function public.can_write_task_board(uuid) to authenticated;
grant execute on function public.can_manage_task_file(text) to authenticated;
