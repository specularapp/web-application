-- O cartão de vendedor do documento mostra quem vende por inteiro (2026-10-26, a pedido: "preencher todas as
-- informações do vendedor"): além do nome e do rosto, o cargo e o e-mail do perfil. O link público lê pela
-- função, então ela passa a levar os dois.
create or replace function public.quote_by_token(p_token_hash text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'quote', to_jsonb(q) - 'share_token_hash' - 'share_token_version',
    'issuer', jsonb_build_object(
      'name', o.name,
      'logoUrl', o.logo_url,
      'website', o.website,
      'email', o.email,
      'phone', o.phone,
      'city', o.city,
      'state', o.state
    ),
    'owner', jsonb_build_object(
      'name', coalesce(p.full_name, p.email, 'Equipe'),
      'avatarUrl', p.avatar_url,
      'email', p.email,
      'role', nullif(btrim(p.headline), '')
    ),
    'lines', coalesce(
      (select jsonb_agg(to_jsonb(l) order by l.position, l.created_at) from public.quote_lines l where l.quote_id = q.id),
      '[]'::jsonb
    )
  )
  from public.quotes q
  join public.organizations o on o.id = q.organization_id
  left join public.profiles p on p.id = q.owner_id
  where q.share_token_hash = p_token_hash
    and q.status <> 'draft'
  limit 1;
$$;

revoke execute on function public.quote_by_token(text) from public, anon, authenticated;
grant execute on function public.quote_by_token(text) to service_role;
