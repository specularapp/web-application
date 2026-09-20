-- Domínio próprio do portfólio e a leitura pública dele (2026-09-17, a pedido das páginas pendentes).
--
-- O portfólio já tinha endereço (`/p/<slug>`) e projetos marcados como públicos, mas não tinha leitura: a
-- página devolvia nulo. E "Domínio" era item do menu sem coluna no banco. As duas coisas nascem juntas
-- porque são a mesma pergunta ("por onde o cliente chega ao portfólio?"), com duas respostas: o slug da
-- casa e, no plano Pro, um domínio da própria equipe apontado por CNAME.

alter table public.organizations
  add column custom_domain text unique
    check (
      custom_domain is null
      or (
        custom_domain = lower(custom_domain)
        and char_length(custom_domain) <= 253
        and custom_domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
      )
    ),
  /* Quando o CNAME foi conferido. Nulo é "apontado, mas ainda não confere": o domínio só serve o portfólio
     depois disto, senão qualquer um apontaria um domínio para a casa e ela serviria sem perguntar. */
  add column custom_domain_verified_at timestamptz;

-- A leitura pública: os dados da equipe que aparecem no topo e os projetos públicos, por slug ou por
-- domínio verificado. Só o que é público sai daqui; cliente, valor, prazo e equipe do projeto ficam de fora.
-- `service_role` só, como as outras leituras públicas: `anon` não tem select em tabela nenhuma, e a página
-- passa pela chave secreta com teto de requisições por origem.
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
    and (o.slug = p_slug or (o.custom_domain = p_slug and o.custom_domain_verified_at is not null))
  limit 1;
$$;

revoke execute on function public.public_portfolio(text) from public, anon, authenticated;
grant execute on function public.public_portfolio(text) to service_role;
