-- Reprodução com sessão real: `insert` em organizations devolve 42501 "new row violates row-level
-- security policy", tanto deixando o default `auth.uid()` preencher `created_by` quanto mandando o
-- id do próprio usuário na mão. O `select` em profiles pela mesma sessão funciona, então `auth.uid()`
-- responde e o problema é a policy em si, que o remoto não tem como o repositório descreve.
-- Recriar é idempotente e devolve o estado que a migração de 2026-08-27 previa.
drop policy if exists organizations_select on public.organizations;
drop policy if exists organizations_insert on public.organizations;
drop policy if exists organizations_update on public.organizations;
drop policy if exists organizations_delete on public.organizations;

create policy organizations_select on public.organizations
  for select to authenticated
  using (public.is_member(id));

create policy organizations_insert on public.organizations
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy organizations_update on public.organizations
  for update to authenticated
  using (public.has_role(id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_role(id, array['owner', 'admin']::public.member_role[]));

create policy organizations_delete on public.organizations
  for delete to authenticated
  using (public.has_role(id, array['owner']::public.member_role[]));
