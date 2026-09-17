-- Projetos: o trabalho executado, que é ao mesmo tempo a base do portfólio e o quadro de tarefas. A árvore
-- do menu é pasta dentro de pasta com projeto na folha, então a pasta é tabela própria e o projeto aponta
-- para ela.

create type public.project_status as enum ('active', 'paused', 'done', 'cancelled');

create type public.project_glyph as enum ('kanban', 'palette', 'globe', 'storefront', 'megaphone', 'binoculars', 'tray');

-- Lista fechada porque marca sem arquivo em `public/brands` não desenha nada: marca nova é o arquivo, o
-- valor aqui e o rótulo em `labels.ts`.
create type public.project_tool as enum (
  'figma', 'adobexd', 'adobeillustrator', 'adobephotoshop', 'adobepremierepro', 'after-effects', 'canva',
  'webflow', 'wordpress', 'woocommerce', 'nextjs', 'react', 'vuejs', 'nuxtjs', 'angular', 'typescript',
  'javascript', 'nodejs', 'python', 'php', 'flutter', 'dart', 'kotlin', 'swift', 'tailwindcss', 'sass',
  'html5', 'css', 'firebase', 'vercel', 'cloudflare', 'aws', 'googlecloud', 'docker', 'github', 'gitlab',
  'postgresSQL', 'mySQL', 'mongodb', 'redis', 'threejs', 'jest', 'vitejs'
);

-- As etapas do quadro são catálogo global e cada projeto seleciona as suas, na ordem em que as colunas
-- aparecem. Enum, e não texto, para etapa escrita errada não virar coluna fantasma.
create type public.task_stage as enum ('backlog', 'todo', 'doing', 'blocked', 'review', 'approval', 'publishing', 'done');

create table public.project_folders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  parent_id uuid references public.project_folders (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_folders_not_own_parent check (parent_id is null or parent_id <> id)
);

create index project_folders_organization_idx on public.project_folders (organization_id, parent_id, position);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reference text not null,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  name text not null check (char_length(name) between 2 and 80),
  url text check (public.text_len_ok(url, 4, 200)),
  description text not null default '' check (char_length(description) <= 100),
  is_public boolean not null default false,
  -- Cliente com projeto não é apagado por engano: o cadastro é a raiz do trabalho, e apagá-lo em cascata
  -- levaria junto orçamento, contrato e cobrança que ainda importam.
  client_id uuid not null references public.clients (id) on delete restrict,
  owner_id uuid references auth.users (id) on delete set null,
  folder_id uuid references public.project_folders (id) on delete set null,
  status public.project_status not null default 'active',
  tags text[] not null default '{}' check (public.text_array_ok(tags, 12, 30)),
  tools public.project_tool[] not null default '{}' check (cardinality(tools) <= 40),
  stages public.task_stage[] not null default '{backlog,todo,doing,review,done}'
    check (cardinality(stages) between 1 and 8),
  budget_min bigint check (budget_min is null or budget_min >= 0),
  budget_max bigint check (budget_max is null or budget_max >= 0),
  started_at date not null default current_date,
  due_at date,
  progress smallint not null default 0 check (progress between 0 and 100),
  cover_url text check (public.text_len_ok(cover_url, 1, 500)),
  hue public.palette_hue not null default 'blue',
  glyph public.project_glyph not null default 'kanban',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference),
  unique (organization_id, slug),
  constraint projects_budget_pair check (
    (budget_min is null) = (budget_max is null)
    and (budget_max is null or budget_max >= budget_min)
  ),
  constraint projects_due_after_start check (due_at is null or due_at >= started_at)
);

create index projects_organization_status_idx on public.projects (organization_id, status);
create index projects_organization_started_idx on public.projects (organization_id, started_at desc);
create index projects_client_idx on public.projects (client_id);
create index projects_owner_idx on public.projects (owner_id);
create index projects_folder_idx on public.projects (folder_id);
create index projects_tags_idx on public.projects using gin (tags);
create index projects_search_idx on public.projects using gin (
  (coalesce(name, '') || ' ' || coalesce(description, '')) extensions.gin_trgm_ops
);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role text not null default '' check (char_length(role) <= 60),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index project_members_user_idx on public.project_members (user_id);
create index project_members_organization_idx on public.project_members (organization_id);

create table public.project_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) between 1 and 200),
  task_title text check (public.text_len_ok(task_title, 1, 120)),
  at timestamptz not null default now()
);

create index project_events_project_idx on public.project_events (project_id, at desc);

alter table public.project_folders enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_events enable row level security;

create policy project_folders_select on public.project_folders
  for select to authenticated using (public.is_member(organization_id));
create policy project_folders_write on public.project_folders
  for all to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));

create policy projects_select on public.projects
  for select to authenticated using (public.is_member(organization_id));
create policy projects_insert on public.projects
  for insert to authenticated with check (public.can_write(organization_id));
create policy projects_update on public.projects
  for update to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));
create policy projects_delete on public.projects
  for delete to authenticated using (public.can_write(organization_id));

create policy project_members_select on public.project_members
  for select to authenticated using (public.is_member(organization_id));
create policy project_members_write on public.project_members
  for all to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));

create policy project_events_select on public.project_events
  for select to authenticated using (public.is_member(organization_id));
create policy project_events_insert on public.project_events
  for insert to authenticated with check (public.can_write(organization_id) and actor_id = (select auth.uid()));

-- O registro apontado e quem aponta precisam ser da mesma organização: sem isto, alguém com acesso a dois
-- times ligaria um projeto de um ao cliente do outro, e a RLS não perceberia, porque cada linha, sozinha,
-- está certa. Um gatilho genérico, parametrizado pela tabela do outro lado e pela coluna que aponta, em vez
-- de uma cópia da regra por vínculo.
create or replace function public.assert_same_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid;
  v_id uuid;
begin
  execute format('select ($1).%I', tg_argv[1]) into v_id using new;
  if v_id is null then
    return new;
  end if;

  execute format('select organization_id from public.%I where id = $1', tg_argv[0])
    into v_target using v_id;

  if v_target is distinct from new.organization_id then
    raise exception 'Registro de outra organização em %', tg_argv[1];
  end if;

  return new;
end;
$$;

create trigger projects_client_same_organization
  before insert or update of client_id, organization_id on public.projects
  for each row execute function public.assert_same_organization('clients', 'client_id');

create trigger projects_folder_same_organization
  before insert or update of folder_id, organization_id on public.projects
  for each row execute function public.assert_same_organization('project_folders', 'folder_id');

create trigger projects_set_reference
  before insert on public.projects
  for each row execute function public.set_reference('project', 'PRJ');

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger project_folders_set_updated_at
  before update on public.project_folders
  for each row execute function public.set_updated_at();

revoke execute on function public.assert_same_organization() from public, anon;
