create type public.approval_status as enum ('draft', 'pending', 'approved', 'changes_requested', 'rejected', 'closed');
create type public.approval_source_type as enum ('url', 'images');
create type public.approval_decision_type as enum ('approved', 'changes_requested', 'rejected');

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reference text not null,
  project_id uuid not null references public.projects (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '' check (char_length(description) <= 1200),
  status public.approval_status not null default 'draft',
  share_token_hash text not null unique,
  share_token_version smallint not null default 1 check (share_token_version > 0),
  expires_at timestamptz not null default now() + interval '90 days',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference)
);

create table public.approval_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  approval_id uuid not null references public.approval_requests (id) on delete cascade,
  version_number smallint not null check (version_number > 0),
  title text not null check (char_length(title) between 2 and 120),
  notes text not null default '' check (char_length(notes) <= 2000),
  source_type public.approval_source_type not null,
  preview_url text check (preview_url is null or char_length(preview_url) between 4 and 800),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (approval_id, version_number),
  constraint approval_versions_source check (
    (source_type = 'url' and preview_url is not null) or (source_type = 'images' and preview_url is null)
  )
);

create table public.approval_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  version_id uuid not null references public.approval_versions (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  url text not null check (char_length(url) between 4 and 800),
  position smallint not null default 0 check (position >= 0),
  created_at timestamptz not null default now()
);

create table public.approval_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  approval_id uuid not null references public.approval_requests (id) on delete cascade,
  version_id uuid not null references public.approval_versions (id) on delete cascade,
  decision public.approval_decision_type not null,
  feedback text check (feedback is null or char_length(feedback) <= 3000),
  respondent_name text check (public.text_len_ok(respondent_name, 2, 80)),
  created_at timestamptz not null default now(),
  unique (version_id)
);

create index approval_requests_organization_idx on public.approval_requests (organization_id, created_at desc);
create index approval_requests_project_idx on public.approval_requests (project_id, created_at desc);
create index approval_versions_request_idx on public.approval_versions (approval_id, version_number desc);
create index approval_assets_version_idx on public.approval_assets (version_id, position);
create index approval_decisions_request_idx on public.approval_decisions (approval_id, created_at desc);

alter table public.approval_requests enable row level security;
alter table public.approval_versions enable row level security;
alter table public.approval_assets enable row level security;
alter table public.approval_decisions enable row level security;

create policy approval_requests_select on public.approval_requests for select to authenticated using (public.is_member(organization_id));
create policy approval_requests_write on public.approval_requests for all to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));
create policy approval_versions_select on public.approval_versions for select to authenticated using (public.is_member(organization_id));
create policy approval_versions_write on public.approval_versions for all to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));
create policy approval_assets_select on public.approval_assets for select to authenticated using (public.is_member(organization_id));
create policy approval_assets_write on public.approval_assets for all to authenticated using (public.can_write(organization_id)) with check (public.can_write(organization_id));
create policy approval_decisions_select on public.approval_decisions for select to authenticated using (public.is_member(organization_id));

create trigger approval_requests_project_same_organization before insert or update of project_id, organization_id on public.approval_requests for each row execute function public.assert_same_organization('projects', 'project_id');
create trigger approval_requests_task_same_organization before insert or update of task_id, organization_id on public.approval_requests for each row execute function public.assert_same_organization('tasks', 'task_id');
create trigger approval_requests_client_same_organization before insert or update of client_id, organization_id on public.approval_requests for each row execute function public.assert_same_organization('clients', 'client_id');
create trigger approval_versions_request_same_organization before insert or update of approval_id, organization_id on public.approval_versions for each row execute function public.assert_same_organization('approval_requests', 'approval_id');
create trigger approval_assets_version_same_organization before insert or update of version_id, organization_id on public.approval_assets for each row execute function public.assert_same_organization('approval_versions', 'version_id');
create trigger approval_decisions_request_same_organization before insert or update of approval_id, organization_id on public.approval_decisions for each row execute function public.assert_same_organization('approval_requests', 'approval_id');
create trigger approval_decisions_version_same_organization before insert or update of version_id, organization_id on public.approval_decisions for each row execute function public.assert_same_organization('approval_versions', 'version_id');
create trigger approval_requests_set_reference before insert on public.approval_requests for each row execute function public.set_reference('approval', 'APR');
create trigger approval_requests_set_updated_at before update on public.approval_requests for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('approval-files', 'approval-files', true, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

create policy approval_files_read on storage.objects for select to anon, authenticated using (bucket_id = 'approval-files');
create policy approval_files_insert on storage.objects for insert to authenticated with check (bucket_id = 'approval-files' and public.can_manage_org_file(name));
create policy approval_files_update on storage.objects for update to authenticated using (bucket_id = 'approval-files' and public.can_manage_org_file(name)) with check (bucket_id = 'approval-files' and public.can_manage_org_file(name));
create policy approval_files_delete on storage.objects for delete to authenticated using (bucket_id = 'approval-files' and public.can_manage_org_file(name));

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
      from public.approval_versions v where v.approval_id = a.id
    ), '[]'::jsonb)
  )
  from public.approval_requests a
  join public.projects p on p.id = a.project_id
  join public.organizations o on o.id = a.organization_id
  where a.share_token_hash = p_token_hash and a.status <> 'closed' and a.expires_at > now()
  limit 1;
$$;

create or replace function public.submit_approval_decision(
  p_token_hash text,
  p_version_id uuid,
  p_decision public.approval_decision_type,
  p_feedback text,
  p_respondent_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_approval public.approval_requests%rowtype;
  v_version public.approval_versions%rowtype;
begin
  select * into v_approval from public.approval_requests
  where share_token_hash = p_token_hash and status not in ('closed', 'draft') and expires_at > now()
  for update;
  if v_approval.id is null then raise exception 'Esta aprovação não está mais disponível'; end if;

  select * into v_version from public.approval_versions where id = p_version_id and approval_id = v_approval.id;
  if v_version.id is null then raise exception 'Versão inválida'; end if;
  if p_decision <> 'approved' and char_length(btrim(coalesce(p_feedback, ''))) < 2 then
    raise exception 'Explique o que precisa ser alterado';
  end if;
  if char_length(coalesce(p_feedback, '')) > 3000 then raise exception 'O feedback está muito longo'; end if;
  if p_respondent_name is not null and char_length(btrim(p_respondent_name)) not between 2 and 80 then raise exception 'Informe um nome válido'; end if;

  insert into public.approval_decisions (organization_id, approval_id, version_id, decision, feedback, respondent_name)
  values (v_approval.organization_id, v_approval.id, v_version.id, p_decision, nullif(btrim(coalesce(p_feedback, '')), ''), nullif(btrim(coalesce(p_respondent_name, '')), ''))
  on conflict (version_id) do update set decision = excluded.decision, feedback = excluded.feedback, respondent_name = excluded.respondent_name, created_at = now();

  update public.approval_requests set status = p_decision::text::public.approval_status where id = v_approval.id;
  return jsonb_build_object('approvalId', v_approval.id, 'organizationId', v_approval.organization_id);
end;
$$;

revoke execute on function public.approval_by_token(text) from public, anon, authenticated;
revoke execute on function public.submit_approval_decision(text, uuid, public.approval_decision_type, text, text) from public, anon, authenticated;
grant execute on function public.approval_by_token(text) to service_role;
grant execute on function public.submit_approval_decision(text, uuid, public.approval_decision_type, text, text) to service_role;

comment on table public.approval_requests is 'Pedidos públicos de aprovação de entregas ligados a projetos e tarefas.';
comment on table public.approval_versions is 'Revisões numeradas de cada pedido de aprovação.';
comment on table public.approval_assets is 'Imagens públicas anexadas a uma revisão para avaliação do cliente.';
comment on table public.approval_decisions is 'Decisão e observações do cliente para uma revisão específica.';
