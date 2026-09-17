-- Automações: o fluxo é dado, e não código. Quem o lê é o motor no servidor e quem o desenha é o editor no
-- navegador, sobre o mesmo JSON. Nós e arestas ficam em `jsonb` de propósito: o formato muda com o catálogo
-- de nós, e virar tabela por nó só trocaria uma migração de catálogo por uma migração de schema.

create type public.automation_status as enum ('active', 'paused', 'draft');
create type public.automation_run_mode as enum ('event', 'test');
create type public.automation_run_status as enum ('ok', 'failed', 'waiting');

create table public.automations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 300),
  status public.automation_status not null default 'draft',
  template_id text check (public.text_len_ok(template_id, 1, 60)),
  nodes jsonb not null default '[]'::jsonb check (jsonb_typeof(nodes) = 'array' and jsonb_array_length(nodes) <= 100),
  edges jsonb not null default '[]'::jsonb check (jsonb_typeof(edges) = 'array' and jsonb_array_length(edges) <= 200),
  run_count integer not null default 0 check (run_count >= 0),
  last_run_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index automations_organization_status_idx on public.automations (organization_id, status);
create index automations_organization_updated_idx on public.automations (organization_id, updated_at desc);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  automation_id uuid not null references public.automations (id) on delete cascade,
  at timestamptz not null default now(),
  mode public.automation_run_mode not null,
  trigger_label text not null check (char_length(trigger_label) between 1 and 120),
  status public.automation_run_status not null,
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  created_at timestamptz not null default now()
);

create index automation_runs_automation_idx on public.automation_runs (automation_id, at desc);

alter table public.automations enable row level security;
alter table public.automation_runs enable row level security;

create policy automations_select on public.automations
  for select to authenticated using (public.is_member(organization_id));
create policy automations_insert on public.automations
  for insert to authenticated with check (public.can_write(organization_id));
create policy automations_update on public.automations
  for update to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));
create policy automations_delete on public.automations
  for delete to authenticated using (public.can_write(organization_id));

-- A execução é registro do que o motor fez: a tela lê, e quem escreve é o servidor pela chave secreta.
create policy automation_runs_select on public.automation_runs
  for select to authenticated using (public.is_member(organization_id));

create trigger automation_runs_automation_same_organization
  before insert or update of automation_id, organization_id on public.automation_runs
  for each row execute function public.assert_same_organization('automations', 'automation_id');

create trigger automations_set_updated_at
  before update on public.automations
  for each row execute function public.set_updated_at();

-- Registrar a execução também acerta o contador e a data da última, numa escrita só: duas chamadas
-- separadas deixariam o cartão contando errado sempre que a segunda falhasse.
create or replace function public.record_automation_run(
  p_automation_id uuid,
  p_mode public.automation_run_mode,
  p_trigger_label text,
  p_status public.automation_run_status,
  p_steps jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_id uuid;
begin
  select organization_id into v_organization_id from public.automations where id = p_automation_id;

  if v_organization_id is null then
    raise exception 'Automação inexistente';
  end if;

  insert into public.automation_runs (organization_id, automation_id, mode, trigger_label, status, steps)
  values (v_organization_id, p_automation_id, p_mode, p_trigger_label, p_status, coalesce(p_steps, '[]'::jsonb))
  returning id into v_id;

  -- Teste manual não conta execução: o contador do cartão é quantas vezes o fluxo rodou de verdade.
  if p_mode = 'event' then
    update public.automations
    set run_count = run_count + 1, last_run_at = now()
    where id = p_automation_id;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.record_automation_run(uuid, public.automation_run_mode, text, public.automation_run_status, jsonb) from public, anon, authenticated;
grant execute on function public.record_automation_run(uuid, public.automation_run_mode, text, public.automation_run_status, jsonb) to service_role;
