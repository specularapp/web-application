-- IA: a conversa do assistente e o consumo do ciclo. A conversa é de quem a teve, e não da equipe inteira:
-- ela costuma citar cliente, valor e prazo, e um time de dez não precisa ler a pergunta que o outro fez.

create type public.ai_role as enum ('person', 'assistant');
create type public.ai_answer_state as enum ('thinking', 'writing', 'done', 'stopped');

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_conversations_user_idx on public.ai_conversations (user_id, updated_at desc);
create index ai_conversations_organization_idx on public.ai_conversations (organization_id);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role public.ai_role not null,
  content text not null default '' check (char_length(content) <= 32000),
  -- O que foi junto da pergunta e fica nela, os registros que a resposta leu e os passos do pensamento: três
  -- listas curtas de forma livre, fechadas pelo zod de `schemas.ts` antes de entrarem.
  files jsonb not null default '[]'::jsonb check (jsonb_typeof(files) = 'array'),
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  voice_url text check (public.text_len_ok(voice_url, 1, 800)),
  voice_seconds integer check (voice_seconds is null or (voice_seconds > 0 and voice_seconds <= 7200)),
  state public.ai_answer_state,
  created_at timestamptz not null default now(),
  constraint ai_messages_voice_pair check ((voice_url is null) = (voice_seconds is null))
);

create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

-- O consumo do ciclo, por organização: o teto sai do plano, então aqui só se conta o que foi usado e quando
-- a contagem zera. Uma linha por ciclo, e não um contador que alguém precisa lembrar de zerar.
create table public.ai_usage (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  period_start date not null,
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, period_start)
);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage enable row level security;

create policy ai_conversations_select on public.ai_conversations
  for select to authenticated
  using (user_id = (select auth.uid()) and public.is_member(organization_id));
create policy ai_conversations_insert on public.ai_conversations
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_write(organization_id));
create policy ai_conversations_update on public.ai_conversations
  for update to authenticated
  using (user_id = (select auth.uid()) and public.can_write(organization_id))
  with check (user_id = (select auth.uid()) and public.can_write(organization_id));
create policy ai_conversations_delete on public.ai_conversations
  for delete to authenticated
  using (user_id = (select auth.uid()) and public.is_member(organization_id));

create policy ai_messages_select on public.ai_messages
  for select to authenticated
  using (exists (
    select 1 from public.ai_conversations c
    where c.id = conversation_id and c.user_id = (select auth.uid())
  ));
create policy ai_messages_insert on public.ai_messages
  for insert to authenticated
  with check (
    public.can_write(organization_id)
    and exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );

-- O consumo é lido pelo widget do topo e escrito só pelo servidor, que é quem sabe que a chamada ao modelo
-- saiu: sem isso, bastaria um pedido à API para zerar o próprio gasto.
create policy ai_usage_select on public.ai_usage
  for select to authenticated using (public.is_member(organization_id));

create trigger ai_messages_conversation_same_organization
  before insert or update of conversation_id, organization_id on public.ai_messages
  for each row execute function public.assert_same_organization('ai_conversations', 'conversation_id');

create trigger ai_conversations_set_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();

-- Uma pergunta consumida: soma no ciclo em curso e devolve quanto já foi, para a chamada decidir se ainda
-- cabe antes de falar com o modelo.
create or replace function public.consume_ai_credit(p_organization_id uuid, p_amount integer default 1)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period date := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
  v_used integer;
begin
  if p_amount < 1 then
    raise exception 'Consumo precisa ser positivo';
  end if;

  insert into public.ai_usage (organization_id, period_start, used)
  values (p_organization_id, v_period, p_amount)
  on conflict (organization_id, period_start)
  do update set used = public.ai_usage.used + p_amount, updated_at = now()
  returning used into v_used;

  return v_used;
end;
$$;

revoke execute on function public.consume_ai_credit(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_credit(uuid, integer) to service_role;
