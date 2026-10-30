-- Os domínios do portfólio numa lista (2026-10-29, a pedido: "em domínios, uma interface semelhante à da
-- Cloudflare, para o cliente colocar a URL do domínio dele e acessar o portfólio direto por ela").
--
-- Até aqui a equipe tinha um domínio só, numa coluna de `organizations`. Quem tem domínio próprio quase sempre
-- quer dois endereços chegando ao mesmo lugar (o raiz e o `www`), e a tela nova lista domínios como o painel da
-- Cloudflare: cada um com a situação dele, conferido por conta própria. A coluna antiga fica, sem uso, até a
-- próxima limpeza; o que estava nela vem para cá.

create table public.organization_domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Um nome de domínio só, em minúsculas, sem protocolo nem caminho. Único na casa inteira: duas equipes no
  -- mesmo endereço não teriam como dizer qual portfólio servir.
  domain text not null unique
    check (
      domain = lower(domain)
      and char_length(domain) <= 253
      and domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
    ),
  -- Quando o DNS foi conferido apontando para a casa. Nulo é "cadastrado, mas ainda não confere": o domínio só
  -- serve o portfólio depois disto, senão qualquer um apontaria um domínio e a casa serviria sem perguntar.
  verified_at timestamptz,
  -- A última conferência e o que ela achou, para a tela dizer por que ainda não confere sem conferir de novo.
  checked_at timestamptz,
  check_error text check (check_error is null or char_length(check_error) <= 300),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index organization_domains_organization_idx on public.organization_domains (organization_id, created_at);

alter table public.organization_domains enable row level security;

-- Ver é de quem é da equipe; cadastrar, conferir e tirar é de dono ou administrador, como o resto do desenho da
-- equipe.
create policy organization_domains_select on public.organization_domains
  for select to authenticated using (public.is_member(organization_id));
create policy organization_domains_write on public.organization_domains
  for all to authenticated
  using (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]) and public.mfa_satisfied())
  with check (public.has_role(organization_id, array['owner', 'admin']::public.member_role[]) and public.mfa_satisfied());

grant select, insert, update, delete on public.organization_domains to authenticated;
grant all on public.organization_domains to service_role;

-- O domínio que já estava cadastrado vem para a lista, com a conferência que tinha.
insert into public.organization_domains (organization_id, domain, verified_at, checked_at)
select id, custom_domain, custom_domain_verified_at, custom_domain_verified_at
from public.organizations
where custom_domain is not null
on conflict (domain) do nothing;

-- A leitura pública passa a achar a equipe por qualquer domínio conferido da lista, além do slug da casa.
create or replace function public.public_portfolio(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'team', jsonb_build_object(
      'name', o.name,
      'slug', o.slug,
      'logoUrl', o.logo_url,
      'bannerUrl', o.banner_url,
      'website', o.website,
      'industry', o.industry
    ),
    'projects', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'description', p.description,
            'url', p.url,
            'coverUrl', p.cover_url,
            'logoUrl', p.logo_url,
            'tags', p.tags,
            'tools', p.tools,
            'hue', p.hue,
            'startedAt', p.started_at,
            'status', p.status
          )
          order by p.started_at desc
        )
        from public.projects p
        where p.organization_id = o.id and p.is_public = true
      ),
      '[]'::jsonb
    )
  )
  from public.organizations o
  where o.archived_at is null
    and (
      o.slug = p_slug
      or exists (
        select 1
        from public.organization_domains d
        where d.organization_id = o.id and d.domain = p_slug and d.verified_at is not null
      )
    )
  limit 1;
$$;

revoke execute on function public.public_portfolio(text) from public, anon, authenticated;
grant execute on function public.public_portfolio(text) to service_role;
