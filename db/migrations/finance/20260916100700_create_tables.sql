-- Financeiro: a cobrança que a equipe manda ao cliente, em uma ou mais parcelas, e a movimentação que o
-- pagamento gera. A situação da cobrança não é gravada: sai das parcelas e da data de hoje, então uma
-- parcela que passou do vencimento vira vencida sozinha, sem ninguém rodar nada.

create type public.transaction_kind as enum ('income', 'expense', 'scheduled');
create type public.transaction_status as enum ('confirmed', 'pending', 'cancelled');
create type public.transaction_visual as enum ('person', 'brand');
create type public.charge_event_kind as enum (
  'created', 'sent', 'resent', 'viewed', 'reported', 'paid', 'reopened', 'cancelled'
);

-- O que havia em caixa antes de a base começar: sem isto, o saldo da equipe só contaria o que o sistema
-- viu, e a primeira tela do financeiro nasceria errada para quem já operava.
create table public.finance_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  opening_balance bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table public.charges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reference text not null,
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '' check (char_length(description) <= 300),
  client_id uuid references public.clients (id) on delete set null,
  client_name text not null check (char_length(client_name) between 2 and 80),
  client_company text check (public.text_len_ok(client_company, 1, 80)),
  client_email text check (client_email is null or (client_email = lower(client_email) and client_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(client_email) <= 120)),
  client_avatar_url text check (public.text_len_ok(client_avatar_url, 1, 500)),
  owner_id uuid references auth.users (id) on delete set null,
  amount bigint not null check (amount > 0 and amount <= 999999999999),
  method public.payment_method not null default 'pix',
  payment_info text not null default '' check (char_length(payment_info) <= 500),
  quote_id uuid references public.quotes (id) on delete set null,
  contract_id uuid references public.contracts (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  notes text not null default '' check (char_length(notes) <= 2000),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_version smallint not null default 1 check (token_version >= 1),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  viewed_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (organization_id, reference)
);

create index charges_organization_created_idx on public.charges (organization_id, created_at desc);
create index charges_client_idx on public.charges (client_id);
create index charges_quote_idx on public.charges (quote_id);
create index charges_search_idx on public.charges using gin (
  (coalesce(title, '') || ' ' || coalesce(client_name, '')) extensions.gin_trgm_ops
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reference text not null,
  kind public.transaction_kind not null,
  status public.transaction_status not null default 'confirmed',
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 300),
  -- Sempre positivo: o sinal sai de `kind`, e guardar negativo faria toda soma da tela ter de saber disso.
  amount bigint not null check (amount > 0 and amount <= 999999999999),
  date date not null,
  time time,
  method_type public.payment_method,
  method_label text check (public.text_len_ok(method_label, 1, 60)),
  visual_type public.transaction_visual,
  visual_name text check (public.text_len_ok(visual_name, 1, 60)),
  visual_avatar_url text check (public.text_len_ok(visual_avatar_url, 1, 500)),
  charge_id uuid references public.charges (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference),
  constraint transactions_method_pair check ((method_type is null) = (method_label is null))
);

create index transactions_organization_date_idx on public.transactions (organization_id, date desc);
create index transactions_organization_kind_idx on public.transactions (organization_id, kind, status);
create index transactions_charge_idx on public.transactions (charge_id);

create table public.charge_installments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  charge_id uuid not null references public.charges (id) on delete cascade,
  number smallint not null check (number >= 1),
  amount bigint not null check (amount > 0 and amount <= 999999999999),
  due_date date not null,
  paid_at timestamptz,
  paid_method public.payment_method,
  -- O cliente avisou pelo link que pagou, e a equipe ainda não confirmou: é um pedido de conferência, e
  -- nunca um pagamento, senão o caixa subiria com a palavra de quem deve.
  reported boolean not null default false,
  transaction_id uuid references public.transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (charge_id, number),
  constraint charge_installments_paid_pair check ((paid_at is null) = (paid_method is null))
);

create index charge_installments_charge_idx on public.charge_installments (charge_id, number);
create index charge_installments_due_idx on public.charge_installments (organization_id, due_date) where paid_at is null;

create table public.charge_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  charge_id uuid not null references public.charges (id) on delete cascade,
  kind public.charge_event_kind not null,
  actor text check (public.text_len_ok(actor, 1, 120)),
  detail text check (public.text_len_ok(detail, 1, 300)),
  at timestamptz not null default now()
);

create index charge_events_charge_idx on public.charge_events (charge_id, at desc);

alter table public.finance_settings enable row level security;
alter table public.charges enable row level security;
alter table public.charge_installments enable row level security;
alter table public.charge_events enable row level security;
alter table public.transactions enable row level security;

create policy finance_settings_select on public.finance_settings
  for select to authenticated using (public.is_member(organization_id));
create policy finance_settings_write on public.finance_settings
  for all to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

create policy charges_select on public.charges
  for select to authenticated using (public.is_member(organization_id));
create policy charges_insert on public.charges
  for insert to authenticated with check (public.can_write(organization_id));
create policy charges_update on public.charges
  for update to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));
create policy charges_delete on public.charges
  for delete to authenticated using (public.can_write(organization_id));

create policy charge_installments_select on public.charge_installments
  for select to authenticated using (public.is_member(organization_id));
create policy charge_installments_write on public.charge_installments
  for all to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));

create policy charge_events_select on public.charge_events
  for select to authenticated using (public.is_member(organization_id));
create policy charge_events_insert on public.charge_events
  for insert to authenticated with check (public.can_write(organization_id));

create policy transactions_select on public.transactions
  for select to authenticated using (public.is_member(organization_id));
create policy transactions_insert on public.transactions
  for insert to authenticated with check (public.can_write(organization_id));
create policy transactions_update on public.transactions
  for update to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));
create policy transactions_delete on public.transactions
  for delete to authenticated using (public.can_write(organization_id));

create trigger charges_client_same_organization
  before insert or update of client_id, organization_id on public.charges
  for each row execute function public.assert_same_organization('clients', 'client_id');

create trigger charges_quote_same_organization
  before insert or update of quote_id, organization_id on public.charges
  for each row execute function public.assert_same_organization('quotes', 'quote_id');

create trigger charges_contract_same_organization
  before insert or update of contract_id, organization_id on public.charges
  for each row execute function public.assert_same_organization('contracts', 'contract_id');

create trigger charges_project_same_organization
  before insert or update of project_id, organization_id on public.charges
  for each row execute function public.assert_same_organization('projects', 'project_id');

create trigger charge_installments_charge_same_organization
  before insert or update of charge_id, organization_id on public.charge_installments
  for each row execute function public.assert_same_organization('charges', 'charge_id');

create trigger charge_events_charge_same_organization
  before insert or update of charge_id, organization_id on public.charge_events
  for each row execute function public.assert_same_organization('charges', 'charge_id');

create trigger transactions_charge_same_organization
  before insert or update of charge_id, organization_id on public.transactions
  for each row execute function public.assert_same_organization('charges', 'charge_id');

create trigger charges_set_reference
  before insert on public.charges
  for each row execute function public.set_reference('invoice', 'COB');

create trigger transactions_set_reference
  before insert on public.transactions
  for each row execute function public.set_reference('transaction', 'TRX');

create trigger charges_set_updated_at
  before update on public.charges
  for each row execute function public.set_updated_at();

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

create trigger finance_settings_set_updated_at
  before update on public.finance_settings
  for each row execute function public.set_updated_at();

-- A soma das parcelas é o total da cobrança, e essa é a conta que a tela, o e-mail e o link mostram. Deixar
-- a checagem para quem escreve faria a primeira divisão com centavo sobrando sair do ar sem ninguém ver.
create or replace function public.assert_installments_match_charge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_charge_id uuid := coalesce(new.charge_id, old.charge_id);
  v_total bigint;
  v_amount bigint;
begin
  select coalesce(sum(amount), 0) into v_total
  from public.charge_installments where charge_id = v_charge_id;

  select amount into v_amount from public.charges where id = v_charge_id;

  if v_amount is null then
    return null;
  end if;

  if v_total <> v_amount then
    raise exception 'A soma das parcelas (%) não bate com o total da cobrança (%)', v_total, v_amount;
  end if;

  return null;
end;
$$;

-- Diferida: a cobrança e as parcelas nascem na mesma transação, e checar linha a linha derrubaria a
-- primeira parcela por ainda não ter a segunda.
create constraint trigger charge_installments_match_charge
  after insert or update or delete on public.charge_installments
  deferrable initially deferred
  for each row execute function public.assert_installments_match_charge();

-- A página pública da cobrança, pelo resumo do token: o que o cliente precisa para pagar e o estado de cada
-- parcela, sem nada da equipe além do que o link já mostra.
create or replace function public.charge_by_token(p_token_hash text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'charge', to_jsonb(c) - 'token_hash' - 'token_version' - 'notes',
    'installments', (
      select coalesce(jsonb_agg(to_jsonb(i) order by i.number), '[]'::jsonb)
      from public.charge_installments i where i.charge_id = c.id
    ),
    'issuer', jsonb_build_object('name', o.name, 'logoUrl', o.logo_url, 'email', o.email, 'phone', o.phone, 'city', o.city)
  )
  from public.charges c
  join public.organizations o on o.id = c.organization_id
  where c.token_hash = p_token_hash and c.sent_at is not null
  limit 1;
$$;

create or replace function public.mark_charge_viewed(p_token_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_charge public.charges%rowtype;
begin
  update public.charges
  set viewed_at = coalesce(viewed_at, now())
  where token_hash = p_token_hash and sent_at is not null and viewed_at is null
  returning * into v_charge;

  if found then
    insert into public.charge_events (organization_id, charge_id, kind, actor, detail)
    values (v_charge.organization_id, v_charge.id, 'viewed', v_charge.client_name, null);
  end if;
end;
$$;

-- "Já paguei" pelo link: marca a parcela como avisada, e só isso. Quem baixa o pagamento é a equipe, pela
-- action, que é o que mantém o caixa contando dinheiro conferido.
create or replace function public.report_installment_paid(p_token_hash text, p_installment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_charge public.charges%rowtype;
  v_number smallint;
begin
  select * into v_charge from public.charges
  where token_hash = p_token_hash and sent_at is not null and cancelled_at is null;

  if not found then
    return false;
  end if;

  update public.charge_installments
  set reported = true
  where id = p_installment_id and charge_id = v_charge.id and paid_at is null and reported = false
  returning number into v_number;

  if v_number is null then
    return false;
  end if;

  insert into public.charge_events (organization_id, charge_id, kind, actor, detail)
  values (v_charge.organization_id, v_charge.id, 'reported', v_charge.client_name, 'Parcela ' || v_number);

  return true;
end;
$$;

revoke execute on function public.assert_installments_match_charge() from public, anon, authenticated;
revoke execute on function public.charge_by_token(text) from public, anon, authenticated;
revoke execute on function public.mark_charge_viewed(text) from public, anon, authenticated;
revoke execute on function public.report_installment_paid(text, uuid) from public, anon, authenticated;

grant execute on function public.charge_by_token(text) to service_role;
grant execute on function public.mark_charge_viewed(text) to service_role;
grant execute on function public.report_installment_paid(text, uuid) to service_role;
