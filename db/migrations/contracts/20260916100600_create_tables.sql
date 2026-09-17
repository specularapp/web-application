-- Contratos: o documento que as duas partes assinam. Pode nascer de um PDF anexado, de um modelo da casa ou
-- do zero no editor, e é por isso que o corpo é ou `body` (o JSON do editor) ou `file` mais os campos de
-- assinatura sobre o PDF. Cada parte tem o próprio endereço público, para uma não assinar pela outra.

create type public.contract_status as enum ('draft', 'sent', 'partial', 'signed', 'cancelled');
create type public.contract_source as enum ('pdf', 'template', 'scratch');
create type public.contract_kind as enum (
  'landing', 'institutional', 'ecommerce', 'app', 'branding', 'uiux', 'maintenance', 'content', 'other'
);
create type public.contract_theme as enum ('plain', 'blue', 'green', 'yellow', 'purple');
create type public.contract_party_role as enum ('issuer', 'client');
create type public.contract_event_kind as enum ('created', 'sent', 'resent', 'viewed', 'signed', 'cancelled');

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reference text not null,
  title text not null check (char_length(title) between 2 and 120),
  kind public.contract_kind not null default 'other',
  description text not null default '' check (char_length(description) <= 100),
  source public.contract_source not null,
  status public.contract_status not null default 'draft',
  client_id uuid references public.clients (id) on delete set null,
  owner_id uuid references auth.users (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  quote_id uuid references public.quotes (id) on delete set null,
  amount bigint check (amount is null or (amount >= 0 and amount <= 999999999999)),
  -- O documento do editor no formato que o Tiptap grava. O zod de `schemas.ts` diz quais nós entram; aqui
  -- só se garante que é um nó, e não uma lista solta nem um número.
  body jsonb check (body is null or jsonb_typeof(body) = 'object'),
  theme public.contract_theme not null default 'plain',
  template_id text check (public.text_len_ok(template_id, 1, 60)),
  file_name text check (public.text_len_ok(file_name, 1, 200)),
  file_size integer check (file_size is null or (file_size > 0 and file_size <= 26214400)),
  file_pages smallint check (file_pages is null or file_pages between 1 and 500),
  -- O PDF vive no Storage; aqui fica só o caminho dele no balde dos contratos.
  file_path text check (public.text_len_ok(file_path, 1, 400)),
  expires_in_days smallint not null default 14 check (expires_in_days between 1 and 365),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  expires_at timestamptz,
  signed_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (organization_id, reference),
  -- Ou é documento escrito ou é PDF anexado: as duas metades preenchidas fariam a tela ter de escolher qual
  -- vale, e nenhuma delas faria o contrato existir.
  constraint contracts_body_or_file check (
    case source
      when 'pdf' then body is null
      else file_path is null
    end
  ),
  constraint contracts_file_group check (
    num_nonnulls(file_name, file_size, file_pages, file_path) in (0, 4)
  )
);

create index contracts_organization_status_idx on public.contracts (organization_id, status);
create index contracts_organization_created_idx on public.contracts (organization_id, created_at desc);
create index contracts_client_idx on public.contracts (client_id);
create index contracts_project_idx on public.contracts (project_id);
create index contracts_quote_idx on public.contracts (quote_id);
create index contracts_search_idx on public.contracts using gin (
  (coalesce(title, '') || ' ' || coalesce(description, '')) extensions.gin_trgm_ops
);

create table public.contract_parties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contract_id uuid not null references public.contracts (id) on delete cascade,
  role public.contract_party_role not null,
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 120),
  avatar_url text check (public.text_len_ok(avatar_url, 1, 500)),
  -- A credencial do endereço público desta parte, guardada só como resumo, como manda a regra de banco: o
  -- token em si é derivado no servidor e nunca chega ao Postgres em claro.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_version smallint not null default 1 check (token_version >= 1),
  viewed_at timestamptz,
  signed_at timestamptz,
  signature_url text check (public.text_len_ok(signature_url, 1, 500000)),
  position smallint not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (contract_id, role),
  constraint contract_parties_signature_pair check ((signed_at is null) = (signature_url is null))
);

create index contract_parties_contract_idx on public.contract_parties (contract_id, position);

create table public.contract_signature_fields (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contract_id uuid not null references public.contracts (id) on delete cascade,
  party_id uuid not null references public.contract_parties (id) on delete cascade,
  page smallint not null check (page >= 1),
  -- A caixa em frações da página, de 0 a 1, para valer em qualquer escala em que a página seja desenhada.
  x double precision not null check (x >= 0 and x <= 1),
  y double precision not null check (y >= 0 and y <= 1),
  width double precision not null check (width > 0 and width <= 1),
  height double precision not null check (height > 0 and height <= 1),
  created_at timestamptz not null default now(),
  constraint contract_signature_fields_inside_page check (x + width <= 1 and y + height <= 1)
);

create index contract_signature_fields_contract_idx on public.contract_signature_fields (contract_id, page);

create table public.contract_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contract_id uuid not null references public.contracts (id) on delete cascade,
  kind public.contract_event_kind not null,
  actor text check (public.text_len_ok(actor, 1, 120)),
  at timestamptz not null default now()
);

create index contract_events_contract_idx on public.contract_events (contract_id, at desc);

alter table public.contracts enable row level security;
alter table public.contract_parties enable row level security;
alter table public.contract_signature_fields enable row level security;
alter table public.contract_events enable row level security;

create policy contracts_select on public.contracts
  for select to authenticated using (public.is_member(organization_id));
create policy contracts_insert on public.contracts
  for insert to authenticated with check (public.can_write(organization_id));
create policy contracts_update on public.contracts
  for update to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));
create policy contracts_delete on public.contracts
  for delete to authenticated using (public.can_write(organization_id));

create policy contract_parties_select on public.contract_parties
  for select to authenticated using (public.is_member(organization_id));
create policy contract_parties_write on public.contract_parties
  for all to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));

create policy contract_signature_fields_select on public.contract_signature_fields
  for select to authenticated using (public.is_member(organization_id));
create policy contract_signature_fields_write on public.contract_signature_fields
  for all to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));

create policy contract_events_select on public.contract_events
  for select to authenticated using (public.is_member(organization_id));
create policy contract_events_insert on public.contract_events
  for insert to authenticated with check (public.can_write(organization_id));

create trigger contracts_client_same_organization
  before insert or update of client_id, organization_id on public.contracts
  for each row execute function public.assert_same_organization('clients', 'client_id');

create trigger contracts_project_same_organization
  before insert or update of project_id, organization_id on public.contracts
  for each row execute function public.assert_same_organization('projects', 'project_id');

create trigger contracts_quote_same_organization
  before insert or update of quote_id, organization_id on public.contracts
  for each row execute function public.assert_same_organization('quotes', 'quote_id');

create trigger contract_parties_contract_same_organization
  before insert or update of contract_id, organization_id on public.contract_parties
  for each row execute function public.assert_same_organization('contracts', 'contract_id');

create trigger contract_signature_fields_contract_same_organization
  before insert or update of contract_id, organization_id on public.contract_signature_fields
  for each row execute function public.assert_same_organization('contracts', 'contract_id');

create trigger contract_events_contract_same_organization
  before insert or update of contract_id, organization_id on public.contract_events
  for each row execute function public.assert_same_organization('contracts', 'contract_id');

create trigger contracts_set_reference
  before insert on public.contracts
  for each row execute function public.set_reference('contract', 'CTR');

create trigger contracts_set_updated_at
  before update on public.contracts
  for each row execute function public.set_updated_at();

-- A situação do contrato sai de quem já assinou, e não de quem escreve: rascunho enquanto não saiu, parcial
-- com uma assinatura, assinado com as duas. Gravar a situação à mão faria o cartão dizer "enviado" depois de
-- a segunda parte ter assinado, que é justamente o momento em que ninguém está olhando a tela.
create or replace function public.refresh_contract_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract_id uuid := coalesce(new.contract_id, old.contract_id);
  v_total integer;
  v_signed integer;
begin
  select count(*), count(*) filter (where signed_at is not null)
    into v_total, v_signed
  from public.contract_parties
  where contract_id = v_contract_id;

  update public.contracts
  set status = case
        when cancelled_at is not null then 'cancelled'::public.contract_status
        when sent_at is null then 'draft'::public.contract_status
        when v_total > 0 and v_signed = v_total then 'signed'::public.contract_status
        when v_signed > 0 then 'partial'::public.contract_status
        else 'sent'::public.contract_status
      end,
      signed_at = case when v_total > 0 and v_signed = v_total then coalesce(signed_at, now()) else null end
  where id = v_contract_id;

  return null;
end;
$$;

create trigger contract_parties_refresh_status
  after insert or update of signed_at or delete on public.contract_parties
  for each row execute function public.refresh_contract_status();

-- A página pública de uma parte: achada pelo resumo do token dela, e só enquanto o contrato foi enviado e
-- não venceu nem foi cancelado.
create or replace function public.contract_by_party_token(p_token_hash text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'contract', to_jsonb(c),
    'party', to_jsonb(p) - 'token_hash' - 'token_version',
    'parties', (
      select coalesce(jsonb_agg(to_jsonb(other) - 'token_hash' - 'token_version' order by other.position), '[]'::jsonb)
      from public.contract_parties other where other.contract_id = c.id
    ),
    'fields', (
      select coalesce(jsonb_agg(to_jsonb(f) order by f.page), '[]'::jsonb)
      from public.contract_signature_fields f where f.contract_id = c.id
    ),
    'issuer', jsonb_build_object('name', o.name, 'logoUrl', o.logo_url, 'email', o.email, 'phone', o.phone, 'city', o.city)
  )
  from public.contract_parties p
  join public.contracts c on c.id = p.contract_id
  join public.organizations o on o.id = c.organization_id
  where p.token_hash = p_token_hash
    and c.sent_at is not null
    and c.cancelled_at is null
    and (c.expires_at is null or c.expires_at > now())
  limit 1;
$$;

create or replace function public.mark_contract_party_viewed(p_token_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_party public.contract_parties%rowtype;
begin
  update public.contract_parties
  set viewed_at = coalesce(viewed_at, now())
  where token_hash = p_token_hash and viewed_at is null
  returning * into v_party;

  if found then
    insert into public.contract_events (organization_id, contract_id, kind, actor)
    values (v_party.organization_id, v_party.contract_id, 'viewed', v_party.name);
  end if;
end;
$$;

-- Assinar é uma vez só, pela parte dona do token, e nunca depois do prazo. A situação do contrato vem do
-- gatilho acima, então esta função não decide etiqueta nenhuma.
create or replace function public.sign_contract_party(p_token_hash text, p_signature_url text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_party public.contract_parties%rowtype;
begin
  select p.* into v_party
  from public.contract_parties p
  join public.contracts c on c.id = p.contract_id
  where p.token_hash = p_token_hash
    and p.signed_at is null
    and c.sent_at is not null
    and c.cancelled_at is null
    and (c.expires_at is null or c.expires_at > now())
  for update of p;

  if not found then
    return false;
  end if;

  update public.contract_parties
  set signed_at = now(), signature_url = p_signature_url
  where id = v_party.id;

  insert into public.contract_events (organization_id, contract_id, kind, actor)
  values (v_party.organization_id, v_party.contract_id, 'signed', v_party.name);

  return true;
end;
$$;

revoke execute on function public.refresh_contract_status() from public, anon, authenticated;
revoke execute on function public.contract_by_party_token(text) from public, anon, authenticated;
revoke execute on function public.mark_contract_party_viewed(text) from public, anon, authenticated;
revoke execute on function public.sign_contract_party(text, text) from public, anon, authenticated;

grant execute on function public.contract_by_party_token(text) to service_role;
grant execute on function public.mark_contract_party_viewed(text) to service_role;
grant execute on function public.sign_contract_party(text, text) to service_role;
