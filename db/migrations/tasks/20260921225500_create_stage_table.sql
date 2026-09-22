-- As etapas do quadro de tarefas viram tabela da equipe (2026-09-21, a pedido: "quero que tenha como definir
-- as etapas personalizadas, editar, excluir adicionar").
--
-- Até aqui a etapa era o enum `task_stage`, com oito nomes escritos no código, e o projeto só escolhia quais
-- usar. Isso segurou enquanto o quadro estava nascendo, mas fluxo de trabalho é coisa de cada equipe: quem
-- faz obra tem "Medição" e "Vistoria", quem faz vídeo tem "Decupagem" e "Color", e nenhuma das duas cabia
-- numa lista escrita por nós. O próprio catálogo já dizia isto em comentário: "nome livre por equipe é para
-- quando isso virar tabela".
--
-- O catálogo passa a ser **por organização**, e não por projeto. É o que mantém o quadro de todas as tarefas
-- de pé: ele cruza projetos com fluxos diferentes, e com etapa por projeto duas colunas "Em revisão" de
-- projetos distintos seriam duas linhas sem parentesco, impossíveis de reunir numa coluna só. A equipe tem o
-- catálogo dela; cada projeto escolhe quais usa e em que ordem, que é a mesma regra de antes.
--
-- `tasks.stage` deixa de ser enum e passa a apontar para a linha da etapa, com `on delete restrict`: apagar
-- uma etapa que ainda tem tarefa dentro faria as tarefas sumirem da vista sem sumir do banco, então quem
-- apaga precisa dizer para onde elas vão, e é isso que a função `delete_task_stage` cobra.

create type public.task_stage_kind as enum ('upcoming', 'ongoing', 'done');

-- Lista fechada porque glifo sem ícone no pacote não desenha nada: glifo novo é o valor aqui e a linha no
-- mapa de `features/tasks/stages.ts`, que é quem traduz a chave em componente.
create type public.task_stage_glyph as enum (
  'tray', 'circle-dashed', 'circle-half', 'prohibit', 'eye', 'thumbs-up', 'rocket', 'check-circle',
  'lightbulb', 'pencil', 'magnifier', 'chat', 'flag', 'star', 'clock', 'hourglass', 'package',
  'paint-brush', 'code', 'megaphone', 'handshake', 'bug', 'crosshair', 'file-text', 'play', 'pause',
  'archive', 'sparkle', 'users', 'truck', 'shield', 'seal', 'calendar', 'send', 'wrench', 'palette'
);

create table public.task_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  hue public.palette_hue not null default 'blue',
  glyph public.task_stage_glyph not null default 'circle-dashed',
  -- Em que ponto do caminho a etapa está: é daqui que sai a situação grossa da tarefa (a começar, em
  -- andamento, concluída), que o painel e a ficha mostram. Guardar situação na tarefa faria a etiqueta dizer
  -- uma coisa e a coluna outra assim que alguém movesse o cartão.
  kind public.task_stage_kind not null default 'ongoing',
  position smallint not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Nome único por equipe: duas colunas "Em revisão" no mesmo quadro não se distinguem, e o erro do banco
  -- vira a mensagem certa na tela em vez de dois lugares para a mesma coisa.
  unique (organization_id, name)
);

create index task_stages_organization_idx on public.task_stages (organization_id, position);

-- Quais etapas cada projeto usa, e em que ordem as colunas aparecem. Tabela de junção, e não array de ids:
-- só assim a chave estrangeira existe de verdade e apagar uma etapa não deixa um id órfão dentro de um
-- array que nada confere.
create table public.project_stages (
  project_id uuid not null references public.projects (id) on delete cascade,
  stage_id uuid not null references public.task_stages (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  position smallint not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  primary key (project_id, stage_id)
);

create index project_stages_project_idx on public.project_stages (project_id, position);
create index project_stages_stage_idx on public.project_stages (stage_id);

alter table public.tasks
  add column stage_id uuid references public.task_stages (id) on delete restrict;

-- O catálogo de sempre, que vira a primeira linha de cada equipe: as oito etapas com o nome, a cor e o
-- glifo que elas já tinham no código. Quem quiser outro fluxo renomeia, tira e acrescenta a partir daqui,
-- em vez de começar de uma tela vazia sem saber o que uma etapa é.
create or replace function public.seed_task_stages(p_organization uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.task_stages (organization_id, name, hue, glyph, kind, position)
  select
    p_organization,
    entry.name,
    entry.hue::public.palette_hue,
    entry.glyph::public.task_stage_glyph,
    entry.kind::public.task_stage_kind,
    entry.position
  from (
    values
      ('Backlog', 'gray', 'tray', 'upcoming', 0),
      ('A fazer', 'blue', 'circle-dashed', 'upcoming', 1),
      ('Em andamento', 'orange', 'circle-half', 'ongoing', 2),
      ('Bloqueada', 'red', 'prohibit', 'ongoing', 3),
      ('Em revisão', 'purple', 'eye', 'ongoing', 4),
      ('Aprovação', 'indigo', 'thumbs-up', 'ongoing', 5),
      ('Publicação', 'teal', 'rocket', 'ongoing', 6),
      ('Concluída', 'green', 'check-circle', 'done', 7)
  ) as entry (name, hue, glyph, kind, position)
  on conflict (organization_id, name) do nothing;
$$;

-- Equipe nova nasce com o catálogo, sem a tela ter de lembrar de semear: a regra precisa valer para a web e
-- para o aplicativo, e o único lugar por onde as duas passam é o banco.
create or replace function public.seed_task_stages_on_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_task_stages(new.id);
  return new;
end;
$$;

create trigger organizations_seed_task_stages
  after insert on public.organizations
  for each row execute function public.seed_task_stages_on_organization();

-- As equipes que já existem ganham o catálogo agora, para nenhuma abrir o quadro sem coluna nenhuma.
select public.seed_task_stages(id) from public.organizations;

-- O de-para entre o enum antigo e a linha nova, pelo nome, que é determinístico nos dois lados.
create temporary table stage_map on commit drop as
select
  o.id as organization_id,
  entry.code::public.task_stage as code,
  s.id as stage_id
from public.organizations o
cross join (
  values
    ('backlog', 'Backlog'),
    ('todo', 'A fazer'),
    ('doing', 'Em andamento'),
    ('blocked', 'Bloqueada'),
    ('review', 'Em revisão'),
    ('approval', 'Aprovação'),
    ('publishing', 'Publicação'),
    ('done', 'Concluída')
) as entry (code, name)
join public.task_stages s on s.organization_id = o.id and s.name = entry.name;

update public.tasks t
set stage_id = m.stage_id
from stage_map m
where m.organization_id = t.organization_id and m.code = t.stage;

insert into public.project_stages (project_id, stage_id, organization_id, position)
select p.id, m.stage_id, p.organization_id, chosen.ord - 1
from public.projects p
cross join lateral unnest(p.stages) with ordinality as chosen (code, ord)
join stage_map m on m.organization_id = p.organization_id and m.code = chosen.code
on conflict do nothing;

alter table public.tasks
  alter column stage_id set not null;

-- A tabela temporária sai antes do tipo: ela guarda uma coluna do enum antigo, e o Postgres não deixa apagar
-- um tipo que ainda tem uso, nem que o uso caia no commit logo adiante.
drop table stage_map;

-- O gatilho antigo lia `projects.stages`; o novo lê a tabela de junção. Tarefa sem projeto segue valendo
-- qualquer etapa da equipe, porque o balde mostra todas; e projeto sem coluna nenhuma escolhida também, para
-- um quadro recém-criado não recusar a primeira tarefa.
create or replace function public.assert_stage_in_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.project_id is null then
    return new;
  end if;

  if exists (select 1 from public.project_stages where project_id = new.project_id)
    and not exists (
      select 1 from public.project_stages
      where project_id = new.project_id and stage_id = new.stage_id
    )
  then
    raise exception 'A etapa não existe no quadro deste projeto';
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_stage_in_project on public.tasks;

create trigger tasks_stage_in_project
  before insert or update of stage_id, project_id on public.tasks
  for each row execute function public.assert_stage_in_project();

create trigger tasks_stage_same_organization
  before insert or update of stage_id, organization_id on public.tasks
  for each row execute function public.assert_same_organization('task_stages', 'stage_id');

create trigger project_stages_project_same_organization
  before insert or update of project_id, organization_id on public.project_stages
  for each row execute function public.assert_same_organization('projects', 'project_id');

create trigger project_stages_stage_same_organization
  before insert or update of stage_id, organization_id on public.project_stages
  for each row execute function public.assert_same_organization('task_stages', 'stage_id');

create trigger task_stages_set_updated_at
  before update on public.task_stages
  for each row execute function public.set_updated_at();

alter table public.tasks drop column stage;
alter table public.projects drop column stages;
drop type public.task_stage;

alter table public.task_stages enable row level security;
alter table public.project_stages enable row level security;

create policy task_stages_select on public.task_stages
  for select to authenticated using (public.is_member(organization_id));
create policy task_stages_write on public.task_stages
  for all to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));

create policy project_stages_select on public.project_stages
  for select to authenticated using (public.is_member(organization_id));
create policy project_stages_write on public.project_stages
  for all to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));

-- Apagar uma etapa é mexer em duas tabelas, e as duas precisam cair juntas: as tarefas vão para a etapa de
-- destino e só então a linha sai. Feito em duas escritas soltas da tela, uma falha no meio deixaria as
-- tarefas mudadas de coluna sem que a etapa tivesse ido embora.
create or replace function public.delete_task_stage(p_id uuid, p_move_to uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization uuid;
  v_tasks integer;
begin
  select organization_id into v_organization from public.task_stages where id = p_id;
  if v_organization is null then
    raise exception 'Etapa não encontrada';
  end if;

  if not public.can_write(v_organization) then
    raise exception 'Sem permissão para mexer nas etapas';
  end if;

  if (select count(*) from public.task_stages where organization_id = v_organization) <= 1 then
    raise exception 'A equipe precisa de ao menos uma etapa';
  end if;

  select count(*) into v_tasks from public.tasks where stage_id = p_id;

  if v_tasks > 0 then
    if p_move_to is null then
      raise exception 'Escolha para onde vão as % tarefas desta etapa', v_tasks;
    end if;

    if not exists (select 1 from public.task_stages where id = p_move_to and organization_id = v_organization) then
      raise exception 'A etapa de destino não é desta equipe';
    end if;

    -- As tarefas mudam de etapa antes de a linha sair, e os quadros que usavam a etapa apagada passam a
    -- oferecer a de destino, senão elas cairiam numa coluna que o projeto não desenha.
    insert into public.project_stages (project_id, stage_id, organization_id, position)
    select ps.project_id, p_move_to, ps.organization_id, ps.position
    from public.project_stages ps
    where ps.stage_id = p_id
    on conflict do nothing;

    update public.tasks set stage_id = p_move_to where stage_id = p_id;
  end if;

  delete from public.task_stages where id = p_id;
end;
$$;

-- A ordem das colunas em uma escrita só, e não uma por etapa: com uma por etapa, uma falha no meio deixaria
-- metade da lista na ordem nova e metade na antiga. `security invoker`, então a RLS de quem chama é quem
-- decide se a escrita vale.
create or replace function public.reorder_task_stages(p_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.task_stages s
  set position = entry.ord - 1
  from unnest(p_ids) with ordinality as entry (id, ord)
  where s.id = entry.id;
$$;

create or replace function public.reorder_project_stages(p_project uuid, p_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.project_stages ps
  set position = entry.ord - 1
  from unnest(p_ids) with ordinality as entry (id, ord)
  where ps.project_id = p_project and ps.stage_id = entry.id;
$$;

revoke execute on function public.seed_task_stages(uuid) from public, anon, authenticated;
revoke execute on function public.seed_task_stages_on_organization() from public, anon, authenticated;
revoke execute on function public.delete_task_stage(uuid, uuid) from public, anon;
grant execute on function public.delete_task_stage(uuid, uuid) to authenticated;
grant execute on function public.reorder_task_stages(uuid[]) to authenticated;
grant execute on function public.reorder_project_stages(uuid, uuid[]) to authenticated;

comment on table public.task_stages is
  'O catálogo de etapas de tarefa da equipe: nome, cor, glifo e em que ponto do caminho a etapa está.';
comment on table public.project_stages is
  'Quais etapas o quadro de cada projeto usa, e em que ordem as colunas aparecem.';
