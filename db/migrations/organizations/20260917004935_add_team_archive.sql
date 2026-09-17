-- Arquivar uma equipe, no lugar de excluí-la (2026-09-16, a pedido). Ela sai da lista de quem participa e
-- ninguém entra nela, mas nada é apagado: cliente, projeto, contrato e cobrança continuam onde estão, e
-- desarquivar traz tudo de volta. Excluir de verdade uma organização derruba a base inteira dela em cascata
-- e cancela assinatura; é outra decisão, e não esta.

alter table public.organizations
  add column if not exists archived_at timestamptz;

comment on column public.organizations.archived_at is
  'Quando a equipe foi arquivada. Nula é ativa. Arquivada some da lista e não pode ser aberta.';

-- Quem troca de organização é esta função, e é aqui que a porta fecha: sem isso a equipe sumia da lista mas
-- continuava alcançável por quem tivesse o id, que é o contrário do que arquivar quer dizer.
create or replace function public.set_current_org(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_member(p_organization_id) then
    raise exception 'Sem acesso a esta organização';
  end if;

  if exists (
    select 1 from public.organizations
    where id = p_organization_id and archived_at is not null
  ) then
    raise exception 'Esta equipe está arquivada';
  end if;

  update public.profiles
  set current_organization_id = p_organization_id
  where id = (select auth.uid());
end;
$$;

-- Arquivar e desarquivar num lugar só, e só para quem é dono: a policy de update da tabela abre para owner
-- e admin, o que vale para trocar o nome, mas tirar a equipe do ar é decisão de quem responde por ela.
create or replace function public.set_organization_archived(p_organization_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(p_organization_id, array['owner']::public.member_role[]) then
    raise exception 'Só quem é dono da equipe pode arquivar';
  end if;

  update public.organizations
  set archived_at = case when p_archived then now() else null end
  where id = p_organization_id;

  -- Quem estava dentro dela não pode ficar: o perfil solta a equipe em vigor e a aplicação escolhe a
  -- próxima, ou manda para o começo quando não sobra nenhuma.
  if p_archived then
    update public.profiles
    set current_organization_id = null
    where current_organization_id = p_organization_id;
  end if;
end;
$$;

revoke execute on function public.set_organization_archived(uuid, boolean) from public, anon;
grant execute on function public.set_organization_archived(uuid, boolean) to authenticated;
