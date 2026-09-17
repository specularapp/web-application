-- Clientes: o cadastro de quem contrata. É a raiz de orçamento, projeto, contrato e cobrança, então quem
-- tem trabalho ligado não é apagado em silêncio; cada tabela filha diz o que acontece.

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reference text not null,
  name text not null check (char_length(name) between 2 and 80),
  email text check (email is null or (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 120)),
  phone text check (phone is null or phone ~ '^\d{10,11}$'),
  avatar_url text check (public.text_len_ok(avatar_url, 1, 500)),
  company text check (public.text_len_ok(company, 1, 80)),
  company_logo_url text check (public.text_len_ok(company_logo_url, 1, 500)),
  role text check (public.text_len_ok(role, 1, 80)),
  city text check (public.text_len_ok(city, 1, 80)),
  website text check (public.text_len_ok(website, 4, 120)),
  about text check (public.text_len_ok(about, 1, 1000)),
  tags text[] not null default '{}' check (public.text_array_ok(tags, 12, 30)),
  active boolean not null default true,
  favorite boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference)
);

create index clients_organization_name_idx on public.clients (organization_id, name);
create index clients_organization_created_idx on public.clients (organization_id, created_at desc);
create index clients_organization_active_idx on public.clients (organization_id, active);
create index clients_tags_idx on public.clients using gin (tags);
-- A busca da listagem compara nome, empresa e e-mail sem acento nem maiúscula; sem este índice ela varre a
-- tabela inteira a cada tecla.
create index clients_search_idx on public.clients using gin (
  (coalesce(name, '') || ' ' || coalesce(company, '') || ' ' || coalesce(email, '')) extensions.gin_trgm_ops
);

alter table public.clients enable row level security;

create policy clients_select on public.clients
  for select to authenticated
  using (public.is_member(organization_id));

create policy clients_insert on public.clients
  for insert to authenticated
  with check (public.can_write(organization_id));

create policy clients_update on public.clients
  for update to authenticated
  using (public.can_write(organization_id))
  with check (public.can_write(organization_id));

create policy clients_delete on public.clients
  for delete to authenticated
  using (public.can_write(organization_id));

create trigger clients_set_reference
  before insert on public.clients
  for each row execute function public.set_reference('client', 'CLI');

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();
