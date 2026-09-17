-- Gamificação: os pontos de quem usa e o dia a dia de acesso de que sai o desafio da semana. É por pessoa, e
-- não por equipe: o arrasto e a posição no ranking são de quem entra todo dia, não do time.

create table public.gamification_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  points integer not null default 0 check (points >= 0),
  -- O bônus do dia é pego uma vez por dia; guardar a data é o que dispensa zerar nada à meia-noite.
  bonus_claimed_on date,
  since date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gamification_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  accesses integer not null default 0 check (accesses >= 0),
  online_minutes integer not null default 0 check (online_minutes between 0 and 1440),
  primary key (user_id, day)
);

create index gamification_days_day_idx on public.gamification_days (day desc);

alter table public.gamification_profiles enable row level security;
alter table public.gamification_days enable row level security;

-- A ficha é de quem a tem. A posição no ranking é contagem sobre a tabela inteira, e por isso sai da função
-- abaixo, que roda com os direitos do dono, em vez de uma policy que abrisse a ficha de todo mundo.
create policy gamification_profiles_select on public.gamification_profiles
  for select to authenticated using (user_id = (select auth.uid()));

create policy gamification_days_select on public.gamification_days
  for select to authenticated using (user_id = (select auth.uid()));

create trigger gamification_profiles_set_updated_at
  before update on public.gamification_profiles
  for each row execute function public.set_updated_at();

-- Registrar a entrada do dia: cria a ficha na primeira vez, soma um acesso e os minutos online. Escrita num
-- lugar só, porque contagem de acesso feita pela tela seria contagem que a tela pode inventar.
create or replace function public.record_access(p_minutes integer default 0)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;

  if p_minutes < 0 or p_minutes > 1440 then
    raise exception 'Tempo online inválido';
  end if;

  insert into public.gamification_profiles (user_id) values (v_uid)
  on conflict (user_id) do nothing;

  insert into public.gamification_days (user_id, day, accesses, online_minutes)
  values (v_uid, v_today, 1, p_minutes)
  on conflict (user_id, day)
  do update set
    accesses = public.gamification_days.accesses + 1,
    online_minutes = least(1440, public.gamification_days.online_minutes + p_minutes);
end;
$$;

-- O bônus do dia: pego uma vez, e a segunda tentativa devolve falso em vez de somar de novo.
create or replace function public.claim_daily_bonus(p_points integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_updated integer;
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;

  if p_points < 1 or p_points > 1000 then
    raise exception 'Pontuação inválida';
  end if;

  update public.gamification_profiles
  set points = points + p_points, bonus_claimed_on = v_today
  where user_id = v_uid and (bonus_claimed_on is null or bonus_claimed_on < v_today);

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

-- A posição entre todos: contada aqui dentro para ninguém precisar ler a ficha alheia. Devolve também o
-- ritmo diário, que é o que o bloco do painel mostra ao lado do total.
create or replace function public.gamification_summary()
returns table (points integer, rank integer, daily_points integer, bonus_claimed_today boolean, since date)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;

  return query
  select
    p.points,
    (1 + (select count(*) from public.gamification_profiles other where other.points > p.points))::integer,
    (p.points / greatest(1, (v_today - p.since) + 1))::integer,
    coalesce(p.bonus_claimed_on = v_today, false),
    p.since
  from public.gamification_profiles p
  where p.user_id = v_uid;
end;
$$;

revoke execute on function public.record_access(integer) from public, anon;
revoke execute on function public.claim_daily_bonus(integer) from public, anon;
revoke execute on function public.gamification_summary() from public, anon;

grant execute on function public.record_access(integer) to authenticated;
grant execute on function public.claim_daily_bonus(integer) to authenticated;
grant execute on function public.gamification_summary() to authenticated;
