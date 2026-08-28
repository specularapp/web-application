# Banco de dados

Tudo que é banco vive aqui. Fonte da verdade: `db/migrations/<dominio>/`. A pasta plana que o Supabase CLI exige (`db/supabase/migrations`) é gerada por `npm run db:sync`, ignorada no git e nunca editada à mão.

## Estrutura

```
db/
  README.md
  migrations/                         fonte da verdade, uma pasta por domínio
    auth/
      20260827000001_profiles.sql
    organizations/
      20260827000002_create_tables.sql
      20260827000003_add_policies.sql
      20260827000004_create_functions.sql
    security/
      20260827000005_revoke_anon_function_execute.sql
  supabase/
    config.toml                       auth, MFA, provedores, redirects
    migrations/                       gerado (db:sync), ignorado no git
    seed.sql                          dados iniciais para ambiente local
```

Com 300 migrações você abre a pasta do domínio e vê só a história dele, em ordem. O histórico global aplicado está em `npm run db:status`.

## Nomenclatura

Arquivo: `<versao>_<acao>.sql` dentro de `migrations/<dominio>/`

- `versao`: 14 dígitos UTC (`YYYYMMDDHHMMSS`), gerada por `db:new`. Garante ordem global e não colide entre pessoas.
- `dominio`: pasta em `src/features` (auth, organizations, crm, clients, quotes, contracts, billing, projects, portfolio, resume, finance, automations, ai, gamification, settings) ou `security` para regras transversais.
- `acao`: verbo curto em inglês: `create_tables`, `add_column_x`, `add_policies`, `create_functions`.

No ledger gerado o nome vira `<versao>_<dominio>_<acao>.sql`. O Supabase só registra a versão, então mover ou renomear a parte textual não quebra nada; a versão nunca muda.

## Ordem dentro de cada migração

1. Tabelas e colunas
2. Índices
3. `enable row level security` e policies
4. Funções
5. Triggers
6. Grants e revokes

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run db:new -- <dominio> <acao>` | Cria `db/migrations/<dominio>/<versao>_<acao>.sql` vazio |
| `npm run db:push` | Sincroniza e aplica as pendentes (`-- --dry-run` para só listar) |
| `npm run db:status` | Lista aplicadas e pendentes |
| `npm run db:pull -- <dominio>` | Traz mudança feita no painel e já salva na pasta do domínio |
| `npm run db:types` | Regenera `src/types/database.ts` |
| `npm run db:sync` | Só regenera a pasta plana do CLI |
| `npm run db:config-push` | Envia o `config.toml` para o projeto |
| `npm run db:link` | Primeira vez, após `npx supabase login` |

## Regras de segurança do banco

- Toda tabela em `public` nasce com RLS ativa e policies explícitas. Sem policy, ninguém acessa.
- Policies usam `(select auth.uid())` e as funções `is_member`, `has_role`, `mfa_satisfied`.
- Toda tabela de domínio tem `organization_id` e policy baseada em `public.is_member(organization_id)`.
- Funções `security definer` sempre com `set search_path = ''` e tudo qualificado com schema.
- `anon` não executa função nenhuma por padrão (migração `security/…revoke_anon…`). Se uma página pública precisar, faça `grant execute` explícito naquela função.
- Tokens (convites, links públicos) são salvos como hash, nunca em claro.
- Nunca alterar migração aplicada. Nunca criar objeto pelo painel sem depois rodar `db:pull`. Depois de migrar, rodar `db:types` e commitar.
