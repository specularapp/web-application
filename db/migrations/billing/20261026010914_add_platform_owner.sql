-- Quem é dono do próprio Specular usa tudo sem assinar. A lista é por e-mail, e não por id, para valer
-- também para uma conta criada depois desta migração; o e-mail só conta confirmado, senão bastaria
-- cadastrar o endereço de outra pessoa para herdar o acesso.
--
-- O acesso vale de dois jeitos: na sessão da própria conta, em qualquer time de que ela participe, e no
-- time de que ela é dona, para quem ela convida não esbarrar em limite ao aceitar o convite.
create table public.platform_owners (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

alter table public.platform_owners enable row level security;

insert into public.platform_owners (email)
values ('alephsramosdev@gmail.com')
on conflict (email) do nothing;

create or replace function public.platform_unlocked(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_owners p
    join auth.users u on lower(u.email) = p.email and u.email_confirmed_at is not null
    where u.id = (select auth.uid())
       or exists (
         select 1
         from public.organization_members m
         where m.organization_id = p_organization_id
           and m.user_id = u.id
           and m.role = 'owner'
       )
  );
$$;

create or replace function public.organization_plan(p_organization_id uuid)
returns public.billing_plan
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plan public.billing_plan;
begin
  if (select auth.uid()) is not null and not public.is_member(p_organization_id) then
    raise exception 'Sem acesso a esta organização' using errcode = '42501';
  end if;

  if public.platform_unlocked(p_organization_id) then
    return 'alliance'::public.billing_plan;
  end if;

  select s.plan into v_plan
  from public.organization_subscriptions s
  where s.organization_id = p_organization_id
    and s.status in ('trialing', 'active', 'past_due');

  return coalesce(v_plan, 'free'::public.billing_plan);
end;
$$;

-- O plano de cada time da troca numa ida só, pela mesma regra de `organization_plan`.
create or replace function public.organization_plans(p_organization_ids uuid[])
returns table (organization_id uuid, plan public.billing_plan)
language sql
stable
security definer
set search_path = ''
as $$
  select id, public.organization_plan(id)
  from unnest(p_organization_ids) as id
  where public.is_member(id);
$$;

revoke execute on function public.platform_unlocked(uuid) from public, anon, authenticated;
revoke execute on function public.organization_plans(uuid[]) from public, anon;
grant execute on function public.organization_plans(uuid[]) to authenticated;
