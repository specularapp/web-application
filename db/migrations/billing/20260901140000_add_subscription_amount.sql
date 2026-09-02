-- A tela mostrava o valor pelo catálogo de `plans.ts`, e não pelo preço que a assinatura carrega.
-- Depois de uma rotação de preço (o `stripe:sync` cria preço novo e desativa o antigo, de propósito,
-- para assinatura em vigor continuar no que foi assinada) os dois divergem e a tela mente. Guardar o
-- valor cobrado na linha não é uma terceira fonte de verdade: é registro do que o Stripe cobrou.
alter table public.organization_subscriptions
  add column amount_cents integer check (amount_cents is null or amount_cents >= 0),
  add column currency text check (currency is null or (currency = lower(currency) and char_length(currency) = 3));

-- `create or replace` com número diferente de argumentos criaria sobrecarga em vez de substituir, e
-- o `rpc` do cliente ficaria ambíguo. Derruba a assinatura antiga primeiro.
drop function if exists public.sync_subscription(
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
);

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
    payment_brand = coalesce(excluded.payment_brand, organization_subscriptions.payment_brand),
    payment_last4 = coalesce(excluded.payment_last4, organization_subscriptions.payment_last4),
    amount_cents = excluded.amount_cents,
    currency = excluded.currency;

  if p_trial_start is not null and p_trial_end is not null then
    insert into public.billing_trials (organization_id, plan, started_at, ends_at)
    values (p_organization_id, p_plan, p_trial_start, p_trial_end)
    on conflict (organization_id, plan) do nothing;
  end if;
end;
$$;

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
  text,
  integer,
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
  text,
  integer,
  text
) to service_role;
