-- A associação com o cadastro não é dado privado e o servidor precisa dela para devolver erro por campo
-- antes da função transacional tentar gravar um nome curto ou um texto maior que a coluna do cliente.
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

revoke execute on function public.intake_form_by_token(text) from public, anon, authenticated;
grant execute on function public.intake_form_by_token(text) to service_role;
