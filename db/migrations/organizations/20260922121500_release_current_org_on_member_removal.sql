-- Quem sai de uma equipe não pode continuar com ela como equipe em vigor (2026-09-22, na varredura).
-- Remover alguém apagava só a linha de `organization_members`, e o perfil seguia apontando para a equipe
-- perdida: a RLS passava a devolver vazio em tudo, o painel, os projetos, os clientes e as cobranças abriam
-- sem nada, a página da equipe dizia que a pessoa não está em nenhuma, e a outra equipe de que ela participa
-- só voltava se ela percebesse e trocasse na mão pelo seletor.
--
-- A limpeza é a mesma que `set_organization_archived` já faz quando a equipe inteira sai do ar. Fica no
-- banco, e não na aplicação, por dois motivos: a policy `profiles_update_own` só deixa a pessoa mexer no
-- próprio perfil, então quem remove nunca conseguiria limpar o perfil de quem foi removido; e como gatilho
-- a regra vale para toda porta de uma vez, a tela, a API do aplicativo e a remoção feita à mão no banco.
--
-- Qual equipe entra no lugar é decisão da aplicação: com o campo nulo, `organizationOf` cai na associação
-- mais antiga que sobrou, e quem não tem nenhuma recebe a configuração inicial por cima do painel.
create or replace function public.release_current_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set current_organization_id = null
  where id = old.user_id and current_organization_id = old.organization_id;

  return old;
end;
$$;

drop trigger if exists organization_members_release_current_org on public.organization_members;

create trigger organization_members_release_current_org
  after delete on public.organization_members
  for each row execute function public.release_current_org();
