-- Tarefas: o quadro de cada projeto, e o balde de quem não tem projeto. A situação não é campo: sai da
-- etapa, pelo mesmo motivo do CRM. O que tira a tarefa do vácuo são os vínculos, que apontam para qualquer
-- registro da casa, e por isso o alvo é polimórfico e cada tipo tem a própria chave estrangeira, em vez de
-- um id solto que nada garante.

create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.task_attachment_type as enum ('pdf', 'image', 'figma', 'link', 'file');
create type public.task_event_kind as enum ('comment', 'change');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reference text not null,
  project_id uuid references public.projects (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '' check (char_length(description) <= 4000),
  due_date date not null,
  start_date date,
  estimate_minutes integer check (estimate_minutes is null or (estimate_minutes > 0 and estimate_minutes <= 100000)),
  stage public.task_stage not null default 'backlog',
  priority public.task_priority not null default 'normal',
  owner_id uuid references auth.users (id) on delete set null,
  tags text[] not null default '{}' check (public.text_array_ok(tags, 12, 30)),
  alert text check (public.text_len_ok(alert, 1, 300)),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference),
  constraint tasks_due_after_start check (start_date is null or due_date >= start_date)
);

create index tasks_organization_stage_idx on public.tasks (organization_id, stage);
create index tasks_project_stage_idx on public.tasks (project_id, stage, position);
create index tasks_owner_idx on public.tasks (owner_id);
create index tasks_organization_due_idx on public.tasks (organization_id, due_date);
create index tasks_tags_idx on public.tasks using gin (tags);
create index tasks_search_idx on public.tasks using gin (
  (coalesce(title, '') || ' ' || coalesce(description, '')) extensions.gin_trgm_ops
);

create table public.task_people (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index task_people_user_idx on public.task_people (user_id);

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  done boolean not null default false,
  assignee_id uuid references auth.users (id) on delete set null,
  -- Peso e prazo próprios, e não herdados: numa lista de quatro costuma ser uma só que aperta. Nulo é o que
  -- a tarefa já diz.
  priority public.task_priority,
  due_date date,
  position smallint not null default 0 check (position >= 0),
  created_at timestamptz not null default now()
);

create index subtasks_task_idx on public.subtasks (task_id, position);

-- O vínculo aponta para um registro de cada vez, e a coluna de cada tipo é uma chave estrangeira de
-- verdade: assim apagar o cliente leva junto o vínculo dele, em vez de deixar a ficha mostrando um registro
-- que não existe mais.
create table public.task_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  quote_id uuid references public.quotes (id) on delete cascade,
  linked_project_id uuid references public.projects (id) on delete cascade,
  contract_id uuid references public.contracts (id) on delete cascade,
  position smallint not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  constraint task_links_exactly_one check (
    num_nonnulls(client_id, quote_id, linked_project_id, contract_id) = 1
  )
);

create index task_links_task_idx on public.task_links (task_id, position);
create index task_links_client_idx on public.task_links (client_id);
create index task_links_quote_idx on public.task_links (quote_id);
create index task_links_project_idx on public.task_links (linked_project_id);
create index task_links_contract_idx on public.task_links (contract_id);

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  event_id uuid,
  name text not null check (char_length(name) between 1 and 200),
  type public.task_attachment_type not null,
  url text not null check (char_length(url) between 1 and 800),
  size_bytes bigint check (size_bytes is null or size_bytes > 0),
  label text check (public.text_len_ok(label, 1, 40)),
  created_at timestamptz not null default now()
);

create index task_attachments_task_idx on public.task_attachments (task_id, created_at);

create table public.task_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) between 1 and 4000),
  kind public.task_event_kind not null default 'change',
  -- O que o comentário marcou: o sinal digitado e o que ele aponta. Lista, porque uma frase marca vários.
  mentions jsonb not null default '[]'::jsonb check (jsonb_typeof(mentions) = 'array'),
  audio_url text check (public.text_len_ok(audio_url, 1, 800)),
  audio_seconds integer check (audio_seconds is null or (audio_seconds > 0 and audio_seconds <= 7200)),
  at timestamptz not null default now(),
  constraint task_events_audio_pair check ((audio_url is null) = (audio_seconds is null))
);

create index task_events_task_idx on public.task_events (task_id, at desc);

alter table public.task_attachments
  add constraint task_attachments_event_fk foreign key (event_id) references public.task_events (id) on delete cascade;

alter table public.tasks enable row level security;
alter table public.task_people enable row level security;
alter table public.subtasks enable row level security;
alter table public.task_links enable row level security;
alter table public.task_attachments enable row level security;
alter table public.task_events enable row level security;

create policy tasks_select on public.tasks
  for select to authenticated using (public.is_member(organization_id));
create policy tasks_insert on public.tasks
  for insert to authenticated with check (public.can_write(organization_id));
create policy tasks_update on public.tasks
  for update to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));
create policy tasks_delete on public.tasks
  for delete to authenticated using (public.can_write(organization_id));

create policy task_people_select on public.task_people
  for select to authenticated using (public.is_member(organization_id));
create policy task_people_write on public.task_people
  for all to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));

create policy subtasks_select on public.subtasks
  for select to authenticated using (public.is_member(organization_id));
create policy subtasks_write on public.subtasks
  for all to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));

create policy task_links_select on public.task_links
  for select to authenticated using (public.is_member(organization_id));
create policy task_links_write on public.task_links
  for all to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));

create policy task_attachments_select on public.task_attachments
  for select to authenticated using (public.is_member(organization_id));
create policy task_attachments_write on public.task_attachments
  for all to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));

create policy task_events_select on public.task_events
  for select to authenticated using (public.is_member(organization_id));
-- Histórico é registro do que aconteceu: quem escreveu não reescreve depois, e ninguém apaga.
create policy task_events_insert on public.task_events
  for insert to authenticated
  with check (public.can_write(organization_id) and actor_id = (select auth.uid()));

create trigger tasks_project_same_organization
  before insert or update of project_id, organization_id on public.tasks
  for each row execute function public.assert_same_organization('projects', 'project_id');

create trigger subtasks_task_same_organization
  before insert or update of task_id, organization_id on public.subtasks
  for each row execute function public.assert_same_organization('tasks', 'task_id');

create trigger task_links_task_same_organization
  before insert or update of task_id, organization_id on public.task_links
  for each row execute function public.assert_same_organization('tasks', 'task_id');

create trigger task_links_client_same_organization
  before insert or update of client_id, organization_id on public.task_links
  for each row execute function public.assert_same_organization('clients', 'client_id');

create trigger task_links_quote_same_organization
  before insert or update of quote_id, organization_id on public.task_links
  for each row execute function public.assert_same_organization('quotes', 'quote_id');

create trigger task_links_project_same_organization
  before insert or update of linked_project_id, organization_id on public.task_links
  for each row execute function public.assert_same_organization('projects', 'linked_project_id');

create trigger task_links_contract_same_organization
  before insert or update of contract_id, organization_id on public.task_links
  for each row execute function public.assert_same_organization('contracts', 'contract_id');

create trigger task_attachments_task_same_organization
  before insert or update of task_id, organization_id on public.task_attachments
  for each row execute function public.assert_same_organization('tasks', 'task_id');

create trigger task_events_task_same_organization
  before insert or update of task_id, organization_id on public.task_events
  for each row execute function public.assert_same_organization('tasks', 'task_id');

create trigger tasks_set_reference
  before insert on public.tasks
  for each row execute function public.set_reference('task', 'TAR');

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- A etapa da tarefa precisa ser uma das que o projeto escolheu: fora disso o cartão iria para uma coluna que
-- o quadro nem desenha, e sumiria da tela sem ter sumido do banco. Tarefa sem projeto vale qualquer etapa do
-- catálogo, porque o balde mostra todas.
create or replace function public.assert_stage_in_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stages public.task_stage[];
begin
  if new.project_id is null then
    return new;
  end if;

  select stages into v_stages from public.projects where id = new.project_id;

  if v_stages is not null and not (new.stage = any (v_stages)) then
    raise exception 'A etapa % não existe no quadro deste projeto', new.stage;
  end if;

  return new;
end;
$$;

create trigger tasks_stage_in_project
  before insert or update of stage, project_id on public.tasks
  for each row execute function public.assert_stage_in_project();

revoke execute on function public.assert_stage_in_project() from public, anon;
