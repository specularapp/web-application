alter table public.approval_versions
  add column if not exists published_at timestamptz;

update public.approval_versions
set published_at = created_at
where published_at is null
  and (
    source_type = 'url'
    or exists (
      select 1 from public.approval_assets asset where asset.version_id = approval_versions.id
    )
  );

create index if not exists approval_versions_published_idx
  on public.approval_versions (approval_id, version_number desc)
  where published_at is not null;

create or replace function public.approval_by_token(p_token_hash text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'approval', jsonb_build_object(
      'reference', a.reference,
      'title', a.title,
      'description', a.description,
      'status', a.status,
      'expiresAt', a.expires_at
    ),
    'project', jsonb_build_object('name', p.name, 'reference', p.reference, 'logoUrl', p.logo_url, 'hue', p.hue),
    'organization', jsonb_build_object('name', o.name, 'logoUrl', o.logo_url, 'website', o.website),
    'versions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id,
        'number', v.version_number,
        'title', v.title,
        'notes', v.notes,
        'sourceType', v.source_type,
        'previewUrl', v.preview_url,
        'createdAt', v.created_at,
        'assets', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'url', x.url, 'position', x.position) order by x.position) from public.approval_assets x where x.version_id = v.id), '[]'::jsonb),
        'decision', (select jsonb_build_object('type', d.decision, 'feedback', d.feedback, 'respondentName', d.respondent_name, 'createdAt', d.created_at) from public.approval_decisions d where d.version_id = v.id limit 1)
      ) order by v.version_number desc)
      from public.approval_versions v
      where v.approval_id = a.id and v.published_at is not null
    ), '[]'::jsonb)
  )
  from public.approval_requests a
  join public.projects p on p.id = a.project_id
  join public.organizations o on o.id = a.organization_id
  where a.share_token_hash = p_token_hash and a.status <> 'closed' and a.expires_at > now()
  limit 1;
$$;

revoke execute on function public.approval_by_token(text) from public, anon, authenticated;
grant execute on function public.approval_by_token(text) to service_role;

comment on column public.approval_versions.published_at is
  'Só expõe a versão ao cliente depois que a URL ou todos os anexos terminam de ser gravados.';
