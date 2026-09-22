-- Os contadores do menu depois de a etapa virar tabela (2026-09-21, na mesma rodada).
--
-- `tasks.stage` era um enum na própria linha, então "em aberto" cabia num índice parcial
-- (`where stage <> 'done'`) e numa comparação direta. Com a etapa em outra tabela, quem sabe se ela fecha a
-- tarefa é `task_stages.kind`, e índice parcial não enxerga a linha do outro lado. Os dois índices caíram
-- junto com a coluna e a função de contagem ficou apontando para o que não existe mais.
--
-- A contagem passa a juntar as duas tabelas pela chave, que é junção por chave primária, e os índices ficam
-- sobre as colunas que a consulta filtra. Denormalizar o `kind` de volta para dentro de `tasks` resolveria o
-- índice parcial, mas criaria um segundo lugar para a mesma verdade, mantido por gatilho, e é exatamente o
-- que o modelo antigo fazia de errado.

create index if not exists tasks_project_stage_lookup_idx
  on public.tasks (organization_id, project_id, stage_id);

create index if not exists tasks_due_stage_idx
  on public.tasks (organization_id, due_date, stage_id);

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
    and public.is_member(p_organization_id)
  group by t.project_id;
$$;

revoke execute on function public.task_open_counts(uuid) from public, anon;
grant execute on function public.task_open_counts(uuid) to authenticated;
