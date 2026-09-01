-- O revoke de `public` e `anon` das migrações anteriores conta com o default privilege do Supabase
-- para manter `authenticated` executando. Isso é suposição sobre configuração de fora do repositório:
-- se ela mudar, a lista de membros volta vazia e o convite falha sem erro visível. O grant explícito
-- fecha a dúvida e continua deixando `anon` de fora, como a regra de banco pede.
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.has_role(uuid, public.member_role[]) to authenticated;
grant execute on function public.shares_org_with(uuid) to authenticated;
grant execute on function public.current_org() to authenticated;
grant execute on function public.mfa_satisfied() to authenticated;
grant execute on function public.set_current_org(uuid) to authenticated;
grant execute on function public.create_invite(uuid, text, text, public.member_role) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.team_members(uuid) to authenticated;
grant execute on function public.complete_onboarding(uuid) to authenticated;
grant execute on function public.can_manage_logo(text) to authenticated;
