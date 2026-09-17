-- O menu conta tarefa em aberto por projeto e oportunidade em aberto por funil, e ele é desenhado em toda
-- navegação. Contar isso carregando as linhas custa a base inteira por página vista: com mil tarefas são mil
-- linhas por clique, e o número que a tela usa é só um inteiro por projeto.
--
-- Estas duas funções devolvem a contagem já agrupada, uma ida ao banco cada, com a RLS valendo por dentro
-- (`is_member` na condição). O índice parcial ao lado é o que faz a contagem não varrer o que já fechou.

create index if not exists tasks_open_by_project_idx
  on public.tasks (organization_id, project_id)
  where stage <> 'done';

create index if not exists opportunities_open_by_funnel_idx
  on public.opportunities (organization_id, funnel_id)
  where stage not in ('won', 'lost');

create or replace function public.task_open_counts(p_organization_id uuid)
returns table (project_id uuid, total integer)
language sql
stable
security definer
set search_path = ''
as $$
  select t.project_id, count(*)::integer
  from public.tasks t
  where t.organization_id = p_organization_id
    and t.stage <> 'done'
    and public.is_member(p_organization_id)
  group by t.project_id;
$$;

create or replace function public.opportunity_open_counts(p_organization_id uuid)
returns table (funnel_id uuid, total integer)
language sql
stable
security definer
set search_path = ''
as $$
  select o.funnel_id, count(*)::integer
  from public.opportunities o
  where o.organization_id = p_organization_id
    and o.stage not in ('won', 'lost')
    and public.is_member(p_organization_id)
  group by o.funnel_id;
$$;

revoke execute on function public.task_open_counts(uuid) from public, anon;
revoke execute on function public.opportunity_open_counts(uuid) from public, anon;

grant execute on function public.task_open_counts(uuid) to authenticated;
grant execute on function public.opportunity_open_counts(uuid) to authenticated;

-- O que o cartão de aviso do menu procura: a parcela em aberto que vence antes, a entrega mais próxima e a
-- tarefa no prazo. Sem estes índices cada abertura de página varre a tabela para achar três linhas.
create index if not exists projects_open_due_idx
  on public.projects (organization_id, due_at)
  where status in ('active', 'paused') and due_at is not null;

create index if not exists tasks_open_due_idx
  on public.tasks (organization_id, due_date)
  where stage <> 'done';

-- A listagem de contratos e a de cobranças abrem pela data, já filtradas por organização.
create index if not exists contracts_org_created_idx on public.contracts (organization_id, created_at desc);
create index if not exists charges_org_created_idx on public.charges (organization_id, created_at desc);
