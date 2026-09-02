-- Cobrança e permissão por plano. O catálogo (planos, ciclos, recursos) é global; assinatura, teste
-- gratuito e eventos são por organização. Dinheiro fica no Stripe e texto de vitrine fica em
-- `features/billing/plans.ts`; aqui mora só o vínculo com o Stripe e quem pode o quê.
create type public.billing_plan as enum ('free', 'pro', 'alliance');
create type public.billing_cycle as enum ('monthly', 'yearly');

-- Espelha os status de assinatura do Stripe, sem inventar nenhum.
create type public.subscription_status as enum (
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused'
);

-- 'flag' liga ou desliga um recurso; 'limit' guarda um teto numérico.
create type public.plan_feature_kind as enum ('flag', 'limit');

create table public.billing_plans (
  code public.billing_plan primary key,
  name text not null check (char_length(name) between 2 and 60),
  tier smallint not null unique check (tier >= 0),
  trial_days smallint not null default 0 check (trial_days between 0 and 90),
  trial_requires_payment_method boolean not null default true,
  is_paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mapa plano + ciclo para o preço do Stripe. O valor cobrado vive no Stripe, nunca aqui: uma terceira
-- cópia do dinheiro só cria divergência. Preço trocado desativa a linha e entra outra, então o
-- histórico fica; a única linha ativa por plano e ciclo é garantida por índice parcial.
create table public.billing_prices (
  plan public.billing_plan not null references public.billing_plans (code) on delete cascade,
  cycle public.billing_cycle not null,
  stripe_price_id text not null check (stripe_price_id ~ '^price_[A-Za-z0-9]+$'),
  currency text not null default 'brl' check (currency = lower(currency) and char_length(currency) = 3),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan, cycle, stripe_price_id)
);

create unique index billing_prices_stripe_price_id_key on public.billing_prices (stripe_price_id);
create unique index billing_prices_active_key on public.billing_prices (plan, cycle) where active;

-- Catálogo de recursos que o plano libera. Nasce vazio de propósito: cada condição entra junto com a
-- tela que a exige, nunca antes.
create table public.plan_features (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$' and char_length(key) between 3 and 60),
  kind public.plan_feature_kind not null,
  name text not null check (char_length(name) between 2 and 80),
  description text check (description is null or char_length(description) <= 400),
  created_at timestamptz not null default now()
);

-- A permissão em si: um recurso por plano. Em 'limit', `limit_value` nulo com `enabled` verdadeiro
-- significa ilimitado, e a falta da linha significa negado.
create table public.plan_entitlements (
  plan public.billing_plan not null references public.billing_plans (code) on delete cascade,
  feature_key text not null references public.plan_features (key) on delete cascade,
  enabled boolean not null default false,
  limit_value integer check (limit_value is null or limit_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan, feature_key)
);

create index plan_entitlements_feature_key_idx on public.plan_entitlements (feature_key);

create table public.organization_subscriptions (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  plan public.billing_plan not null default 'free' references public.billing_plans (code),
  cycle public.billing_cycle,
  status public.subscription_status not null default 'active',
  stripe_customer_id text unique check (stripe_customer_id is null or stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  stripe_subscription_id text unique check (stripe_subscription_id is null or stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  stripe_price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  payment_brand text check (payment_brand is null or char_length(payment_brand) <= 40),
  payment_last4 text check (payment_last4 is null or payment_last4 ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Teste gratuito é uma vez por organização e por plano. Guardar o consumo aqui, e não numa coluna da
-- assinatura, deixa a regra valer mesmo depois de cancelar e assinar de novo.
create table public.billing_trials (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plan public.billing_plan not null references public.billing_plans (code) on delete cascade,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  primary key (organization_id, plan)
);

-- Idempotência do webhook: o id do evento do Stripe é a chave, então reentrega não processa de novo.
create table public.billing_events (
  id text primary key check (char_length(id) between 3 and 120),
  type text not null check (char_length(type) between 3 and 120),
  organization_id uuid references public.organizations (id) on delete set null,
  payload jsonb,
  received_at timestamptz not null default now()
);

create index billing_events_received_at_idx on public.billing_events (received_at desc);
create index billing_events_organization_id_idx on public.billing_events (organization_id);

alter table public.billing_plans enable row level security;
alter table public.billing_prices enable row level security;
alter table public.plan_features enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.billing_trials enable row level security;
alter table public.billing_events enable row level security;

create trigger billing_plans_set_updated_at
  before update on public.billing_plans
  for each row execute function public.set_updated_at();

create trigger billing_prices_set_updated_at
  before update on public.billing_prices
  for each row execute function public.set_updated_at();

create trigger plan_entitlements_set_updated_at
  before update on public.plan_entitlements
  for each row execute function public.set_updated_at();

create trigger organization_subscriptions_set_updated_at
  before update on public.organization_subscriptions
  for each row execute function public.set_updated_at();
