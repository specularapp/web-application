create type public.client_feedback_status as enum ('pending', 'submitted', 'closed');

create table public.client_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reference text not null,
  project_id uuid not null references public.projects (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  title text not null default 'Como foi trabalhar conosco?' check (char_length(title) between 2 and 120),
  prompt text not null default 'Sua avaliação nos ajuda a melhorar as próximas entregas.' check (char_length(prompt) between 2 and 500),
  status public.client_feedback_status not null default 'pending',
  share_token_hash text not null unique,
  share_token_version smallint not null default 1 check (share_token_version > 0),
  expires_at timestamptz not null default now() + interval '90 days',
  rating smallint check (rating between 1 and 5),
  would_recommend boolean,
  comment text check (comment is null or char_length(comment) <= 1200),
  respondent_name text check (public.text_len_ok(respondent_name, 2, 80)),
  submitted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference),
  unique (project_id),
  constraint client_feedback_submission_complete check (
    (status <> 'submitted') or (rating is not null and would_recommend is not null and submitted_at is not null)
  )
);

create index client_feedback_organization_idx on public.client_feedback (organization_id, created_at desc);
create index client_feedback_status_idx on public.client_feedback (organization_id, status, created_at desc);

alter table public.client_feedback enable row level security;

create policy client_feedback_select on public.client_feedback
  for select to authenticated using (public.is_member(organization_id));
create policy client_feedback_write on public.client_feedback
  for all to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));

create trigger client_feedback_project_same_organization
  before insert or update of project_id, organization_id on public.client_feedback
  for each row execute function public.assert_same_organization('projects', 'project_id');
create trigger client_feedback_client_same_organization
  before insert or update of client_id, organization_id on public.client_feedback
  for each row execute function public.assert_same_organization('clients', 'client_id');
create trigger client_feedback_set_reference
  before insert on public.client_feedback
  for each row execute function public.set_reference('feedback', 'FDB');
create trigger client_feedback_set_updated_at
  before update on public.client_feedback
  for each row execute function public.set_updated_at();

create or replace function public.client_feedback_by_token(p_token_hash text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'feedback', jsonb_build_object(
      'reference', f.reference,
      'title', f.title,
      'prompt', f.prompt,
      'status', f.status,
      'expiresAt', f.expires_at,
      'submittedAt', f.submitted_at
    ),
    'project', jsonb_build_object(
      'name', p.name,
      'reference', p.reference,
      'description', p.description,
      'logoUrl', p.logo_url,
      'hue', p.hue,
      'clientName', c.name
    ),
    'organization', jsonb_build_object(
      'name', o.name,
      'logoUrl', o.logo_url,
      'website', o.website
    )
  )
  from public.client_feedback f
  join public.projects p on p.id = f.project_id
  join public.organizations o on o.id = f.organization_id
  left join public.clients c on c.id = f.client_id
  where f.share_token_hash = p_token_hash
    and f.status <> 'closed'
    and f.expires_at > now()
  limit 1;
$$;

create or replace function public.submit_client_feedback(
  p_token_hash text,
  p_rating smallint,
  p_would_recommend boolean,
  p_comment text,
  p_respondent_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_feedback public.client_feedback%rowtype;
begin
  if p_rating < 1 or p_rating > 5 then raise exception 'Escolha uma nota de 1 a 5'; end if;
  if p_would_recommend is null then raise exception 'Informe se recomendaria o trabalho'; end if;
  if char_length(coalesce(p_comment, '')) > 1200 then raise exception 'O comentário está muito longo'; end if;
  if p_respondent_name is not null and char_length(btrim(p_respondent_name)) not between 2 and 80 then
    raise exception 'Informe um nome válido';
  end if;

  select * into v_feedback from public.client_feedback
  where share_token_hash = p_token_hash and status = 'pending' and expires_at > now()
  for update;
  if v_feedback.id is null then raise exception 'Esta avaliação não está mais disponível'; end if;

  update public.client_feedback set
    rating = p_rating,
    would_recommend = p_would_recommend,
    comment = nullif(btrim(coalesce(p_comment, '')), ''),
    respondent_name = nullif(btrim(coalesce(p_respondent_name, '')), ''),
    status = 'submitted',
    submitted_at = now()
  where id = v_feedback.id;

  return jsonb_build_object('feedbackId', v_feedback.id, 'organizationId', v_feedback.organization_id);
end;
$$;

revoke execute on function public.client_feedback_by_token(text) from public, anon, authenticated;
revoke execute on function public.submit_client_feedback(text, smallint, boolean, text, text) from public, anon, authenticated;
grant execute on function public.client_feedback_by_token(text) to service_role;
grant execute on function public.submit_client_feedback(text, smallint, boolean, text, text) to service_role;

comment on table public.client_feedback is 'Pedidos curtos de avaliação enviados ao cliente ao concluir um projeto.';
