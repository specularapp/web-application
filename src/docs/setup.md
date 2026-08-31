# Setup de serviços e chaves

Aplicação: Specular. Produto em `https://app.specular.com.br`, site de divulgação em `https://specular.com.br`. Chaves vão em `.env.local` (nunca commitado). Modelo em `.env.example`. Valide com `npm run env:check`.

Ordem: Supabase → OpenAI → Resend → Stripe. Redis e n8n ficam para depois.

## 1. Supabase (banco, autenticação e storage)

1. [supabase.com/dashboard](https://supabase.com/dashboard) > New project (região South America, São Paulo). Guarde a senha do banco.
2. Project Settings > API:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key (`sb_publishable_...`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret key (`sb_secret_...`) → `SUPABASE_SECRET_KEY` (só no servidor)
3. Authentication > URL Configuration:
   - Site URL: `https://app.specular.com.br`
   - Redirect URLs: `https://app.specular.com.br/auth/callback` e `http://localhost:3000/auth/callback`

## 2. OpenAI

1. [platform.openai.com/api-keys](https://platform.openai.com/api-keys) > Create new secret key → `OPENAI_API_KEY`
2. Settings > Billing > adicionar crédito (a chave não funciona sem saldo)
3. Modelo padrão `gpt-4o-mini` em `OPENAI_MODEL` (troque sem mexer no código)

## 3. Resend (e-mail)

1. [resend.com/api-keys](https://resend.com/api-keys) > Create API Key (permissão Sending access) → `RESEND_API_KEY`
2. [resend.com/domains](https://resend.com/domains) > Add Domain `specular.com.br` > criar os registros DNS (SPF, DKIM, MX de retorno) > Verify
3. Remetente: `Specular <no-reply@specular.com.br>` → `RESEND_FROM_EMAIL`
4. Só depois de publicar: [resend.com/webhooks](https://resend.com/webhooks) > Add Endpoint `https://app.specular.com.br/api/webhooks/resend` > Signing secret → `RESEND_WEBHOOK_SECRET`

## 4. Stripe (pagamentos)

1. [dashboard.stripe.com](https://dashboard.stripe.com) > ativar a conta (dados da empresa). Trabalhe em modo Test até o lançamento (toggle no topo).
2. Botão **Developers** (canto inferior esquerdo) abre o Workbench > aba **API keys**:
   - Publishable key (`pk_test_...`) → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - Secret key (`sk_test_...`) → `STRIPE_SECRET_KEY`
3. Webhook local (desenvolvimento): instale a [Stripe CLI](https://docs.stripe.com/stripe-cli), rode `stripe login` e depois `stripe listen --forward-to localhost:3000/api/webhooks/stripe`. O comando imprime um `whsec_...` → `STRIPE_WEBHOOK_SECRET`.
4. Webhook de produção (só quando o app estiver publicado): Workbench > aba **Webhooks** > Add destination > Events from your account > endpoint `https://app.specular.com.br/api/webhooks/stripe` > Signing secret → `STRIPE_WEBHOOK_SECRET` do ambiente de produção. Atalho: [dashboard.stripe.com/test/workbench/webhooks](https://dashboard.stripe.com/test/workbench/webhooks).

## 5. Redis (opcional por enquanto)

Redis não é banco. Serve para cache de leituras repetidas e rate limit; o banco é o Supabase. Quando quiser ativar:

1. [console.upstash.com](https://console.upstash.com) > criar conta > Redis > Create Database
2. Nome `specular`, Primary region `sa-east-1` (São Paulo), plano Free > Create
3. Na página do banco > Connect to your database > aba **ioredis** > copiar a URL `rediss://default:SENHA@HOST.upstash.io:6379` → `REDIS_URL`. Não use a URL REST (`https://...upstash.io`), ela é de outro cliente.

Alternativa local: `docker run -p 6379:6379 redis` e `REDIS_URL=redis://localhost:6379`.

## 6. n8n (depois)

1. [n8n.cloud](https://n8n.cloud) ou instância própria > New workflow > nó Webhook > Production URL → `N8N_WEBHOOK_URL`
2. Gerar `N8N_WEBHOOK_SECRET` com `openssl rand -hex 32` e configurar o mesmo valor no n8n (header `x-webhook-secret`) ao chamar `https://app.specular.com.br/api/webhooks/n8n`

## DNS de `specular.com.br`

- raiz (`specular.com.br`) e `www` → hospedagem do Next; o proxy serve só as páginas de divulgação e redireciona o resto para `app`
- `app` → CNAME para a hospedagem do Next (mesmo deploy)
- Registros de e-mail do Resend
- Portfólios com domínio do cliente: CNAME do cliente apontando para `app.specular.com.br` (tratado pelo proxy)

## 7. Autenticação social (GitHub, Google, Apple) e MFA

Callback do Supabase para todos os provedores: `https://bwwgwczwwojkboobwxyo.supabase.co/auth/v1/callback`

### GitHub

1. [github.com/settings/developers](https://github.com/settings/developers) > OAuth Apps > New OAuth App
2. Homepage URL `https://specular.com.br`, Authorization callback URL = callback do Supabase
3. Generate a new client secret. Copiar Client ID e Client Secret.
4. Supabase > Authentication > Sign In / Providers > GitHub > Enable > colar Client ID e Secret > Save

### Google

1. [console.cloud.google.com](https://console.cloud.google.com) > criar projeto `Specular`
2. APIs & Services > OAuth consent screen: tipo External, nome Specular, domínio autorizado `specular.com.br`, e-mails de suporte. Publicar (Publishing status: In production) para não limitar a 100 usuários de teste.
3. APIs & Services > Credentials > Create Credentials > OAuth client ID > Web application
   - Authorized JavaScript origins: `https://app.specular.com.br` e `http://localhost:3000`
   - Authorized redirect URIs: callback do Supabase
4. Supabase > Providers > Google > Enable > Client ID e Client Secret > Save

### Apple (depois, quando houver conta paga)

Exige Apple Developer Program (US$ 99/ano). O segredo expira a cada 6 meses e precisa ser regenerado. Desabilitado no `config.toml` até existir a conta.

1. [developer.apple.com/account](https://developer.apple.com/account) > Certificates, Identifiers & Profiles
2. Identifiers > App ID `com.specular.app` com a capability Sign in with Apple
3. Identifiers > Services ID `com.specular.web` > Sign in with Apple > Configure: Primary App ID = o App ID acima, Domains `bwwgwczwwojkboobwxyo.supabase.co`, Return URLs = callback do Supabase
4. Keys > criar chave com Sign in with Apple > baixar o `.p8` (uma vez só) > anotar Key ID e Team ID (canto superior direito)
5. Gerar o client secret (JWT) com o `.p8`, Key ID, Team ID e Services ID. A doc do Supabase tem o gerador: [supabase.com/docs/guides/auth/social-login/auth-apple](https://supabase.com/docs/guides/auth/social-login/auth-apple)
6. Supabase > Providers > Apple > Enable > Client IDs = `com.specular.web`, Secret Key = JWT gerado > Save

### MFA (autenticador TOTP: Google Authenticator, Microsoft Authenticator, 1Password)

Atenção: o `enroll_enabled = true` do `config.toml` vale só para o ambiente local; o projeto hospedado é configurado no painel. Em 2026-08-30 o enroll estava desligado lá (`mfa_totp_enroll_not_enabled` no /mfa). Caminho: Dashboard > Authentication > Multi-Factor Auth (Advanced) > TOTP > habilitar **Enroll** e **Verify** > Save.

1. Supabase > Authentication > Multi-Factor Auth > TOTP: habilitar Enroll e Verify
2. O código já cobre: cadastro (`enrollTotp`), confirmação (`verifyTotp`), remoção (`unenrollTotp`) em `src/features/auth/actions.ts`
3. O proxy exige o segundo fator em toda rota privada quando o usuário tem autenticador cadastrado (redireciona para `/mfa`)
4. Para tabelas sensíveis, use `public.mfa_satisfied()` nas policies RLS

### Banco: aplicar migrações

Migrações ficam em `db/supabase/migrations` (convenções em `db/README.md`).

```
npx supabase login
npm run db:link
npm run db:push
npm run db:types
```

Alternativa sem CLI: Supabase > SQL Editor > colar o arquivo da migração > Run (depois rode `npm run db:pull` para manter o histórico).

## E-mail de autenticação (SMTP do Resend + templates próprios)

Os templates com a nossa marca estão em `db/supabase/templates/` e já apontados no `config.toml` (vale para o ambiente local). No projeto hospedado é manual:

1. Resend > Domains > verificar o domínio do remetente (`RESEND_FROM_EMAIL`).
2. Supabase > Project Settings > Authentication > SMTP Settings > Enable custom SMTP: host `smtp.resend.com`, porta `465`, usuário `resend`, senha = `RESEND_API_KEY`, sender = `RESEND_FROM_EMAIL`. Sem SMTP próprio o Supabase limita a ~2 e-mails por hora, o que derruba qualquer teste de cadastro.
3. Supabase > Authentication > Emails > colar o HTML de cada arquivo de `db/supabase/templates/` no slot correspondente, com os assuntos da tabela abaixo. Os avisos da seção Security têm um toggle cada: ligar ao colar. Recolar sempre que os arquivos mudarem, porque o painel não lê o repositório.

| Arquivo | Slot no painel | Assunto |
| --- | --- | --- |
| `confirmation.html` | Confirm sign up | Confirme seu e-mail no Specular |
| `invite.html` | Invite user | Você foi convidado para o Specular |
| `magic-link.html` | Magic link or OTP | Seu link de acesso ao Specular |
| `email-change.html` | Change email address | Confirme a troca de e-mail no Specular |a
| `recovery.html` | Reset password | Redefina sua senha do Specular |
| `reauthentication.html` | Reauthentication | Seu código de confirmação do Specular |
| `security-password-changed.html` | Password changed | Sua senha foi alterada |
| `security-email-changed.html` | Email address changed | O e-mail da sua conta foi alterado |
| `security-phone-changed.html` | Phone number changed | O telefone da sua conta foi alterado |
| `security-identity-linked.html` | Sign-in method linked | Nova forma de login na sua conta |
| `security-identity-unlinked.html` | Sign-in method removed | Uma forma de login foi removida |
| `security-mfa-added.html` | MFA method added | Novo fator de verificação na sua conta |
| `security-mfa-removed.html` | MFA method removed | Um fator de verificação foi removido |

O visual é minimalista por decisão de 2026-08-30: fundo branco sem cartão, logo no topo, título e texto soltos, botão preto pequeno quando há ação, rodapé com linha fina, e nenhum texto usa ponto final. Os avisos de Security não têm botão, só texto e um link para revisar a segurança da conta.
4. Supabase > Authentication > URL Configuration: Site URL `https://app.specular.com.br`; Additional Redirect URLs com `http://localhost:3000/auth/callback` e `https://app.specular.com.br/auth/callback`, senão o retorno do OAuth cai no domínio errado.
5. O logo dos e-mails é `public/logotipo/specular-logotipo-black.png` (gerado do SVG; e-mail não renderiza SVG), servido em `https://app.specular.com.br/logotipo/...`. Publicar antes de testar o e-mail em produção.

Os templates de link NÃO usam `{{ .ConfirmationURL }}`: esse endereço aponta direto ao `/verify` do Supabase e o token é de uso único, então scanners de e-mail corporativos (Gmail Workspace, Outlook Safe Links) consomem o link antes do clique da pessoa e o resultado é `otp_expired` na primeira tentativa. Os templates apontam para `{{ .SiteURL }}/confirmar-email?token_hash={{ .TokenHash }}&type=...`, uma página nossa que só chama `verifyOtp` no clique do botão (POST via server action); scanner faz GET e não consome nada. A página precisa estar publicada ANTES de colar os templates no painel. Outras causas de `otp_expired` que continuam valendo: rate limit do SMTP embutido (~2 e-mails/h) e um cadastro novo invalidando o link anterior.
