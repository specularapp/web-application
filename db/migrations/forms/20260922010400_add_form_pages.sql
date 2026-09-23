alter table public.intake_form_questions
  add column page smallint not null default 0 check (page >= 0 and page <= 59);

drop index if exists public.intake_form_questions_form_idx;
create index intake_form_questions_form_idx
  on public.intake_form_questions (form_id, page, position);

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
        'profileField', q.profile_field,
        'label', q.label,
        'description', q.description,
        'placeholder', q.placeholder,
        'required', q.required,
        'options', q.options,
        'page', q.page,
        'position', q.position
      ) order by q.page, q.position, q.created_at)
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

revoke execute on function public.intake_form_by_token(text) from public, anon, authenticated;
grant execute on function public.intake_form_by_token(text) to service_role;

comment on column public.intake_form_questions.page is
  'Página do fluxo público em que a pergunta aparece, iniciando em zero.';
