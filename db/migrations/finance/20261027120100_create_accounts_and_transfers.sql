-- Contas bancárias, categorias e transferências (2026-10-27, a pedido: "pegue tudo [do financeiro da Le Ange] e
-- traga pra cá"). O caixa deixa de ser um número só: cada movimentação passa a cair numa conta, o saldo de cada
-- uma sai da abertura mais o que entrou e saiu nela, e mover dinheiro de uma conta para outra vira uma
-- transferência, que não é entrada nem saída da empresa.
--
-- A contabilidade de partida dobrada da Le Ange fica de fora de propósito: as telas dela só leem movimentos com
-- origem e conta, e é exatamente isso que `transactions` passa a guardar.

create type public.finance_account_kind as enum ('checking', 'savings', 'cash', 'acquirer');
create type public.finance_category_kind as enum ('income', 'expense');
create type public.finance_category_nature as enum ('fixed', 'variable');
-- De onde veio a movimentação. Só `manual` e `charge` são dinheiro entrando ou saindo da empresa; transferência e
-- ajuste mexem no saldo de uma conta e ficam fora do fluxo de caixa, senão mover dez mil do banco para o caixa
-- apareceria como dez mil de receita.
create type public.transaction_origin as enum ('manual', 'charge', 'transfer', 'adjustment');

create table public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  kind public.finance_account_kind not null default 'checking',
  -- A chave do banco no catálogo do código ("itau", "nubank"), que dá o logo e o nome; nula no caixa.
  bank text check (public.text_len_ok(bank, 1, 40)),
  agency text check (agency is null or agency ~ '^[0-9-]{1,10}$'),
  -- Só o fim do número, que é o que a tela mostra ("***1234"): o número inteiro não serve a nada aqui e seria
  -- um dado a mais para vazar.
  last_digits text check (last_digits is null or last_digits ~ '^[0-9]{2,6}$'),
  hue public.palette_hue not null default 'blue',
  opening_balance bigint not null default 0 check (opening_balance between -999999999999 and 999999999999),
  opening_date date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  -- A conta onde cai o que não disse de onde veio: toda equipe tem uma, e só uma.
  is_default boolean not null default false,
  active boolean not null default true,
  position smallint not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_accounts_default_active check (not is_default or active)
);

create unique index finance_accounts_name_idx on public.finance_accounts (organization_id, lower(name));
create unique index finance_accounts_default_idx on public.finance_accounts (organization_id) where is_default;
create index finance_accounts_organization_idx on public.finance_accounts (organization_id, position);

create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind public.finance_category_kind not null,
  name text not null check (char_length(name) between 2 and 60),
  -- Fixa ou variável só faz sentido no que sai: é o que separa o custo da obra do custo de manter a empresa.
  nature public.finance_category_nature,
  hue public.palette_hue not null default 'gray',
  position smallint not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_categories_nature_kind check ((kind = 'expense') = (nature is not null))
);

create unique index finance_categories_name_idx on public.finance_categories (organization_id, kind, lower(name));
create index finance_categories_organization_idx on public.finance_categories (organization_id, kind, position);

create table public.finance_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reference text not null default '',
  from_account_id uuid not null references public.finance_accounts (id) on delete restrict,
  to_account_id uuid not null references public.finance_accounts (id) on delete restrict,
  amount bigint not null check (amount > 0 and amount <= 999999999999),
  date date not null,
  note text not null default '' check (char_length(note) <= 300),
  undone_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, reference),
  constraint finance_transfers_distinct check (from_account_id <> to_account_id)
);

create index finance_transfers_organization_date_idx on public.finance_transfers (organization_id, date desc);

alter table public.transactions
  add column account_id uuid references public.finance_accounts (id) on delete restrict,
  add column category_id uuid references public.finance_categories (id) on delete set null,
  add column origin public.transaction_origin not null default 'manual',
  add column transfer_id uuid references public.finance_transfers (id) on delete cascade,
  add constraint transactions_transfer_pair check ((origin = 'transfer') = (transfer_id is not null));

create index transactions_account_date_idx on public.transactions (account_id, date desc);
create index transactions_category_idx on public.transactions (category_id);
create index transactions_transfer_idx on public.transactions (transfer_id);

-- Na cobrança e na despesa, a categoria e a conta onde o dinheiro deve cair: a baixa da parcela herda as duas.
alter table public.charges
  add column category_id uuid references public.finance_categories (id) on delete set null,
  add column account_id uuid references public.finance_accounts (id) on delete set null;

create index charges_category_idx on public.charges (category_id);

update public.transactions set origin = 'charge' where charge_id is not null;

alter table public.finance_accounts enable row level security;
alter table public.finance_categories enable row level security;
alter table public.finance_transfers enable row level security;

-- Conta e categoria são o desenho do financeiro da equipe, e quem desenha é dono ou administrador, como na
-- abertura de caixa que veio antes; transferir é operação do dia a dia, de quem escreve.
create policy finance_accounts_select on public.finance_accounts
  for select to authenticated using (public.is_member(organization_id));
create policy finance_accounts_write on public.finance_accounts
  for all to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]) and public.mfa_satisfied())
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]) and public.mfa_satisfied());

create policy finance_categories_select on public.finance_categories
  for select to authenticated using (public.is_member(organization_id));
create policy finance_categories_write on public.finance_categories
  for all to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]) and public.mfa_satisfied())
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]) and public.mfa_satisfied());

create policy finance_transfers_select on public.finance_transfers
  for select to authenticated using (public.is_member(organization_id));
create policy finance_transfers_insert on public.finance_transfers
  for insert to authenticated with check (public.can_write(organization_id));
create policy finance_transfers_update on public.finance_transfers
  for update to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));

create trigger finance_transfers_from_same_organization
  before insert or update of from_account_id, organization_id on public.finance_transfers
  for each row execute function public.assert_same_organization('finance_accounts', 'from_account_id');

create trigger finance_transfers_to_same_organization
  before insert or update of to_account_id, organization_id on public.finance_transfers
  for each row execute function public.assert_same_organization('finance_accounts', 'to_account_id');

create trigger transactions_account_same_organization
  before insert or update of account_id, organization_id on public.transactions
  for each row execute function public.assert_same_organization('finance_accounts', 'account_id');

create trigger transactions_category_same_organization
  before insert or update of category_id, organization_id on public.transactions
  for each row execute function public.assert_same_organization('finance_categories', 'category_id');

create trigger transactions_transfer_same_organization
  before insert or update of transfer_id, organization_id on public.transactions
  for each row execute function public.assert_same_organization('finance_transfers', 'transfer_id');

create trigger charges_category_same_organization
  before insert or update of category_id, organization_id on public.charges
  for each row execute function public.assert_same_organization('finance_categories', 'category_id');

create trigger charges_account_same_organization
  before insert or update of account_id, organization_id on public.charges
  for each row execute function public.assert_same_organization('finance_accounts', 'account_id');

create trigger finance_transfers_set_reference
  before insert on public.finance_transfers
  for each row execute function public.set_reference('transfer', 'TRF');

create trigger finance_accounts_set_updated_at
  before update on public.finance_accounts
  for each row execute function public.set_updated_at();

create trigger finance_categories_set_updated_at
  before update on public.finance_categories
  for each row execute function public.set_updated_at();

-- O saldo de cada conta nunca é gravado: é a abertura mais o que entrou menos o que saiu nela, só do que está
-- confirmado. Gravar seria ter dois números para a mesma pergunta, e o primeiro esquecido divergiria do outro.
create view public.finance_account_balances
with (security_invoker = true) as
  select
    a.id as account_id,
    a.organization_id,
    a.opening_balance + coalesce(sum(
      case t.kind when 'income' then t.amount when 'expense' then -t.amount else 0 end
    ) filter (where t.status = 'confirmed'), 0)::bigint as balance
  from public.finance_accounts a
  left join public.transactions t on t.account_id = a.id
  group by a.id;

create or replace function public.finance_account_balance(p_account_id uuid)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select balance from public.finance_account_balances where account_id = p_account_id;
$$;

-- Movimentação que não disse a conta cai na conta padrão da equipe: é o que mantém funcionando quem já
-- lançava antes de existir conta (o aplicativo, a baixa de parcela, as automações). A categoria precisa ser do
-- mesmo lado da movimentação, e a conta precisa estar ativa.
create or replace function public.fill_transaction_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active boolean;
  v_kind public.finance_category_kind;
begin
  if new.account_id is null then
    select id into new.account_id from public.finance_accounts
    where organization_id = new.organization_id and is_default;
  end if;

  if new.account_id is null then
    raise exception 'A equipe ainda não tem uma conta para lançar';
  end if;

  if tg_op = 'INSERT' or new.account_id is distinct from old.account_id then
    select active into v_active from public.finance_accounts where id = new.account_id;
    if not coalesce(v_active, false) then
      raise exception 'Essa conta está inativa';
    end if;
  end if;

  if new.category_id is not null then
    select kind into v_kind from public.finance_categories where id = new.category_id;
    if v_kind::text is distinct from new.kind::text then
      raise exception 'A categoria não é do mesmo lado da movimentação';
    end if;
  end if;

  return new;
end;
$$;

create trigger transactions_fill_account
  before insert or update of account_id, category_id, kind on public.transactions
  for each row execute function public.fill_transaction_account();

-- Inativar uma conta com dinheiro dentro esconderia esse dinheiro do saldo da equipe, e a padrão não pode sair
-- de cena sem outra no lugar.
create or replace function public.guard_finance_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.active and not new.active then
    if new.is_default then
      raise exception 'A conta padrão não pode ser inativada';
    end if;
    if public.finance_account_balance(new.id) <> 0 then
      raise exception 'Só dá para inativar uma conta com saldo zero';
    end if;
  end if;
  return new;
end;
$$;

create trigger finance_accounts_guard
  before update of active on public.finance_accounts
  for each row execute function public.guard_finance_account();

-- O ponto de partida de cada equipe: uma conta principal com a abertura de caixa que já existia, e as
-- categorias de uma empresa de obra e serviço. Quem quiser outras renomeia, tira e acrescenta a partir daqui.
create or replace function public.seed_finance_defaults(p_organization uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.finance_accounts where organization_id = p_organization) then
    insert into public.finance_accounts (organization_id, name, kind, hue, opening_balance, is_default)
    values (
      p_organization,
      'Conta principal',
      'checking',
      'blue',
      coalesce((select opening_balance from public.finance_settings where organization_id = p_organization), 0),
      true
    );
  end if;

  insert into public.finance_categories (organization_id, kind, name, nature, hue, position)
  select p_organization, entry.kind::public.finance_category_kind, entry.name,
    entry.nature::public.finance_category_nature, entry.hue::public.palette_hue, entry.position
  from (
    values
      ('income', 'Obra e contrato', null, 'green', 0),
      ('income', 'Sinal e entrada', null, 'teal', 1),
      ('income', 'Medição', null, 'blue', 2),
      ('income', 'Serviço avulso', null, 'indigo', 3),
      ('income', 'Venda de material', null, 'orange', 4),
      ('income', 'Outras entradas', null, 'gray', 5),
      ('expense', 'Material de obra', 'variable', 'orange', 0),
      ('expense', 'Mão de obra', 'variable', 'brown', 1),
      ('expense', 'Terceirizados', 'variable', 'purple', 2),
      ('expense', 'Frete e logística', 'variable', 'yellow', 3),
      ('expense', 'Equipamentos e ferramentas', 'variable', 'cyan', 4),
      ('expense', 'Combustível e veículos', 'variable', 'red', 5),
      ('expense', 'Comissões', 'variable', 'pink', 6),
      ('expense', 'Impostos', 'fixed', 'red', 7),
      ('expense', 'Folha de pagamento', 'fixed', 'blue', 8),
      ('expense', 'Aluguel', 'fixed', 'indigo', 9),
      ('expense', 'Água, luz e internet', 'fixed', 'teal', 10),
      ('expense', 'Software e assinaturas', 'fixed', 'mint', 11),
      ('expense', 'Marketing', 'fixed', 'purple', 12),
      ('expense', 'Taxas bancárias', 'fixed', 'gray', 13),
      ('expense', 'Outras saídas', 'variable', 'gray', 14)
  ) as entry (kind, name, nature, hue, position)
  on conflict do nothing;
end;
$$;

create or replace function public.seed_finance_defaults_on_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_finance_defaults(new.id);
  return new;
end;
$$;

create trigger organizations_seed_finance_defaults
  after insert on public.organizations
  for each row execute function public.seed_finance_defaults_on_organization();

-- As equipes que já existem ganham a conta e as categorias agora, e tudo que já foi lançado cai na conta
-- principal, para o saldo de hoje ser o mesmo de ontem.
select public.seed_finance_defaults(id) from public.organizations;

update public.transactions t
set account_id = a.id
from public.finance_accounts a
where a.organization_id = t.organization_id and a.is_default and t.account_id is null;

alter table public.transactions alter column account_id set not null;

-- A baixa da parcela agora diz em que conta o dinheiro caiu (a escolhida na hora, a da cobrança ou a padrão) e
-- leva a categoria da cobrança. A assinatura muda, então a antiga sai antes, senão as duas conviveriam.
drop function public.change_charge_payment(uuid, uuid, text, uuid, public.payment_method, date);

create function public.change_charge_payment(
  p_organization_id uuid,
  p_charge_id uuid,
  p_operation text,
  p_installment_id uuid default null,
  p_method public.payment_method default null,
  p_paid_on date default null,
  p_account_id uuid default null
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_charge public.charges%rowtype;
  v_installment public.charge_installments%rowtype;
  v_transaction_id uuid;
  v_method public.payment_method;
  v_date date := coalesce(p_paid_on, (now() at time zone 'America/Sao_Paulo')::date);
begin
  if not public.can_write(p_organization_id) then
    raise exception 'Sem permissão para alterar o financeiro';
  end if;
  select * into v_charge from public.charges
    where id = p_charge_id and organization_id = p_organization_id for update;
  if not found then raise exception 'Esse registro não existe mais'; end if;

  if p_operation = 'cancel' then
    if v_charge.cancelled_at is not null then return; end if;
    if exists (select 1 from public.charge_installments where charge_id = p_charge_id and paid_at is not null) then
      raise exception 'Há parcelas pagas e o registro não pode ser cancelado';
    end if;
    update public.charges set cancelled_at = now() where id = p_charge_id;
    insert into public.charge_events (organization_id, charge_id, kind)
      values (p_organization_id, p_charge_id, 'cancelled');
    return;
  end if;

  if v_charge.cancelled_at is not null then raise exception 'Esse registro foi cancelado'; end if;
  select * into v_installment from public.charge_installments
    where id = p_installment_id and charge_id = p_charge_id and organization_id = p_organization_id for update;
  if not found then raise exception 'Essa parcela não existe mais'; end if;

  if p_operation = 'pay' then
    if v_installment.paid_at is not null then raise exception 'Essa parcela já foi baixada'; end if;
    v_method := coalesce(p_method, v_charge.method);
    insert into public.transactions (
      organization_id, kind, status, title, description, amount, date,
      method_type, method_label, visual_type, visual_avatar_url, charge_id, created_by,
      account_id, category_id, origin
    ) values (
      p_organization_id,
      case when v_charge.direction = 'outgoing' then 'expense'::public.transaction_kind else 'income'::public.transaction_kind end,
      'confirmed', coalesce(v_charge.client_company, v_charge.client_name, v_charge.title),
      'Parcela ' || v_installment.number || ' de ' || v_charge.title, v_installment.amount, v_date,
      v_method,
      case v_method when 'pix' then 'Pix' when 'card' then 'Cartão' when 'boleto' then 'Boleto'
        when 'cash' then 'Dinheiro' else 'Transferência bancária' end,
      'person', coalesce(v_charge.client_avatar_url, v_charge.image_url), p_charge_id, auth.uid(),
      coalesce(p_account_id, v_charge.account_id), v_charge.category_id, 'charge'
    ) returning id into v_transaction_id;
    update public.charge_installments
      set paid_at = (v_date + time '12:00') at time zone 'UTC', paid_method = v_method,
          reported = false, transaction_id = v_transaction_id
      where id = p_installment_id;
    insert into public.charge_events (organization_id, charge_id, kind, detail)
      values (p_organization_id, p_charge_id, 'paid', 'Parcela ' || v_installment.number);
  elsif p_operation = 'reopen' then
    if v_installment.paid_at is null then raise exception 'Essa parcela ainda está em aberto'; end if;
    update public.charge_installments
      set paid_at = null, paid_method = null, reported = false, transaction_id = null
      where id = p_installment_id;
    delete from public.transactions where id = v_installment.transaction_id and organization_id = p_organization_id;
    insert into public.charge_events (organization_id, charge_id, kind, detail)
      values (p_organization_id, p_charge_id, 'reopened', 'Parcela ' || v_installment.number);
  else
    raise exception 'Operação inválida';
  end if;
end;
$$;

-- Transferir é uma operação só: o registro e as duas pontas (a saída de uma conta e a entrada na outra) nascem
-- juntos ou não nascem. A origem precisa ter o dinheiro, como no financeiro da Le Ange, senão o saldo de uma
-- conta ficaria negativo por um lançamento que ninguém fez de verdade.
create or replace function public.create_finance_transfer(
  p_organization_id uuid,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount bigint,
  p_date date,
  p_note text default ''
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_from public.finance_accounts%rowtype;
  v_to public.finance_accounts%rowtype;
  v_transfer_id uuid;
begin
  if not public.can_write(p_organization_id) then
    raise exception 'Sem permissão para alterar o financeiro';
  end if;
  if p_from_account_id = p_to_account_id then
    raise exception 'Escolha duas contas diferentes';
  end if;
  if p_date > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'A transferência não pode ser no futuro';
  end if;

  -- Trava as duas na ordem do id, para duas transferências cruzadas não se esperarem para sempre.
  perform 1 from public.finance_accounts
    where id in (p_from_account_id, p_to_account_id) and organization_id = p_organization_id
    order by id for update;

  select * into v_from from public.finance_accounts where id = p_from_account_id and organization_id = p_organization_id;
  select * into v_to from public.finance_accounts where id = p_to_account_id and organization_id = p_organization_id;
  if v_from.id is null or v_to.id is null then raise exception 'Essa conta não existe mais'; end if;
  if not v_from.active or not v_to.active then raise exception 'Essa conta está inativa'; end if;
  if public.finance_account_balance(p_from_account_id) < p_amount then
    raise exception 'A conta de origem não tem saldo para essa transferência';
  end if;

  insert into public.finance_transfers (organization_id, from_account_id, to_account_id, amount, date, note, created_by)
  values (p_organization_id, p_from_account_id, p_to_account_id, p_amount, p_date, coalesce(p_note, ''), auth.uid())
  returning id into v_transfer_id;

  insert into public.transactions (
    organization_id, kind, status, title, description, amount, date, account_id, origin, transfer_id, created_by
  ) values
    (p_organization_id, 'expense', 'confirmed', 'Transferência para ' || v_to.name, coalesce(p_note, ''),
      p_amount, p_date, p_from_account_id, 'transfer', v_transfer_id, auth.uid()),
    (p_organization_id, 'income', 'confirmed', 'Transferência de ' || v_from.name, coalesce(p_note, ''),
      p_amount, p_date, p_to_account_id, 'transfer', v_transfer_id, auth.uid());

  return v_transfer_id;
end;
$$;

-- Desfazer não apaga: a transferência fica marcada e as duas pontas viram canceladas, para o extrato contar a
-- história inteira. O destino precisa ainda ter o dinheiro, pela mesma razão da ida.
create or replace function public.undo_finance_transfer(p_organization_id uuid, p_transfer_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_transfer public.finance_transfers%rowtype;
begin
  if not public.can_write(p_organization_id) then
    raise exception 'Sem permissão para alterar o financeiro';
  end if;
  select * into v_transfer from public.finance_transfers
    where id = p_transfer_id and organization_id = p_organization_id for update;
  if not found then raise exception 'Essa transferência não existe mais'; end if;
  if v_transfer.undone_at is not null then return; end if;

  perform 1 from public.finance_accounts where id = v_transfer.to_account_id for update;
  if public.finance_account_balance(v_transfer.to_account_id) < v_transfer.amount then
    raise exception 'A conta de destino não tem mais esse saldo';
  end if;

  update public.finance_transfers set undone_at = now() where id = p_transfer_id;
  update public.transactions set status = 'cancelled' where transfer_id = p_transfer_id;
end;
$$;

-- Ajustar o saldo: a pessoa diz quanto a conta tem de verdade, e a diferença vira um lançamento de ajuste, que
-- mexe na conta sem entrar no fluxo de caixa. A conta é feita aqui, com a conta travada, e não na tela, para
-- dois ajustes ao mesmo tempo não somarem a diferença duas vezes.
create or replace function public.adjust_finance_account(
  p_organization_id uuid,
  p_account_id uuid,
  p_balance bigint,
  p_date date,
  p_note text default ''
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_account public.finance_accounts%rowtype;
  v_difference bigint;
begin
  if not public.can_write(p_organization_id) then
    raise exception 'Sem permissão para alterar o financeiro';
  end if;
  if p_date > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'O ajuste não pode ser no futuro';
  end if;
  select * into v_account from public.finance_accounts
    where id = p_account_id and organization_id = p_organization_id for update;
  if not found then raise exception 'Essa conta não existe mais'; end if;
  if not v_account.active then raise exception 'Essa conta está inativa'; end if;

  v_difference := p_balance - public.finance_account_balance(p_account_id);
  if v_difference = 0 then raise exception 'O saldo da conta já é esse'; end if;

  insert into public.transactions (
    organization_id, kind, status, title, description, amount, date, account_id, origin, created_by
  ) values (
    p_organization_id,
    case when v_difference > 0 then 'income'::public.transaction_kind else 'expense'::public.transaction_kind end,
    'confirmed', 'Ajuste de saldo', coalesce(p_note, ''), abs(v_difference), p_date, p_account_id, 'adjustment', auth.uid()
  );
end;
$$;

revoke execute on function public.fill_transaction_account() from public, anon, authenticated;
revoke execute on function public.guard_finance_account() from public, anon, authenticated;
revoke execute on function public.seed_finance_defaults(uuid) from public, anon, authenticated;
revoke execute on function public.seed_finance_defaults_on_organization() from public, anon, authenticated;

revoke all on function public.finance_account_balance(uuid) from public, anon;
revoke all on function public.change_charge_payment(uuid, uuid, text, uuid, public.payment_method, date, uuid) from public, anon;
revoke all on function public.create_finance_transfer(uuid, uuid, uuid, bigint, date, text) from public, anon;
revoke all on function public.undo_finance_transfer(uuid, uuid) from public, anon;
revoke all on function public.adjust_finance_account(uuid, uuid, bigint, date, text) from public, anon;

grant execute on function public.finance_account_balance(uuid) to authenticated;
grant execute on function public.change_charge_payment(uuid, uuid, text, uuid, public.payment_method, date, uuid) to authenticated;
grant execute on function public.create_finance_transfer(uuid, uuid, uuid, bigint, date, text) to authenticated;
grant execute on function public.undo_finance_transfer(uuid, uuid) to authenticated;
grant execute on function public.adjust_finance_account(uuid, uuid, bigint, date, text) to authenticated;
grant select on public.finance_account_balances to authenticated;
