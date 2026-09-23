-- Acompanhamento público de projeto e formulários enviados ao cliente. Os dois links usam a mesma
-- arquitetura dos documentos públicos: o navegador recebe o token, o banco guarda somente o SHA-256 e
-- apenas o servidor, depois do limite por IP, pode chamar as funções abaixo.

alter table public.projects
  add column tracking_token_hash text unique,
  add column tracking_token_version smallint not null default 1 check (tracking_token_version > 0),
  add column tracking_expires_at timestamptz,
  add column tracking_viewed_at timestamptz;

create type public.intake_form_status as enum ('draft', 'published', 'closed');
create type public.intake_question_type as enum (
  'short_text', 'long_text', 'email', 'phone', 'single_choice', 'multiple_choice', 'date'
);
create type public.intake_profile_field as enum (
  'name', 'email', 'phone', 'company', 'role', 'city', 'website', 'about'
);

create table public.intake_forms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reference text not null,
  project_id uuid not null references public.projects (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '' check (char_length(description) <= 1200),
  status public.intake_form_status not null default 'draft',
  submit_label text not null default 'Enviar respostas' check (char_length(submit_label) between 2 and 40),
  success_title text not null default 'Respostas enviadas' check (char_length(success_title) between 2 and 80),
  success_message text not null default 'Recebemos suas informações. A equipe já pode continuar o projeto.' check (char_length(success_message) between 2 and 500),
  consent_text text not null default 'Concordo com o uso destas informações para cadastro, contato e execução do projeto.' check (char_length(consent_text) between 20 and 1000),
  share_token_hash text not null unique,
  share_token_version smallint not null default 1 check (share_token_version > 0),
  expires_at timestamptz not null default now() + interval '90 days',
  published_at timestamptz,
  closed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference)
);

create table public.intake_form_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  form_id uuid not null references public.intake_forms (id) on delete cascade,
  type public.intake_question_type not null,
  profile_field public.intake_profile_field,
  label text not null check (char_length(label) between 2 and 160),
  description text not null default '' check (char_length(description) <= 500),
  placeholder text not null default '' check (char_length(placeholder) <= 120),
  required boolean not null default false,
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  position smallint not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index intake_form_questions_profile_field_idx
  on public.intake_form_questions (form_id, profile_field)
  where profile_field is not null;
create index intake_forms_organization_idx on public.intake_forms (organization_id, created_at desc);
create index intake_forms_project_idx on public.intake_forms (project_id, created_at desc);
create index intake_form_questions_form_idx on public.intake_form_questions (form_id, position);

create table public.intake_form_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  form_id uuid not null references public.intake_forms (id) on delete restrict,
  project_id uuid not null references public.projects (id) on delete restrict,
  client_id uuid references public.clients (id) on delete set null,
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  respondent_name text check (public.text_len_ok(respondent_name, 2, 80)),
  respondent_email text check (respondent_email is null or (respondent_email = lower(respondent_email) and respondent_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(respondent_email) <= 120)),
  respondent_phone text check (respondent_phone is null or respondent_phone ~ '^\d{10,11}$'),
  consent_text text not null,
  consented_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index intake_form_submissions_form_idx on public.intake_form_submissions (form_id, created_at desc);
create index intake_form_submissions_client_idx on public.intake_form_submissions (client_id, created_at desc);

alter table public.intake_forms enable row level security;
alter table public.intake_form_questions enable row level security;
alter table public.intake_form_submissions enable row level security;

create policy intake_forms_select on public.intake_forms
  for select to authenticated using (public.is_member(organization_id));
create policy intake_forms_write on public.intake_forms
  for all to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));
create policy intake_form_questions_select on public.intake_form_questions
  for select to authenticated using (public.is_member(organization_id));
create policy intake_form_questions_write on public.intake_form_questions
  for all to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));
create policy intake_form_submissions_select on public.intake_form_submissions
  for select to authenticated using (public.is_member(organization_id));
create policy intake_form_submissions_write on public.intake_form_submissions
  for all to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));

create trigger intake_forms_project_same_organization
  before insert or update of project_id, organization_id on public.intake_forms
  for each row execute function public.assert_same_organization('projects', 'project_id');
create trigger intake_forms_client_same_organization
  before insert or update of client_id, organization_id on public.intake_forms
  for each row execute function public.assert_same_organization('clients', 'client_id');
create trigger intake_questions_form_same_organization
  before insert or update of form_id, organization_id on public.intake_form_questions
  for each row execute function public.assert_same_organization('intake_forms', 'form_id');
create trigger intake_submissions_form_same_organization
  before insert or update of form_id, organization_id on public.intake_form_submissions
  for each row execute function public.assert_same_organization('intake_forms', 'form_id');
create trigger intake_submissions_project_same_organization
  before insert or update of project_id, organization_id on public.intake_form_submissions
  for each row execute function public.assert_same_organization('projects', 'project_id');
create trigger intake_submissions_client_same_organization
  before insert or update of client_id, organization_id on public.intake_form_submissions
  for each row execute function public.assert_same_organization('clients', 'client_id');

create trigger intake_forms_set_reference
  before insert on public.intake_forms
  for each row execute function public.set_reference('form', 'FOR');
create trigger intake_forms_set_updated_at
  before update on public.intake_forms
  for each row execute function public.set_updated_at();
create trigger intake_form_questions_set_updated_at
  before update on public.intake_form_questions
  for each row execute function public.set_updated_at();

-- A página de acompanhamento não expõe tarefas, comentários, orçamento nem pessoas da equipe. Ela recebe
-- o projeto e somente a distribuição agregada das tarefas pelas etapas escolhidas para esse projeto.
create or replace function public.project_tracking_by_token(p_token_hash text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'project', jsonb_build_object(
      'reference', p.reference,
      'name', p.name,
      'description', p.description,
      'status', p.status,
      'progress', p.progress,
      'startedAt', p.started_at,
      'dueAt', p.due_at,
      'updatedAt', p.updated_at,
      'coverUrl', p.cover_url,
      'logoUrl', p.logo_url,
      'hue', p.hue,
      'clientName', c.name
    ),
    'organization', jsonb_build_object(
      'name', o.name,
      'logoUrl', o.logo_url,
      'website', o.website,
      'email', o.email,
      'phone', o.phone,
      'city', o.city,
      'state', o.state
    ),
    'stages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', s.name,
        'hue', s.hue,
        'glyph', s.glyph,
        'kind', s.kind,
        'position', ps.position,
        'taskCount', (select count(*) from public.tasks t where t.project_id = p.id and t.stage_id = s.id)
      ) order by ps.position)
      from public.project_stages ps
      join public.task_stages s on s.id = ps.stage_id
      where ps.project_id = p.id
    ), '[]'::jsonb)
  )
  from public.projects p
  join public.organizations o on o.id = p.organization_id
  left join public.clients c on c.id = p.client_id
  where p.tracking_token_hash = p_token_hash
    and p.tracking_expires_at > now()
  limit 1;
$$;

create or replace function public.mark_project_tracking_viewed(p_token_hash text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.projects
  set tracking_viewed_at = coalesce(tracking_viewed_at, now())
  where tracking_token_hash = p_token_hash and tracking_expires_at > now();
$$;

-- O formulário público recebe somente a configuração visual e as perguntas. `client_id`, hash, usuário e
-- contadores ficam de fora, mesmo quando o link foi preparado para uma pessoa específica.
create or replace function public.intake_form_by_token(p_token_hash text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'form', jsonb_build_object(
      'reference', f.reference,
      'title', f.title,
      'description', f.description,
      'submitLabel', f.submit_label,
      'successTitle', f.success_title,
      'successMessage', f.success_message,
      'consentText', f.consent_text,
      'expiresAt', f.expires_at
    ),
    'project', jsonb_build_object(
      'name', p.name,
      'reference', p.reference,
      'description', p.description,
      'logoUrl', p.logo_url,
      'coverUrl', p.cover_url,
      'hue', p.hue
    ),
    'organization', jsonb_build_object(
      'name', o.name,
      'logoUrl', o.logo_url,
      'website', o.website,
      'email', o.email
    ),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'type', q.type,
        'label', q.label,
        'description', q.description,
        'placeholder', q.placeholder,
        'required', q.required,
        'options', q.options,
        'position', q.position
      ) order by q.position, q.created_at)
      from public.intake_form_questions q where q.form_id = f.id
    ), '[]'::jsonb)
  )
  from public.intake_forms f
  join public.projects p on p.id = f.project_id
  join public.organizations o on o.id = f.organization_id
  where f.share_token_hash = p_token_hash
    and f.status = 'published'
    and f.expires_at > now()
  limit 1;
$$;

-- Valida novamente no banco, cria ou atualiza o cliente pelos campos mapeados e grava a resposta e o
-- consentimento em uma transação. A validação de formato e das perguntas obrigatórias também acontece no
-- servidor TypeScript, para devolver mensagens por campo; a função mantém as garantias quando outro cliente
-- da API chamar a mesma regra.
create or replace function public.submit_intake_form(
  p_token_hash text,
  p_answers jsonb,
  p_consent boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_form public.intake_forms%rowtype;
  v_client uuid;
  v_name text;
  v_email text;
  v_phone text;
  v_company text;
  v_role text;
  v_city text;
  v_website text;
  v_about text;
  v_submission uuid;
begin
  if not p_consent then raise exception 'É preciso aceitar o uso das informações para enviar'; end if;
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'Respostas inválidas'; end if;

  select * into v_form from public.intake_forms
  where share_token_hash = p_token_hash and status = 'published' and expires_at > now()
  for update;
  if v_form.id is null then raise exception 'Este formulário não está mais disponível'; end if;

  if exists (
    select 1 from public.intake_form_questions q
    where q.form_id = v_form.id and q.required
      and (not p_answers ? q.id::text or nullif(btrim(p_answers ->> q.id::text), '') is null)
  ) then raise exception 'Preencha todas as perguntas obrigatórias'; end if;

  select
    max(case when q.profile_field = 'name' then nullif(btrim(p_answers ->> q.id::text), '') end),
    max(case when q.profile_field = 'email' then lower(nullif(btrim(p_answers ->> q.id::text), '')) end),
    max(case when q.profile_field = 'phone' then regexp_replace(coalesce(p_answers ->> q.id::text, ''), '\D', '', 'g') end),
    max(case when q.profile_field = 'company' then nullif(btrim(p_answers ->> q.id::text), '') end),
    max(case when q.profile_field = 'role' then nullif(btrim(p_answers ->> q.id::text), '') end),
    max(case when q.profile_field = 'city' then nullif(btrim(p_answers ->> q.id::text), '') end),
    max(case when q.profile_field = 'website' then nullif(btrim(p_answers ->> q.id::text), '') end),
    max(case when q.profile_field = 'about' then nullif(btrim(p_answers ->> q.id::text), '') end)
  into v_name, v_email, v_phone, v_company, v_role, v_city, v_website, v_about
  from public.intake_form_questions q where q.form_id = v_form.id;
  v_phone := nullif(v_phone, '');

  v_client := v_form.client_id;
  if v_client is null and v_email is not null then
    select id into v_client from public.clients
    where organization_id = v_form.organization_id and lower(email) = v_email
    order by created_at limit 1;
  end if;

  if v_client is not null then
    update public.clients set
      name = coalesce(v_name, name), email = coalesce(v_email, email), phone = coalesce(v_phone, phone),
      company = coalesce(v_company, company), role = coalesce(v_role, role), city = coalesce(v_city, city),
      website = coalesce(v_website, website), about = coalesce(v_about, about)
    where id = v_client and organization_id = v_form.organization_id;
  elsif v_name is not null then
    insert into public.clients (organization_id, name, email, phone, company, role, city, website, about)
    values (v_form.organization_id, v_name, v_email, v_phone, v_company, v_role, v_city, v_website, v_about)
    returning id into v_client;
  end if;

  insert into public.intake_form_submissions (
    organization_id, form_id, project_id, client_id, answers,
    respondent_name, respondent_email, respondent_phone, consent_text, consented_at
  ) values (
    v_form.organization_id, v_form.id, v_form.project_id, v_client, p_answers,
    v_name, v_email, v_phone, v_form.consent_text, now()
  ) returning id into v_submission;

  return jsonb_build_object('submissionId', v_submission, 'clientId', v_client, 'organizationId', v_form.organization_id);
end;
$$;

revoke execute on function public.project_tracking_by_token(text) from public, anon, authenticated;
revoke execute on function public.mark_project_tracking_viewed(text) from public, anon, authenticated;
revoke execute on function public.intake_form_by_token(text) from public, anon, authenticated;
revoke execute on function public.submit_intake_form(text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.project_tracking_by_token(text) to service_role;
grant execute on function public.mark_project_tracking_viewed(text) to service_role;
grant execute on function public.intake_form_by_token(text) to service_role;
grant execute on function public.submit_intake_form(text, jsonb, boolean) to service_role;

comment on table public.intake_forms is 'Formulários públicos ligados a um projeto e enviados ao cliente.';
comment on table public.intake_form_questions is 'Perguntas ordenadas do formulário e seu vínculo opcional com o cadastro do cliente.';
comment on table public.intake_form_submissions is 'Respostas recebidas, com o texto do consentimento aceito e a data da concordância.';
