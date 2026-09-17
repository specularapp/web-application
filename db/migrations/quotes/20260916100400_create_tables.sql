-- Orçamentos: o documento que vai ao cliente por link. O emissor não é copiado para cá, sai da organização,
-- porque logo e contato de equipe mudam e o documento tem de acompanhar. O que é copiado é o cliente, que
-- pode não ser cadastro nenhum, e a linha do orçamento, que congela o preço praticado no dia.

create type public.quote_status as enum ('draft', 'sent', 'viewed', 'approved', 'declined', 'expired');
create type public.payment_method as enum ('pix', 'transfer', 'boleto', 'card');
create type public.discount_kind as enum ('percent', 'amount');
create type public.quote_courtesy as enum ('no', 'yes', 'today');

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reference text not null,
  title text not null check (char_length(title) between 2 and 120),
  status public.quote_status not null default 'draft',
  client_id uuid references public.clients (id) on delete set null,
  client_name text not null check (char_length(client_name) between 2 and 80),
  client_company text check (public.text_len_ok(client_company, 1, 80)),
  client_email text check (client_email is null or (client_email = lower(client_email) and client_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(client_email) <= 120)),
  client_phone text check (client_phone is null or client_phone ~ '^\d{10,11}$'),
  client_city text check (public.text_len_ok(client_city, 1, 80)),
  client_avatar_url text check (public.text_len_ok(client_avatar_url, 1, 500)),
  owner_id uuid references auth.users (id) on delete set null,
  discount_kind public.discount_kind,
  discount_value bigint check (discount_value is null or discount_value >= 0),
  installments smallint not null default 1 check (installments between 1 and 48),
  payment_methods public.payment_method[] not null default '{pix}'
    check (cardinality(payment_methods) between 1 and 4),
  cash_discount smallint not null default 0 check (cash_discount between 0 and 100),
  notes text not null default '' check (char_length(notes) <= 2000),
  issued_at date not null default current_date,
  valid_until date,
  sent_at timestamptz,
  viewed_at timestamptz,
  responded_at timestamptz,
  -- O link público é achado pelo resumo do token, nunca pelo token: um vazamento do banco não abre
  -- documento nenhum. O token é derivado no servidor a partir de um segredo que só ele tem, e a versão é o
  -- que revoga um link sem apagar o orçamento.
  share_token_hash text not null unique check (share_token_hash ~ '^[0-9a-f]{64}$'),
  share_token_version smallint not null default 1 check (share_token_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference),
  constraint quotes_discount_pair check ((discount_kind is null) = (discount_value is null)),
  constraint quotes_percent_range check (discount_kind is distinct from 'percent' or discount_value <= 100),
  constraint quotes_valid_after_issue check (valid_until is null or valid_until >= issued_at)
);

create index quotes_organization_status_idx on public.quotes (organization_id, status);
create index quotes_organization_issued_idx on public.quotes (organization_id, issued_at desc);
create index quotes_client_idx on public.quotes (client_id);
create index quotes_owner_idx on public.quotes (owner_id);
create index quotes_search_idx on public.quotes using gin (
  (coalesce(title, '') || ' ' || coalesce(client_name, '') || ' ' || coalesce(client_company, '')) extensions.gin_trgm_ops
);

create table public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  -- Item do catálogo apagado não apaga a linha: o documento já foi ao cliente e o preço dele está aqui.
  catalog_item_id uuid references public.catalog_items (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 300),
  quantity numeric(12, 3) not null default 1 check (quantity > 0 and quantity <= 1000000),
  unit_price bigint not null check (unit_price >= 0 and unit_price <= 999999999999),
  unit public.catalog_unit not null default 'project',
  courtesy public.quote_courtesy not null default 'no',
  position smallint not null default 0 check (position >= 0),
  created_at timestamptz not null default now()
);

create index quote_lines_quote_idx on public.quote_lines (quote_id, position);
create index quote_lines_catalog_idx on public.quote_lines (catalog_item_id);

alter table public.quotes enable row level security;
alter table public.quote_lines enable row level security;

create policy quotes_select on public.quotes
  for select to authenticated using (public.is_member(organization_id));
create policy quotes_insert on public.quotes
  for insert to authenticated with check (public.can_write(organization_id));
create policy quotes_update on public.quotes
  for update to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));
create policy quotes_delete on public.quotes
  for delete to authenticated using (public.can_write(organization_id));

create policy quote_lines_select on public.quote_lines
  for select to authenticated using (public.is_member(organization_id));
create policy quote_lines_write on public.quote_lines
  for all to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));

create trigger quotes_client_same_organization
  before insert or update of client_id, organization_id on public.quotes
  for each row execute function public.assert_same_organization('clients', 'client_id');

create trigger quote_lines_quote_same_organization
  before insert or update of quote_id, organization_id on public.quote_lines
  for each row execute function public.assert_same_organization('quotes', 'quote_id');

create trigger quote_lines_catalog_same_organization
  before insert or update of catalog_item_id, organization_id on public.quote_lines
  for each row execute function public.assert_same_organization('catalog_items', 'catalog_item_id');

create trigger quotes_set_reference
  before insert on public.quotes
  for each row execute function public.set_reference('quote', 'ORC');

create trigger quotes_set_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

-- A página pública do orçamento é lida por `anon`, que não tem policy de leitura em tabela nenhuma: o
-- acesso passa por esta função, que só devolve algo quando o resumo do token bate e o documento já saiu do
-- rascunho. Devolve o orçamento inteiro num JSON, com as linhas e o emissor, para a página pública não
-- precisar de segunda consulta a uma tabela que ela não pode ler.
create or replace function public.quote_by_token(p_token_hash text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'quote', to_jsonb(q) - 'share_token_hash' - 'share_token_version',
    'issuer', jsonb_build_object(
      'name', o.name,
      'logoUrl', o.logo_url,
      'website', o.website,
      'email', o.email,
      'phone', o.phone,
      'city', o.city
    ),
    'lines', coalesce(
      (select jsonb_agg(to_jsonb(l) order by l.position, l.created_at) from public.quote_lines l where l.quote_id = q.id),
      '[]'::jsonb
    )
  )
  from public.quotes q
  join public.organizations o on o.id = q.organization_id
  where q.share_token_hash = p_token_hash
    and q.status <> 'draft'
  limit 1;
$$;

-- Registrar que o cliente abriu é a única escrita que a página pública faz, e ela é de mão única: marca a
-- primeira visualização e nunca desmarca nem muda mais nada.
create or replace function public.mark_quote_viewed(p_token_hash text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.quotes
  set viewed_at = coalesce(viewed_at, now()),
      status = case when status = 'sent' then 'viewed'::public.quote_status else status end
  where share_token_hash = p_token_hash and status <> 'draft';
$$;

-- A resposta do cliente pelo link: aprovar ou recusar, uma vez só, e só enquanto o orçamento está de pé.
create or replace function public.respond_quote(p_token_hash text, p_approved boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update public.quotes
  set status = case when p_approved then 'approved'::public.quote_status else 'declined'::public.quote_status end,
      responded_at = now()
  where share_token_hash = p_token_hash
    and status in ('sent', 'viewed')
    and (valid_until is null or valid_until >= current_date);

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke execute on function public.quote_by_token(text) from public, anon, authenticated;
revoke execute on function public.mark_quote_viewed(text) from public, anon, authenticated;
revoke execute on function public.respond_quote(text, boolean) from public, anon, authenticated;

-- Só o servidor abre link público, e com a chave secreta: `anon` chegando direto na função tentaria token
-- atrás de token sem passar pelo teto de requisições que a rota aplica.
grant execute on function public.quote_by_token(text) to service_role;
grant execute on function public.mark_quote_viewed(text) to service_role;
grant execute on function public.respond_quote(text, boolean) to service_role;
