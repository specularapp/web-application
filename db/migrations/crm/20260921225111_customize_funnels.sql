alter table public.crm_folders add column hue public.palette_hue not null default 'blue';

create function public.crm_stage_kind(p_stage text) returns text
language sql immutable set search_path = '' as $$
  select case when p_stage = 'won' or p_stage like 'won\_%' escape '\' then 'won'
    when p_stage = 'lost' or p_stage like 'lost\_%' escape '\' then 'lost' else 'open' end;
$$;
revoke execute on function public.crm_stage_kind(text) from public, anon;
grant execute on function public.crm_stage_kind(text) to authenticated, service_role;

create table public.crm_stage_definitions (
  id text primary key check (id ~ '^(open|won|lost)_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 60),
  hue public.palette_hue not null default 'blue'
);
create index crm_stage_definitions_org_idx on public.crm_stage_definitions(organization_id);
alter table public.crm_stage_definitions enable row level security;
create policy crm_stage_definitions_read on public.crm_stage_definitions for select to authenticated using (public.is_member(organization_id));
create policy crm_stage_definitions_insert on public.crm_stage_definitions for insert to authenticated with check (public.can_write(organization_id));
create policy crm_stage_definitions_update on public.crm_stage_definitions for update to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));
grant select, insert, update on public.crm_stage_definitions to authenticated;
grant all on public.crm_stage_definitions to service_role;

drop index public.opportunities_open_by_funnel_idx;
drop trigger opportunities_touch_stage_since on public.opportunities;
drop trigger opportunities_stage_in_funnel on public.opportunities;
alter table public.opportunities drop constraint opportunities_closed_pair;
alter table public.opportunities alter column stage drop default;
alter table public.opportunities alter column stage type text using stage::text;
alter table public.opportunities alter column stage set default 'lead';
alter table public.opportunities add constraint opportunities_closed_pair check ((public.crm_stage_kind(stage) <> 'open') = (closed_at is not null));
alter table public.crm_funnels drop constraint crm_funnels_stages_check;
alter table public.crm_funnels alter column stages drop default;
alter table public.crm_funnels alter column stages type text[] using stages::text[];
alter table public.crm_funnels alter column stages set default '{lead,contact,proposal,negotiation,won,lost}';
alter table public.crm_funnels add constraint crm_funnels_stages_check check (cardinality(stages) between 1 and 40);

create or replace function public.assert_stage_in_funnel() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_stages text[];
begin
  if new.stage not in ('lead','contact','qualified','proposal','negotiation','won','lost') and not exists (
    select 1 from public.crm_stage_definitions where id = new.stage and organization_id = new.organization_id
  ) then raise exception 'Etapa inválida para esta equipe'; end if;
  if new.funnel_id is not null then
    select stages into v_stages from public.crm_funnels where id = new.funnel_id for share;
    if not (new.stage = any(v_stages)) then raise exception 'A etapa não existe neste funil'; end if;
  end if;
  return new;
end;
$$;

create function public.validate_funnel_stages() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_stage text;
begin
  if cardinality(new.stages) <> (select count(distinct value) from unnest(new.stages) value) then
    raise exception 'Etapas repetidas ou inválidas';
  end if;
  foreach v_stage in array new.stages loop
    if v_stage not in ('lead','contact','qualified','proposal','negotiation','won','lost') and not exists (
      select 1 from public.crm_stage_definitions where id = v_stage and organization_id = new.organization_id
    ) then raise exception 'Etapa inválida para esta equipe'; end if;
  end loop;
  return new;
end;
$$;
create trigger crm_funnels_validate_stages before insert or update of stages, organization_id on public.crm_funnels
for each row execute function public.validate_funnel_stages();
create trigger opportunities_touch_stage_since before update of stage on public.opportunities
for each row execute function public.touch_stage_since();
create trigger opportunities_stage_in_funnel before insert or update of stage, funnel_id, organization_id on public.opportunities
for each row execute function public.assert_stage_in_funnel();
revoke execute on function public.validate_funnel_stages() from public, anon;

create function public.configure_funnel_stages(p_organization_id uuid, p_funnel_id uuid, p_stages jsonb, p_replacements jsonb default '{}') returns void
language plpgsql security invoker set search_path = '' as $$
declare v_funnel public.crm_funnels%rowtype; v_entry jsonb; v_ids text[]; v_old text; v_target text;
begin
  if not public.can_write(p_organization_id) then raise exception 'Sem permissão para editar este funil'; end if;
  select * into v_funnel from public.crm_funnels where id=p_funnel_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Funil não encontrado'; end if;
  if jsonb_typeof(p_stages) is distinct from 'array' or jsonb_array_length(p_stages) not between 1 and 40
    or jsonb_typeof(p_replacements) is distinct from 'object' then raise exception 'Configure de 1 a 40 etapas'; end if;
  select array_agg(value->>'id' order by ordinality) into v_ids from jsonb_array_elements(p_stages) with ordinality;
  if cardinality(v_ids) <> (select count(distinct value) from unnest(v_ids) value) then raise exception 'Etapas repetidas ou inválidas'; end if;
  if exists (select 1 from jsonb_array_elements(p_stages) where char_length(btrim(value->>'label')) not between 1 and 60 or value->>'label' is null) then raise exception 'Informe o nome de cada etapa'; end if;
  if (select count(distinct lower(btrim(value->>'label'))) from jsonb_array_elements(p_stages)) <> cardinality(v_ids) then raise exception 'Use nomes diferentes nas etapas'; end if;
  for v_entry in select value from jsonb_array_elements(p_stages) loop
    if v_entry->>'id' not in ('lead','contact','qualified','proposal','negotiation','won','lost') then
      insert into public.crm_stage_definitions(id,organization_id,label,hue)
      values(v_entry->>'id',p_organization_id,btrim(v_entry->>'label'),(v_entry->>'hue')::public.palette_hue)
      on conflict(id) do update set label=excluded.label, hue=excluded.hue
      where crm_stage_definitions.organization_id=p_organization_id;
    end if;
  end loop;
  update public.crm_funnels set stages=v_ids where id=p_funnel_id;
  for v_old in select distinct stage from public.opportunities where organization_id=p_organization_id and funnel_id=p_funnel_id and not(stage=any(v_ids)) loop
    v_target := p_replacements->>v_old;
    if v_target is null or not(v_target=any(v_ids)) then raise exception 'Escolha o destino das oportunidades da etapa removida'; end if;
    update public.opportunities set stage=v_target,
      closed_at=case when public.crm_stage_kind(v_target)='open' then null else coalesce(closed_at,now()) end
      where organization_id=p_organization_id and funnel_id=p_funnel_id and stage=v_old;
  end loop;
  update public.crm_funnels set stages=v_ids where id=p_funnel_id;
end;
$$;
revoke execute on function public.configure_funnel_stages(uuid,uuid,jsonb,jsonb) from public, anon;
grant execute on function public.configure_funnel_stages(uuid,uuid,jsonb,jsonb) to authenticated;

create index opportunities_open_by_funnel_idx on public.opportunities(organization_id,funnel_id) where public.crm_stage_kind(stage)='open';
create or replace function public.opportunity_open_counts(p_organization_id uuid)
returns table(funnel_id uuid,total integer) language sql stable security definer set search_path='' as $$
  select o.funnel_id,count(*)::integer from public.opportunities o
  where o.organization_id=p_organization_id and public.crm_stage_kind(o.stage)='open' and public.is_member(p_organization_id) group by o.funnel_id;
$$;

create function public.ensure_funnel_opportunities_visible() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.opportunities o join public.crm_funnels f on f.id=o.funnel_id where f.id=new.id and not(o.stage=any(f.stages))) then
    raise exception 'Mova as oportunidades antes de remover a etapa';
  end if;
  return null;
end;
$$;
create constraint trigger crm_funnels_keep_opportunities_visible after update on public.crm_funnels
  deferrable initially deferred for each row execute function public.ensure_funnel_opportunities_visible();
revoke execute on function public.ensure_funnel_opportunities_visible() from public, anon;
