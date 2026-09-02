-- Plano em vigor de uma organização. Um único lugar decide quais status dão direito ao plano pago:
-- em teste, em dia e em atraso (a tolerância que o Stripe abre antes de cancelar). Qualquer outro
-- status cai para o gratuito, então cancelar, expirar ou não pagar tira o acesso sem nenhum outro
-- código precisar saber disso.
create or replace function public.organization_plan(p_organization_id uuid)
returns public.billing_plan
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select s.plan
      from public.organization_subscriptions s
      where s.organization_id = p_organization_id
        and s.status in ('trialing', 'active', 'past_due')
    ),
    'free'::public.billing_plan
  );
$$;

create or replace function public.current_plan()
returns public.billing_plan
language sql
stable
security definer
set search_path = ''
as $$
  select public.organization_plan(public.current_org());
$$;

create or replace function public.plan_tier(p_plan public.billing_plan)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select p.tier from public.billing_plans p where p.code = p_plan;
$$;

-- Comparação por degrau, para regra que vale "do Pro para cima" sem listar plano por plano.
create or replace function public.plan_at_least(p_organization_id uuid, p_plan public.billing_plan)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.plan_tier(public.organization_plan(p_organization_id)), 0)
       >= coalesce(public.plan_tier(p_plan), 0);
$$;

-- Recurso fora do catálogo é erro de programação, não permissão negada: falhar alto aparece no
-- primeiro teste, enquanto devolver falso ou verdadeiro esconderia a chave escrita errada.
create or replace function public.plan_feature_kind_of(p_feature_key text)
returns public.plan_feature_kind
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_kind public.plan_feature_kind;
begin
  select f.kind into v_kind from public.plan_features f where f.key = p_feature_key;

  if v_kind is null then
    raise exception 'Recurso de plano desconhecido: %', p_feature_key using errcode = '22023';
  end if;

  return v_kind;
end;
$$;

-- Negado por padrão: sem linha em `plan_entitlements`, o plano não libera o recurso.
create or replace function public.plan_allows(p_organization_id uuid, p_feature_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.plan_feature_kind_of(p_feature_key);

  return coalesce(
    (
      select e.enabled
      from public.plan_entitlements e
      where e.plan = public.organization_plan(p_organization_id)
        and e.feature_key = p_feature_key
    ),
    false
  );
end;
$$;

-- Teto do recurso: zero quando o plano não libera, nulo quando libera sem limite.
create or replace function public.plan_limit(p_organization_id uuid, p_feature_key text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_enabled boolean;
  v_limit integer;
begin
  if public.plan_feature_kind_of(p_feature_key) <> 'limit' then
    raise exception 'O recurso % não é de limite', p_feature_key using errcode = '22023';
  end if;

  select e.enabled, e.limit_value
  into v_enabled, v_limit
  from public.plan_entitlements e
  where e.plan = public.organization_plan(p_organization_id)
    and e.feature_key = p_feature_key;

  if not found or not v_enabled then
    return 0;
  end if;

  return v_limit;
end;
$$;

-- `p_count` é quanto já existe, então a comparação responde "cabe um mais?".
create or replace function public.plan_within_limit(
  p_organization_id uuid,
  p_feature_key text,
  p_count integer
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := public.plan_limit(p_organization_id, p_feature_key);
begin
  if v_limit is null then
    return true;
  end if;

  return coalesce(p_count, 0) < v_limit;
end;
$$;

create or replace function public.trial_available(p_organization_id uuid, p_plan public.billing_plan)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.trial_days from public.billing_plans p where p.code = p_plan), 0) > 0
     and not exists (
       select 1
       from public.billing_trials t
       where t.organization_id = p_organization_id and t.plan = p_plan
     );
$$;

-- Quem mexe em cobrança é quem manda no time, o mesmo par que já edita a organização e convida gente.
create or replace function public.can_manage_billing(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(p_organization_id, array['owner', 'admin']::public.member_role[]);
$$;

-- Coerência entre o tipo do recurso e a linha de permissão: recurso de liga e desliga não carrega teto.
create or replace function public.check_plan_entitlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.plan_feature_kind_of(new.feature_key) = 'flag' and new.limit_value is not null then
    raise exception 'Recurso % é liga e desliga e não aceita limite', new.feature_key using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger plan_entitlements_check
  before insert or update on public.plan_entitlements
  for each row execute function public.check_plan_entitlement();

-- Organização nova nasce no gratuito com linha própria, para a tela de plano ler um estado explícito
-- em vez de deduzir do vazio.
create or replace function public.handle_new_organization_billing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organization_subscriptions (organization_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (organization_id) do nothing;

  return new;
end;
$$;

create trigger on_organization_created_billing
  after insert on public.organizations
  for each row execute function public.handle_new_organization_billing();

-- Vincula o cliente do Stripe à organização. Só owner e admin, e nunca troca um cliente já vinculado:
-- sobrescrever apontaria a cobrança da organização para outra conta do Stripe. Devolve o vínculo que
-- ficou valendo, então quem chamou descobre que já existia um e reaproveita.
create or replace function public.attach_billing_customer(
  p_organization_id uuid,
  p_stripe_customer_id text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer text;
begin
  if not public.can_manage_billing(p_organization_id) then
    raise exception 'Sem permissão para gerenciar a cobrança desta organização';
  end if;

  if p_stripe_customer_id is null or p_stripe_customer_id !~ '^cus_[A-Za-z0-9]+$' then
    raise exception 'Cliente do Stripe inválido';
  end if;

  insert into public.organization_subscriptions (organization_id, stripe_customer_id)
  values (p_organization_id, p_stripe_customer_id)
  on conflict (organization_id) do update
    set stripe_customer_id = coalesce(
      organization_subscriptions.stripe_customer_id,
      excluded.stripe_customer_id
    )
  returning stripe_customer_id into v_customer;

  return v_customer;
end;
$$;

-- Verdade do Stripe entrando no banco, sempre pela chave secreta do servidor. O teste gratuito é
-- registrado no mesmo passo, então cancelar e assinar de novo não devolve um segundo período grátis.
create or replace function public.sync_subscription(
  p_organization_id uuid,
  p_plan public.billing_plan,
  p_cycle public.billing_cycle,
  p_status public.subscription_status,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_stripe_price_id text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_canceled_at timestamptz,
  p_trial_start timestamptz,
  p_trial_end timestamptz,
  p_payment_brand text default null,
  p_payment_last4 text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organization_subscriptions (
    organization_id,
    plan,
    cycle,
    status,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_price_id,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    canceled_at,
    trial_start,
    trial_end,
    payment_brand,
    payment_last4
  )
  values (
    p_organization_id,
    p_plan,
    p_cycle,
    p_status,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_stripe_price_id,
    p_current_period_start,
    p_current_period_end,
    coalesce(p_cancel_at_period_end, false),
    p_canceled_at,
    p_trial_start,
    p_trial_end,
    p_payment_brand,
    p_payment_last4
  )
  on conflict (organization_id) do update set
    plan = excluded.plan,
    cycle = excluded.cycle,
    status = excluded.status,
    stripe_customer_id = coalesce(excluded.stripe_customer_id, organization_subscriptions.stripe_customer_id),
    stripe_subscription_id = excluded.stripe_subscription_id,
    stripe_price_id = excluded.stripe_price_id,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    canceled_at = excluded.canceled_at,
    trial_start = excluded.trial_start,
    trial_end = excluded.trial_end,
    payment_brand = coalesce(excluded.payment_brand, organization_subscriptions.payment_brand),
    payment_last4 = coalesce(excluded.payment_last4, organization_subscriptions.payment_last4);

  if p_trial_start is not null and p_trial_end is not null then
    insert into public.billing_trials (organization_id, plan, started_at, ends_at)
    values (p_organization_id, p_plan, p_trial_start, p_trial_end)
    on conflict (organization_id, plan) do nothing;
  end if;
end;
$$;

-- Backfill: quem já existe entra no gratuito com linha própria, igual às organizações novas.
insert into public.organization_subscriptions (organization_id, plan, status)
select o.id, 'free', 'active'
from public.organizations o
on conflict (organization_id) do nothing;

revoke execute on function public.organization_plan(uuid) from public, anon;
revoke execute on function public.current_plan() from public, anon;
revoke execute on function public.plan_tier(public.billing_plan) from public, anon;
revoke execute on function public.plan_at_least(uuid, public.billing_plan) from public, anon;
revoke execute on function public.plan_feature_kind_of(text) from public, anon;
revoke execute on function public.plan_allows(uuid, text) from public, anon;
revoke execute on function public.plan_limit(uuid, text) from public, anon;
revoke execute on function public.plan_within_limit(uuid, text, integer) from public, anon;
revoke execute on function public.trial_available(uuid, public.billing_plan) from public, anon;
revoke execute on function public.can_manage_billing(uuid) from public, anon;
revoke execute on function public.attach_billing_customer(uuid, text) from public, anon;
revoke execute on function public.check_plan_entitlement() from public, anon;
revoke execute on function public.handle_new_organization_billing() from public, anon;

grant execute on function public.organization_plan(uuid) to authenticated;
grant execute on function public.current_plan() to authenticated;
grant execute on function public.plan_tier(public.billing_plan) to authenticated;
grant execute on function public.plan_at_least(uuid, public.billing_plan) to authenticated;
grant execute on function public.plan_feature_kind_of(text) to authenticated;
grant execute on function public.plan_allows(uuid, text) to authenticated;
grant execute on function public.plan_limit(uuid, text) to authenticated;
grant execute on function public.plan_within_limit(uuid, text, integer) to authenticated;
grant execute on function public.trial_available(uuid, public.billing_plan) to authenticated;
grant execute on function public.can_manage_billing(uuid) to authenticated;
grant execute on function public.attach_billing_customer(uuid, text) to authenticated;

-- O webhook fala com o banco pela chave secreta, e o revoke de `public` das migrações de segurança
-- tirou o execute implícito de todos os papéis, inclusive de `service_role`. Sem estes grants a
-- reconciliação do Stripe falharia em runtime, não na migração.
grant execute on function public.organization_plan(uuid) to service_role;
grant execute on function public.plan_tier(public.billing_plan) to service_role;
grant execute on function public.plan_at_least(uuid, public.billing_plan) to service_role;
grant execute on function public.plan_feature_kind_of(text) to service_role;
grant execute on function public.plan_allows(uuid, text) to service_role;
grant execute on function public.plan_limit(uuid, text) to service_role;
grant execute on function public.plan_within_limit(uuid, text, integer) to service_role;
grant execute on function public.trial_available(uuid, public.billing_plan) to service_role;

-- Escrever a verdade do Stripe é só do servidor: nem `authenticated` nem `anon` chegam aqui.
revoke execute on function public.sync_subscription(
  uuid,
  public.billing_plan,
  public.billing_cycle,
  public.subscription_status,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  boolean,
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.sync_subscription(
  uuid,
  public.billing_plan,
  public.billing_cycle,
  public.subscription_status,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  boolean,
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  text
) to service_role;
