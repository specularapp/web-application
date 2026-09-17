-- O núcleo que todo domínio de negócio usa: o contato da equipe que assina os documentos, o matiz da
-- paleta que tinge arte gerada, o contador que gera o identificador que a pessoa lê (`ORC-2026-0042`) e os
-- auxiliares de validação usados em `check` de tabela.

-- A busca das listagens compara texto sem acento e sem maiúscula; o índice de trigrama é o que evita varrer
-- a tabela inteira a cada tecla digitada.
create extension if not exists pg_trgm with schema extensions;

alter table public.organizations
  add column email text check (email is null or (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 120)),
  add column phone text check (phone is null or phone ~ '^\d{10,11}$'),
  add column city text check (city is null or char_length(city) between 2 and 80);

create type public.palette_hue as enum (
  'red', 'orange', 'yellow', 'green', 'mint', 'teal',
  'cyan', 'blue', 'indigo', 'purple', 'pink', 'brown'
);

-- Lista de texto curta validada dentro do próprio `check`: quantos itens cabem e o tamanho de cada um.
-- Imutável porque `check` só aceita função imutável, e sem acesso a tabela nenhuma.
create or replace function public.text_array_ok(p_values text[], p_max_items integer, p_max_length integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_values is null
    or (
      cardinality(p_values) <= p_max_items
      and not exists (
        select 1 from unnest(p_values) as value
        where char_length(value) = 0 or char_length(value) > p_max_length
      )
    );
$$;

-- Texto opcional: nulo passa, e o que existe precisa caber na faixa. Evita repetir a mesma expressão em
-- cada `check` de coluna de texto do sistema.
create or replace function public.text_len_ok(p_value text, p_min integer, p_max integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_value is null or char_length(p_value) between p_min and p_max;
$$;

-- O identificador que a pessoa vê e fala é sequencial por organização, por domínio e por ano, então ele
-- precisa de um contador próprio: `max + 1` sobre a tabela repetiria número assim que alguém apagasse um
-- registro, e sequência do Postgres não sabe separar organização de organização.
create table public.reference_counters (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind ~ '^[a-z_]{3,20}$'),
  year smallint not null check (year between 2000 and 4000),
  value integer not null default 0 check (value >= 0),
  primary key (organization_id, kind, year)
);

-- Sem policy nenhuma: o contador não é dado de tela, e só a função abaixo escreve nele.
alter table public.reference_counters enable row level security;

create or replace function public.next_reference(p_organization_id uuid, p_kind text, p_prefix text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year smallint := extract(year from (now() at time zone 'America/Sao_Paulo'))::smallint;
  v_value integer;
begin
  insert into public.reference_counters (organization_id, kind, year, value)
  values (p_organization_id, p_kind, v_year, 1)
  on conflict (organization_id, kind, year)
  do update set value = public.reference_counters.value + 1
  returning value into v_value;

  return p_prefix || '-' || v_year::text || '-' || lpad(v_value::text, 4, '0');
end;
$$;

-- Gatilho genérico: cada tabela passa o domínio e o prefixo como argumento, e nenhuma precisa da própria
-- cópia da regra. Identificador que já veio preenchido é respeitado, para migração de dado não renumerar.
create or replace function public.set_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := public.next_reference(new.organization_id, tg_argv[0], tg_argv[1]);
  end if;
  return new;
end;
$$;

-- Quem escreve precisa ser da organização, e nunca pode mover um registro para outra. As duas metades da
-- regra num lugar só, para cada policy de escrita do sistema ser uma linha.
create or replace function public.can_write(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_member(p_organization_id) and public.mfa_satisfied();
$$;

revoke execute on function public.next_reference(uuid, text, text) from public, anon;
revoke execute on function public.set_reference() from public, anon;

grant execute on function public.text_array_ok(text[], integer, integer) to authenticated;
grant execute on function public.text_len_ok(text, integer, integer) to authenticated;
grant execute on function public.can_write(uuid) to authenticated;
