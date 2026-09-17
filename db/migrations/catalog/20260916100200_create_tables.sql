-- Catálogo: o que a equipe vende. Produto é coisa entregue e serviço é trabalho feito, e é isso que separa
-- estoque de prazo. A linha do orçamento aponta para cá, então item usado nunca some: fica inativo.

create type public.catalog_kind as enum ('product', 'service');
create type public.catalog_unit as enum ('project', 'hour', 'month', 'unit');

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reference text not null,
  name text not null check (char_length(name) between 2 and 120),
  description text not null default '' check (char_length(description) <= 500),
  kind public.catalog_kind not null,
  category text not null default '' check (char_length(category) <= 80),
  price bigint not null check (price >= 0 and price <= 999999999999),
  unit public.catalog_unit not null,
  duration_min integer check (duration_min is null or duration_min between 0 and 3650),
  duration_max integer check (duration_max is null or duration_max between 0 and 3650),
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  stock_capacity integer check (stock_capacity is null or stock_capacity >= 0),
  stock_minimum integer check (stock_minimum is null or stock_minimum >= 0),
  image_url text check (public.text_len_ok(image_url, 1, 500)),
  hue public.palette_hue not null default 'blue',
  active boolean not null default true,
  cost bigint check (cost is null or (cost >= 0 and cost <= 999999999999)),
  max_discount smallint not null default 0 check (max_discount between 0 and 100),
  revisions smallint check (revisions is null or revisions between 0 and 100),
  support_days integer check (support_days is null or support_days between 0 and 3650),
  deliverables text[] not null default '{}' check (public.text_array_ok(deliverables, 30, 200)),
  requirements text[] not null default '{}' check (public.text_array_ok(requirements, 30, 200)),
  tags text[] not null default '{}' check (public.text_array_ok(tags, 12, 30)),
  notes text check (public.text_len_ok(notes, 1, 2000)),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference),
  -- Prazo é faixa, e faixa invertida é erro de digitação que só apareceria no documento do cliente.
  constraint catalog_items_duration_pair check (
    (duration_min is null) = (duration_max is null)
    and (duration_max is null or duration_max >= duration_min)
  ),
  -- Estoque é o trio inteiro ou nenhum: produto sob demanda não tem meio estoque.
  constraint catalog_items_stock_group check (
    num_nonnulls(stock_quantity, stock_capacity, stock_minimum) in (0, 3)
  ),
  constraint catalog_items_stock_bounds check (
    stock_capacity is null or (stock_quantity <= stock_capacity and stock_minimum <= stock_capacity)
  ),
  -- Serviço não guarda estoque e produto não guarda rodada de revisão: campo do outro tipo preenchido é
  -- ficha montada errada, e a tela lê `kind` para decidir o que mostrar.
  constraint catalog_items_kind_fields check (
    case kind
      when 'service' then stock_quantity is null
      when 'product' then revisions is null and duration_min is null
    end
  )
);

create index catalog_items_organization_name_idx on public.catalog_items (organization_id, name);
create index catalog_items_organization_kind_idx on public.catalog_items (organization_id, kind, active);
create index catalog_items_organization_created_idx on public.catalog_items (organization_id, created_at desc);
create index catalog_items_tags_idx on public.catalog_items using gin (tags);
create index catalog_items_search_idx on public.catalog_items using gin (
  (coalesce(name, '') || ' ' || coalesce(category, '') || ' ' || coalesce(description, '')) extensions.gin_trgm_ops
);

alter table public.catalog_items enable row level security;

create policy catalog_items_select on public.catalog_items
  for select to authenticated
  using (public.is_member(organization_id));

create policy catalog_items_insert on public.catalog_items
  for insert to authenticated
  with check (public.can_write(organization_id));

create policy catalog_items_update on public.catalog_items
  for update to authenticated
  using (public.can_write(organization_id))
  with check (public.can_write(organization_id));

create policy catalog_items_delete on public.catalog_items
  for delete to authenticated
  using (public.can_write(organization_id));

create trigger catalog_items_set_reference
  before insert on public.catalog_items
  for each row execute function public.set_reference('catalog', 'CAT');

create trigger catalog_items_set_updated_at
  before update on public.catalog_items
  for each row execute function public.set_updated_at();
