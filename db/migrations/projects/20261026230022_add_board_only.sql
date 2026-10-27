-- Quadro de tarefas sem projeto (2026-10-26, a pedido: "criar somente, e depois eu atrelo a um projeto").
--
-- Todo quadro de Tarefas era um projeto inteiro, e criar uma página na árvore obrigava a passar pela ficha
-- (cliente, valores, datas, ferramentas). O quadro avulso é a mesma linha de `projects`, nascida só com o
-- nome, e marcada para ficar fora do módulo Projetos, do portfólio e dos seletores de projeto: ele é uma
-- página de trabalho, e não um projeto entregue a alguém. Ser a mesma linha é o que deixa etapas, contadores,
-- endereço `/tarefas/<slug>` e referência da tarefa funcionarem sem uma segunda estrutura paralela.
--
-- Atrelar é levar o que o quadro tem para um projeto de verdade e apagar o quadro, numa escrita só.

alter table public.projects
  add column board_only boolean not null default false;

comment on column public.projects.board_only is
  'Quadro avulso de Tarefas: criado só com o nome, fora de Projetos, portfólio e seletores, até ser atrelado a um projeto.';

create index projects_board_only_idx on public.projects (organization_id) where board_only;

-- `security definer` porque o apontamento de tempo só é legível pelo dono de cada linha, e o de todo mundo
-- precisa ir junto para o projeto, senão a cascata do quadro apagado levaria as horas dos colegas.
create or replace function public.attach_task_board(p_board uuid, p_project uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization uuid;
  v_board_only boolean;
  v_last smallint;
begin
  select organization_id, board_only into v_organization, v_board_only from public.projects where id = p_board;
  if v_organization is null then
    raise exception 'Quadro não encontrado';
  end if;

  if not v_board_only then
    raise exception 'Este quadro já é um projeto';
  end if;

  if not public.can_write(v_organization) then
    raise exception 'Sem permissão para mexer neste quadro';
  end if;

  if p_project = p_board or not exists (
    select 1 from public.projects where id = p_project and organization_id = v_organization and not board_only
  ) then
    raise exception 'Escolha um projeto desta equipe';
  end if;

  -- O projeto que escolheu colunas passa a oferecer as que as tarefas do quadro usam, no fim da fila, senão
  -- elas cairiam numa etapa que o quadro dele não desenha e o gatilho recusaria a mudança.
  if exists (select 1 from public.project_stages where project_id = p_project) then
    select coalesce(max(position), -1) into v_last from public.project_stages where project_id = p_project;

    insert into public.project_stages (project_id, stage_id, organization_id, position)
    select p_project, used.stage_id, v_organization, v_last + row_number() over (order by used.first_position)
    from (
      select t.stage_id, min(coalesce(ps.position, 32767)) as first_position
      from public.tasks t
      left join public.project_stages ps on ps.project_id = p_board and ps.stage_id = t.stage_id
      where t.project_id = p_board and t.stage_id is not null
      group by t.stage_id
    ) used
    where not exists (
      select 1 from public.project_stages ps where ps.project_id = p_project and ps.stage_id = used.stage_id
    );
  end if;

  update public.tasks set project_id = p_project where project_id = p_board;
  update public.time_entries set project_id = p_project where project_id = p_board;
  update public.task_links set linked_project_id = p_project where linked_project_id = p_board;

  delete from public.projects where id = p_board;
end;
$$;

revoke execute on function public.attach_task_board(uuid, uuid) from public, anon;
grant execute on function public.attach_task_board(uuid, uuid) to authenticated;
