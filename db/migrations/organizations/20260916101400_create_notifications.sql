-- Notificações: o que a aplicação precisa contar a quem está nela. Por pessoa e por organização, porque o
-- que interessa a quem responde pelo contrato não interessa a quem cuida do quadro, e a lista de um time
-- não aparece quando a pessoa troca para outro.
--
-- Quem escreve é o servidor, pela chave secreta: notificação criada pela sessão seria notificação que a
-- própria tela pode inventar. A única escrita da pessoa é marcar como lida.

create type public.notification_kind as enum ('acao', 'revisao', 'sistema');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.notification_kind not null default 'sistema',
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 300),
  actor_name text check (public.text_len_ok(actor_name, 1, 120)),
  actor_avatar_url text check (public.text_len_ok(actor_avatar_url, 1, 500)),
  action_label text check (public.text_len_ok(action_label, 1, 40)),
  -- Caminho de dentro da aplicação, e nunca endereço externo: a notificação não leva ninguém para fora.
  action_href text check (action_href is null or action_href ~ '^/[A-Za-z0-9/_\-?=&.%]{0,200}$'),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_action_pair check ((action_label is null) = (action_href is null))
);

create index notifications_user_idx on public.notifications (user_id, organization_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id, organization_id) where read_at is null;

alter table public.notifications enable row level security;

create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()) and public.is_member(organization_id));

-- Marcar como lida é a única escrita da pessoa, e ela não pode mexer em mais nada da linha.
create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.notify_member(
  p_organization_id uuid,
  p_user_id uuid,
  p_kind public.notification_kind,
  p_title text,
  p_description text default '',
  p_action_label text default null,
  p_action_href text default null,
  p_actor_name text default null,
  p_actor_avatar_url text default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (
    organization_id, user_id, kind, title, description, action_label, action_href, actor_name, actor_avatar_url
  )
  values (
    p_organization_id, p_user_id, p_kind, p_title, coalesce(p_description, ''),
    p_action_label, p_action_href, p_actor_name, p_actor_avatar_url
  )
  returning id;
$$;

revoke execute on function public.notify_member(uuid, uuid, public.notification_kind, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.notify_member(uuid, uuid, public.notification_kind, text, text, text, text, text, text) to service_role;
