-- Causa real do 42501 ao criar time, medida com sessão de verdade: o insert passa no WITH CHECK, e
-- quem barra é o RETURNING. O Postgres aplica a policy de select nas linhas devolvidas por
-- `insert ... returning`, e a associação que torna a linha visível (`is_member`) só nasce no trigger
-- AFTER INSERT, que roda depois do RETURNING ser materializado. Sem retorno o insert sempre funcionou.
-- Quem criou enxerga o próprio time nesse instante, o que também protege cliente que fale direto com
-- a API, como o aplicativo, sem depender de o código evitar o RETURNING.
drop policy if exists organizations_select on public.organizations;

create policy organizations_select on public.organizations
  for select to authenticated
  using (public.is_member(id) or created_by = (select auth.uid()));
