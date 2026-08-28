create or replace function public.create_invite(
  p_organization_id uuid,
  p_email text,
  p_role public.member_role default 'member'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_token text;
begin
  if not public.has_role(p_organization_id, array['owner', 'admin']::public.member_role[]) then
    raise exception 'Sem permissão para convidar nesta organização';
  end if;

  if p_role = 'owner' then
    raise exception 'Convite não pode ter papel owner';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail inválido';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  delete from public.organization_invites
  where organization_id = p_organization_id and email = v_email and accepted_at is null;

  insert into public.organization_invites (organization_id, email, role, token_hash, invited_by)
  values (
    p_organization_id,
    v_email,
    p_role,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    (select auth.uid())
  );

  return v_token;
end;
$$;

create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite public.organization_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;

  select * into v_invite
  from public.organization_invites
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and accepted_at is null
    and expires_at > now();

  if not found then
    raise exception 'Convite inválido ou expirado';
  end if;

  if v_invite.email <> v_email then
    raise exception 'Este convite foi enviado para outro e-mail';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_invite.organization_id, v_uid, v_invite.role)
  on conflict (organization_id, user_id) do nothing;

  update public.organization_invites set accepted_at = now() where id = v_invite.id;

  update public.profiles
  set current_organization_id = v_invite.organization_id
  where id = v_uid and current_organization_id is null;

  return v_invite.organization_id;
end;
$$;

create or replace function public.set_current_org(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_member(p_organization_id) then
    raise exception 'Sem acesso a esta organização';
  end if;

  update public.profiles
  set current_organization_id = p_organization_id
  where id = (select auth.uid());
end;
$$;

revoke execute on function public.create_invite(uuid, text, public.member_role) from public, anon;
revoke execute on function public.accept_invite(text) from public, anon;
revoke execute on function public.set_current_org(uuid) from public, anon;
