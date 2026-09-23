create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  note text not null default '' check (char_length(note) <= 300),
  started_at timestamptz not null default now(),
  stopped_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  created_at timestamptz not null default now(),
  constraint time_entries_target check (project_id is not null or task_id is not null),
  constraint time_entries_stop_pair check ((stopped_at is null) = (duration_seconds is null)),
  constraint time_entries_order check (stopped_at is null or stopped_at >= started_at)
);

create unique index time_entries_one_active_user_idx on public.time_entries (user_id) where stopped_at is null;
create index time_entries_user_idx on public.time_entries (organization_id, user_id, started_at desc);
create index time_entries_project_idx on public.time_entries (project_id, started_at desc);
create index time_entries_task_idx on public.time_entries (task_id, started_at desc);

alter table public.time_entries enable row level security;

create policy time_entries_select on public.time_entries
  for select to authenticated using (public.is_member(organization_id) and user_id = (select auth.uid()));
create policy time_entries_insert on public.time_entries
  for insert to authenticated with check (public.is_member(organization_id) and user_id = (select auth.uid()));
create policy time_entries_update on public.time_entries
  for update to authenticated using (public.is_member(organization_id) and user_id = (select auth.uid()))
  with check (public.is_member(organization_id) and user_id = (select auth.uid()));
create policy time_entries_delete on public.time_entries
  for delete to authenticated using (public.is_member(organization_id) and user_id = (select auth.uid()));

create trigger time_entries_project_same_organization
  before insert or update of project_id, organization_id on public.time_entries
  for each row execute function public.assert_same_organization('projects', 'project_id');
create trigger time_entries_task_same_organization
  before insert or update of task_id, organization_id on public.time_entries
  for each row execute function public.assert_same_organization('tasks', 'task_id');

comment on table public.time_entries is 'Apontamentos individuais de tempo em projetos e tarefas, com no máximo um cronômetro ativo por usuário.';
