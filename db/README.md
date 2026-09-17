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
| `npm run db:probe` | Prova o schema contra o banco hospedado: cria uma organização de teste, escreve uma linha de cada domínio, confere identificador gerado, `check` que precisa recusar, gatilhos de situação e de organização cruzada, e apaga tudo no fim |

## Regras de segurança do banco

- Toda tabela em `public` nasce com RLS ativa e policies explícitas. Sem policy, ninguém acessa.
- Policies usam `(select auth.uid())` e as funções `is_member`, `has_role`, `mfa_satisfied`.
- Toda tabela de domínio tem `organization_id` e policy baseada em `public.is_member(organization_id)`.
- Funções `security definer` sempre com `set search_path = ''` e tudo qualificado com schema.
- `anon` não executa função nenhuma por padrão (migração `security/…revoke_anon…`). Se uma página pública precisar, faça `grant execute` explícito naquela função.
- Tokens (convites, links públicos) são salvos como hash, nunca em claro.
- Tabela cujo conteúdo o cliente não pode escrever nasce **sem policy de escrita**, e a gravação passa por função `security definer` com a checagem de papel dentro. É o caso de cobrança: `organization_subscriptions` e `plan_entitlements` só mudam por função, e `sync_subscription` é revogada até de `authenticated`. Contrato completo na seção Cobrança de `src/docs/structure.md`.
- Função nova precisa de `grant execute` explícito para cada papel que vai chamar (`authenticated`, e `service_role` quando o servidor chamar pela chave secreta). O revoke de `public` das migrações de segurança tirou o execute implícito de todos, então esquecer o grant quebra em runtime e não na migração.
- Nunca alterar migração aplicada. Nunca criar objeto pelo painel sem depois rodar `db:pull`. Depois de migrar, rodar `db:types` e commitar.

## O identificador que a pessoa lê

`ORC-2026-0042` não sai de `max + 1` nem de sequência do Postgres: o primeiro repetiria número assim que
alguém apagasse um registro, e o segundo não sabe separar organização de organização. Quem gera é
`reference_counters` (organização, domínio, ano) mais `next_reference`, e cada tabela ganha o gatilho
genérico `set_reference('<dominio>', '<PREFIXO>')`. A coluna tem padrão vazio de propósito: é o gatilho que
preenche, e o padrão é o que diz isso ao tipo gerado.

## Vínculo entre domínios

Toda chave estrangeira entre tabelas de domínio tem um gatilho `assert_same_organization(tabela, coluna)`.
Sem ele, alguém com acesso a dois times ligaria um projeto de um ao cliente do outro, e a RLS não perceberia,
porque cada linha, sozinha, está certa.

## Tokens de link público

Orçamento, cada parte de um contrato e cobrança guardam **só o `sha256`** do token. O token em si é derivado
no servidor (`lib/security/share-token.ts`) de um segredo em `SHARE_LINK_SECRET` mais o id e a versão da
linha, então ele nunca chega ao Postgres em claro e mesmo assim o link pode ser mostrado de novo a qualquer
momento. Revogar é somar um na versão. A leitura pública é função `security definer` concedida só a
`service_role`; `anon` não tem policy de select em tabela nenhuma.
