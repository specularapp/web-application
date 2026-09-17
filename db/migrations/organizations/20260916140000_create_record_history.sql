-- O histórico de um registro: quem mexeu, o quê e quando.
--
-- Uma tabela só para todos os domínios, e não uma por domínio, porque a pergunta é a mesma em toda ficha
-- ("o que mudou aqui?") e a linha "Histórico" já existe no leque do cliente, do item de catálogo, do projeto
-- e da automação. Com uma tabela por domínio, a quinta cópia da mesma leitura divergiria da primeira.
--
-- O que ela **não** é: a linha do tempo de um contrato ou de uma cobrança. Aquelas contam o caminho do
-- documento (enviado, visto, assinado, pago) e são parte da regra dele; esta conta a edição do cadastro.
-- São perguntas diferentes e por isso continuam separadas.

create type public.history_action as enum ('created', 'updated', 'archived', 'restored', 'deleted');

create type public.record_kind as enum ('client', 'catalog', 'project', 'task', 'quote', 'contract', 'charge', 'opportunity', 'automation');

create table public.record_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  record_type public.record_kind not null,
  /* Sem chave estrangeira de propósito: o histórico sobrevive ao registro. Apagar um cliente não pode apagar
     a prova de que ele existiu e de quem o apagou, que é metade do motivo de haver histórico. */
  record_id uuid not null,
  actor_id uuid references auth.users (id) on delete set null,
  action public.history_action not null,
  /** O que aconteceu, em uma linha, já escrito: "Mudou o telefone e a cidade". */
  summary text not null check (char_length(summary) between 1 and 300),
  /**
   * Campo a campo, para a ficha mostrar o de e o para. Lista de `{ field, label, from, to }`, fechada pelo
   * zod antes de entrar; aqui só se garante que é lista, e não objeto solto.
   */
  changes jsonb not null default '[]'::jsonb check (jsonb_typeof(changes) = 'array'),
  at timestamptz not null default now()
);

create index record_history_record_idx on public.record_history (organization_id, record_type, record_id, at desc);
create index record_history_org_idx on public.record_history (organization_id, at desc);

alter table public.record_history enable row level security;

create policy record_history_select on public.record_history
  for select to authenticated
  using (public.is_member(organization_id));

-- Sem policy de escrita: histórico que a tela pode escrever é histórico que a tela pode inventar. Quem grava
-- é a função abaixo, chamada pelo serviço do domínio dentro da mesma operação que mudou o registro.
create or replace function public.log_record_event(
  p_organization_id uuid,
  p_record_type public.record_kind,
  p_record_id uuid,
  p_action public.history_action,
  p_summary text,
  p_changes jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_member(p_organization_id) then
    raise exception 'Sem acesso a esta organização';
  end if;

  insert into public.record_history (organization_id, record_type, record_id, actor_id, action, summary, changes)
  values (
    p_organization_id,
    p_record_type,
    p_record_id,
    (select auth.uid()),
    p_action,
    p_summary,
    coalesce(p_changes, '[]'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.log_record_event(uuid, public.record_kind, uuid, public.history_action, text, jsonb) from public, anon;
grant execute on function public.log_record_event(uuid, public.record_kind, uuid, public.history_action, text, jsonb) to authenticated;
