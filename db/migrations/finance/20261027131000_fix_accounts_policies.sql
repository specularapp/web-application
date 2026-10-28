-- Correção das policies de contas e categorias (2026-10-27): a de escrita era `for all`, então valia também na
-- leitura, e chamava `mfa_satisfied()` direto, que lê `auth.mfa_factors` com a permissão de quem consulta e
-- respondia "permission denied". O resto da casa passa por `can_write`, que roda como dono da função; aqui a
-- escrita volta a ser só escrita e o fator duplo passa pelo mesmo caminho.

drop policy finance_accounts_write on public.finance_accounts;
drop policy finance_categories_write on public.finance_categories;

create policy finance_accounts_insert on public.finance_accounts
  for insert to authenticated
  with check (public.can_write(organization_id) and public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));
create policy finance_accounts_update on public.finance_accounts
  for update to authenticated
  using (public.can_write(organization_id) and public.has_role(organization_id, array['owner', 'admin']::public.member_role[]))
  with check (public.can_write(organization_id) and public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));
create policy finance_accounts_delete on public.finance_accounts
  for delete to authenticated
  using (public.can_write(organization_id) and public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

create policy finance_categories_insert on public.finance_categories
  for insert to authenticated
  with check (public.can_write(organization_id) and public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));
create policy finance_categories_update on public.finance_categories
  for update to authenticated
  using (public.can_write(organization_id) and public.has_role(organization_id, array['owner', 'admin']::public.member_role[]))
  with check (public.can_write(organization_id) and public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));
create policy finance_categories_delete on public.finance_categories
  for delete to authenticated
  using (public.can_write(organization_id) and public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));
