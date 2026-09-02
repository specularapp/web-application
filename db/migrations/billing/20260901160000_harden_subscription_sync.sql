-- Três buracos achados na revisão adversarial da própria cobrança, todos no caminho do webhook.
--
-- 1. Evento de assinatura antiga sobrescrevia a linha e derrubava time pagante para o gratuito. Ficou
--    provável quando o serviço passou a cancelar tentativa incompleta antes de criar a nova: o cancel
--    dispara evento da assinatura velha, que pode chegar depois dos eventos da nova.
-- 2. `organization_plan` e `trial_available` são `security definer` e abertas a `authenticated`, e
--    aceitavam qualquer `organization_id`: dava para descobrir o plano e o uso de teste de outro time.
--    A guarda só vale quando há sessão, senão o webhook (chave secreta, sem `auth.uid()`) se barraria.
-- 3. Excluir organização levava a linha da assinatura por cascade e deixava a assinatura cobrando no
--    Stripe para sempre, sem nenhum vínculo para achá-la.
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
  p_payment_last4 text default null,
  p_amount_cents integer default null,
  p_currency text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_subscription text;
  v_current_status public.subscription_status;
begin
  select s.stripe_subscription_id, s.status
  into v_current_subscription, v_current_status
  from public.organization_subscriptions s
  where s.organization_id = p_organization_id;

  -- Assinatura em vigor não é sobrescrita por evento de outra assinatura. Linha vazia, mesma
  -- assinatura, ou assinatura já encerrada continuam aceitando a escrita.
  if v_current_subscription is not null
     and v_current_subscription is distinct from p_stripe_subscription_id
     and v_current_status not in ('canceled', 'incomplete', 'incomplete_expired')
  then
    return;
  end if;

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
    payment_last4,
    amount_cents,
    currency
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
    p_payment_last4,
    p_amount_cents,
    p_currency
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
    -- Sem coalesce: cartão removido no Stripe precisa apagar da tela, senão fica cartão fantasma.
    payment_brand = excluded.payment_brand,
    payment_last4 = excluded.payment_last4,
    amount_cents = excluded.amount_cents,
    currency = excluded.currency;

  if p_trial_start is not null and p_trial_end is not null then
    insert into public.billing_trials (organization_id, plan, started_at, ends_at)
    values (p_organization_id, p_plan, p_trial_start, p_trial_end)
    on conflict (organization_id, plan) do nothing;
  end if;
end;
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
  -- Sem sessão é o servidor falando pela chave secreta (webhook), que precisa ler qualquer organização.
  if (select auth.uid()) is not null and not public.is_member(p_organization_id) then
    raise exception 'Sem acesso a esta organização' using errcode = '42501';
  end if;

  select s.plan into v_plan
  from public.organization_subscriptions s
  where s.organization_id = p_organization_id
    and s.status in ('trialing', 'active', 'past_due');

  return coalesce(v_plan, 'free'::public.billing_plan);
end;
$$;

create or replace function public.trial_available(p_organization_id uuid, p_plan public.billing_plan)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.is_member(p_organization_id) then
    raise exception 'Sem acesso a esta organização' using errcode = '42501';
  end if;

  return coalesce((select p.trial_days from public.billing_plans p where p.code = p_plan), 0) > 0
     and not exists (
       select 1
       from public.billing_trials t
       where t.organization_id = p_organization_id and t.plan = p_plan
     );
end;
$$;

create or replace function public.protect_billed_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.organization_subscriptions s
    where s.organization_id = old.id
      and s.stripe_subscription_id is not null
      and s.status in ('trialing', 'active', 'past_due', 'unpaid', 'paused')
  ) then
    raise exception 'Cancele a assinatura antes de excluir esta organização';
  end if;

  return old;
end;
$$;

create trigger organizations_protect_billed
  before delete on public.organizations
  for each row execute function public.protect_billed_organization();

revoke execute on function public.protect_billed_organization() from public, anon;
