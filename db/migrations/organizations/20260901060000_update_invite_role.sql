-- A ação de cancelar convite passou para dentro do dropdown de papel, então o gatilho não pode mais
-- ficar desabilitado nas linhas de convite. Sem policy de update, trocar o papel ali seria mentira
-- visual: mudava na tela e não no banco.
create policy organization_invites_update on public.organization_invites
  for update to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]))
  with check (
    public.has_role(organization_id, array['owner', 'admin']::public.member_role[])
    and role <> 'owner'
    and accepted_at is null
  );
