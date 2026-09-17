-- Funil de vendas: a oportunidade do primeiro contato ao fechamento. A árvore é a mesma forma da de
-- projetos, pasta dentro de pasta com funil na folha, e quem chega sem funil fica no balde, que é o funil
-- nulo. Situação não é campo: sai da etapa, para etiqueta e coluna nunca dizerem coisas diferentes.

create type public.crm_stage as enum ('lead', 'contact', 'qualified', 'proposal', 'negotiation', 'won', 'lost');
create type public.opportunity_temperature as enum ('cold', 'warm', 'hot');
create type public.opportunity_source as enum (
  'whatsapp', 'indicacao', 'site', 'instagram', 'google', 'facebook', 'evento', 'prospeccao', 'telefone', 'outro'
);
create type public.funnel_glyph as enum ('funnel', 'storefront', 'megaphone', 'handshake', 'target', 'buildings', 'tray');

create table public.crm_folders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  parent_id uuid references public.crm_folders (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_folders_not_own_parent check (parent_id is null or parent_id <> id)
);

create index crm_folders_organization_idx on public.crm_folders (organization_id, parent_id, position);

create table public.crm_funnels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reference text not null,
  folder_id uuid references public.crm_folders (id) on delete set null,
  name text not null check (char_length(name) between 2 and 60),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  stages public.crm_stage[] not null default '{lead,contact,proposal,negotiation,won,lost}'
    check (cardinality(stages) between 1 and 7),
  glyph public.funnel_glyph not null default 'funnel',
  hue public.palette_hue not null default 'blue',
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference),
  unique (organization_id, slug)
);

create index crm_funnels_organization_idx on public.crm_funnels (organization_id, position);
create index crm_funnels_folder_idx on public.crm_funnels (folder_id);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reference text not null,
  funnel_id uuid references public.crm_funnels (id) on delete set null,
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  -- Lead novo ainda não é cadastro: o nome fica na oportunidade e só vira vínculo quando alguém cadastra.
  client_id uuid references public.clients (id) on delete set null,
  client_name text not null check (char_length(client_name) between 2 and 80),
  client_company text check (public.text_len_ok(client_company, 1, 80)),
  client_avatar_url text check (public.text_len_ok(client_avatar_url, 1, 500)),
  contact_name text check (public.text_len_ok(contact_name, 1, 80)),
  contact_email text check (contact_email is null or (contact_email = lower(contact_email) and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(contact_email) <= 120)),
  contact_phone text check (public.text_len_ok(contact_phone, 8, 30)),
  stage public.crm_stage not null default 'lead',
  value bigint not null default 0 check (value >= 0 and value <= 999999999999),
  temperature public.opportunity_temperature not null default 'warm',
  probability smallint not null default 0 check (probability between 0 and 100),
  city text check (public.text_len_ok(city, 1, 80)),
  state char(2) check (state is null or state ~ '^[A-Z]{2}$'),
  expected_at date,
  entered_at timestamptz not null default now(),
  closed_at timestamptz,
  stage_since timestamptz not null default now(),
  first_response_minutes integer check (first_response_minutes is null or first_response_minutes >= 0),
  average_response_minutes integer check (average_response_minutes is null or average_response_minutes >= 0),
  owner_id uuid references auth.users (id) on delete set null,
  tags text[] not null default '{}' check (public.text_array_ok(tags, 12, 30)),
  source public.opportunity_source not null default 'outro',
  -- O rastro da campanha é chave e valor livre porque cada plataforma manda os seus; o zod de `schemas.ts`
  -- é quem fecha quais chaves entram. O `check` garante ao menos que é objeto, e não lista nem número.
  attribution jsonb not null default '{}'::jsonb check (jsonb_typeof(attribution) = 'object'),
  partner_code text check (public.text_len_ok(partner_code, 1, 40)),
  last_touch_at date,
  next_step_label text check (public.text_len_ok(next_step_label, 1, 120)),
  next_step_at date,
  quote_id uuid references public.quotes (id) on delete set null,
  -- O cartão conta anexo e histórico sem carregar nem um nem outro, então os dois são contadores na própria
  -- oportunidade em vez de duas contagens por cartão desenhado.
  attachments smallint not null default 0 check (attachments >= 0),
  activity smallint not null default 0 check (activity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference),
  constraint opportunities_next_step_pair check ((next_step_label is null) = (next_step_at is null)),
  -- Etapa de desfecho e data de fechamento andam juntas: uma sem a outra faria o relatório de conversão
  -- contar venda ganha sem dizer quando, ou dizer que fechou o que ainda está aberto.
  constraint opportunities_closed_pair check ((stage in ('won', 'lost')) = (closed_at is not null))
);

create index opportunities_organization_stage_idx on public.opportunities (organization_id, stage);
create index opportunities_funnel_idx on public.opportunities (funnel_id, stage);
create index opportunities_client_idx on public.opportunities (client_id);
create index opportunities_owner_idx on public.opportunities (owner_id);
create index opportunities_organization_entered_idx on public.opportunities (organization_id, entered_at desc);
create index opportunities_tags_idx on public.opportunities using gin (tags);
create index opportunities_search_idx on public.opportunities using gin (
  (coalesce(title, '') || ' ' || coalesce(client_name, '') || ' ' || coalesce(client_company, '')) extensions.gin_trgm_ops
);

create table public.opportunity_people (
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (opportunity_id, user_id)
);

create index opportunity_people_user_idx on public.opportunity_people (user_id);

alter table public.crm_folders enable row level security;
alter table public.crm_funnels enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_people enable row level security;

create policy crm_folders_select on public.crm_folders
  for select to authenticated using (public.is_member(organization_id));
create policy crm_folders_write on public.crm_folders
  for all to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));

create policy crm_funnels_select on public.crm_funnels
  for select to authenticated using (public.is_member(organization_id));
create policy crm_funnels_write on public.crm_funnels
  for all to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));

create policy opportunities_select on public.opportunities
  for select to authenticated using (public.is_member(organization_id));
create policy opportunities_insert on public.opportunities
  for insert to authenticated with check (public.can_write(organization_id));
create policy opportunities_update on public.opportunities
  for update to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));
create policy opportunities_delete on public.opportunities
  for delete to authenticated using (public.can_write(organization_id));

create policy opportunity_people_select on public.opportunity_people
  for select to authenticated using (public.is_member(organization_id));
create policy opportunity_people_write on public.opportunity_people
  for all to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));

create trigger crm_funnels_folder_same_organization
  before insert or update of folder_id, organization_id on public.crm_funnels
  for each row execute function public.assert_same_organization('crm_folders', 'folder_id');

create trigger opportunities_funnel_same_organization
  before insert or update of funnel_id, organization_id on public.opportunities
  for each row execute function public.assert_same_organization('crm_funnels', 'funnel_id');

create trigger opportunities_client_same_organization
  before insert or update of client_id, organization_id on public.opportunities
  for each row execute function public.assert_same_organization('clients', 'client_id');

create trigger opportunities_quote_same_organization
  before insert or update of quote_id, organization_id on public.opportunities
  for each row execute function public.assert_same_organization('quotes', 'quote_id');

-- Quanto tempo a venda está parada na etapa sai de `stage_since`, então mover o cartão precisa reiniciar a
-- contagem sozinho: deixar isso para quem escreve faria o relógio mentir na primeira tela que esquecesse.
create or replace function public.touch_stage_since()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stage is distinct from old.stage then
    new.stage_since = now();
  end if;
  return new;
end;
$$;

create trigger opportunities_touch_stage_since
  before update of stage on public.opportunities
  for each row execute function public.touch_stage_since();

-- A etapa da oportunidade precisa ser uma das que o funil escolheu: fora disso o cartão iria para uma coluna
-- que o quadro nem desenha, e sumiria da tela sem ter sumido do banco. Oportunidade sem funil vale qualquer
-- etapa do catálogo, porque o balde mostra todas.
create or replace function public.assert_stage_in_funnel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stages public.crm_stage[];
begin
  if new.funnel_id is null then
    return new;
  end if;

  select stages into v_stages from public.crm_funnels where id = new.funnel_id;

  if v_stages is not null and not (new.stage = any (v_stages)) then
    raise exception 'A etapa % não existe neste funil', new.stage;
  end if;

  return new;
end;
$$;

create trigger opportunities_stage_in_funnel
  before insert or update of stage, funnel_id on public.opportunities
  for each row execute function public.assert_stage_in_funnel();

revoke execute on function public.assert_stage_in_funnel() from public, anon;

create trigger crm_funnels_set_reference
  before insert on public.crm_funnels
  for each row execute function public.set_reference('funnel', 'FUN');

create trigger opportunities_set_reference
  before insert on public.opportunities
  for each row execute function public.set_reference('opportunity', 'OPO');

create trigger crm_folders_set_updated_at
  before update on public.crm_folders
  for each row execute function public.set_updated_at();

create trigger crm_funnels_set_updated_at
  before update on public.crm_funnels
  for each row execute function public.set_updated_at();

create trigger opportunities_set_updated_at
  before update on public.opportunities
  for each row execute function public.set_updated_at();
