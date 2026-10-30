-- Chaves de API e webhooks de saída (2026-10-29, a pedido: "integração deixe completo tudo igual temos na Le Ange,
-- tanto do webhook quanto API, crie uma página dedicada para cada").
--
-- A chave de API é a credencial de um sistema de fora (planilha, painel, n8n) na `api/v1`, no lugar do token de
-- sessão de uma pessoa. O banco guarda só o resumo dela, nunca a chave: ela aparece inteira uma vez, ao criar ou
-- renovar. O webhook é o caminho inverso, a casa avisando um endereço de fora quando algo acontece, com cada
-- entrega registrada. O segredo de assinatura do webhook também não mora aqui: ele é derivado no servidor do
-- segredo da casa, do id e da versão (`secret_version`), como os tokens dos links públicos, e girar é somar um.

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  description text not null default '' check (char_length(description) <= 500),
  -- O começo da chave, à vista na lista para a pessoa reconhecê-la; o resto só existe no instante da criação.
  prefix text not null check (char_length(prefix) between 8 and 24),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  scopes text[] not null check (cardinality(scopes) between 1 and 32),
  enabled boolean not null default true,
  expires_at timestamptz,
  -- Chamadas por minuto que a chave aceita antes do 429.
  rate_limit integer not null default 60 check (rate_limit between 1 and 1000),
  allowed_ips text[] not null default '{}' check (cardinality(allowed_ips) <= 20),
  last_used_at timestamptz,
  last_used_ip text check (last_used_ip is null or char_length(last_used_ip) <= 64),
  rotated_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.api_key_requests (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  key_id uuid not null references public.api_keys (id) on delete cascade,
  method text not null check (char_length(method) <= 10),
  path text not null check (char_length(path) <= 300),
  -- O que a porta de entrada respondeu: 200 é chamada liberada para a rota; o resto é recusa, com o código.
  status smallint not null,
  code text check (code is null or char_length(code) <= 40),
  scope text check (scope is null or char_length(scope) <= 40),
  ip text check (ip is null or char_length(ip) <= 64),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  description text not null default '' check (char_length(description) <= 80),
  url text not null check (char_length(url) <= 500 and url ~ '^https://'),
  events text[] not null check (cardinality(events) between 1 and 32),
  active boolean not null default true,
  secret_version integer not null default 1 check (secret_version >= 1),
  secret_rotated_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  endpoint_id uuid not null references public.webhook_endpoints (id) on delete cascade,
  -- O mesmo evento chega a vários endereços com o mesmo id, para quem recebe descartar repetição.
  event_id uuid not null,
  event text not null check (char_length(event) <= 60),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  response_status smallint,
  response_excerpt text check (response_excerpt is null or char_length(response_excerpt) <= 500),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  error text check (error is null or char_length(error) <= 300),
  -- Reenviar cria uma entrega nova apontando para a de origem, para o histórico guardar as duas.
  redelivery_of uuid references public.webhook_deliveries (id) on delete set null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index api_keys_organization_idx on public.api_keys (organization_id, created_at desc);
create index api_key_requests_organization_idx on public.api_key_requests (organization_id, created_at desc);
create index api_key_requests_key_idx on public.api_key_requests (key_id, created_at desc);
create index webhook_endpoints_organization_idx on public.webhook_endpoints (organization_id, created_at);
create index webhook_deliveries_endpoint_idx on public.webhook_deliveries (endpoint_id, created_at desc);
create index webhook_deliveries_organization_idx on public.webhook_deliveries (organization_id, created_at desc);

alter table public.api_keys enable row level security;
alter table public.api_key_requests enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;

-- Chave e registro de chamadas são de dono ou administrador, inclusive para ler: o resumo não abre nada, mas quem
-- usa a chave e de onde é assunto de quem administra. O registro só o servidor escreve, pela chave secreta.
create policy api_keys_select on public.api_keys
  for select to authenticated using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));
create policy api_keys_write on public.api_keys
  for all to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]) and public.mfa_satisfied())
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]) and public.mfa_satisfied());

create policy api_key_requests_select on public.api_key_requests
  for select to authenticated using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

-- Webhooks a equipe vê; cadastrar, testar, reenviar e apagar é de dono ou administrador.
create policy webhook_endpoints_select on public.webhook_endpoints
  for select to authenticated using (public.is_member(organization_id));
create policy webhook_endpoints_write on public.webhook_endpoints
  for all to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]) and public.mfa_satisfied())
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]) and public.mfa_satisfied());

create policy webhook_deliveries_select on public.webhook_deliveries
  for select to authenticated using (public.is_member(organization_id));
create policy webhook_deliveries_write on public.webhook_deliveries
  for all to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]) and public.mfa_satisfied())
  with check (
    public.has_role(organization_id, array['owner', 'admin']::public.member_role[])
    and public.mfa_satisfied()
    and exists (select 1 from public.webhook_endpoints e where e.id = endpoint_id and e.organization_id = webhook_deliveries.organization_id)
  );

grant select, insert, update, delete on public.api_keys to authenticated;
grant select on public.api_key_requests to authenticated;
grant select, insert, update, delete on public.webhook_endpoints to authenticated;
grant select, insert, update, delete on public.webhook_deliveries to authenticated;
grant all on public.api_keys, public.api_key_requests, public.webhook_endpoints, public.webhook_deliveries to service_role;
grant usage, select on sequence public.api_key_requests_id_seq to service_role;
