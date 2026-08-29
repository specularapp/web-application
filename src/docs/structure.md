# Estrutura e stack

## Stack

| Tecnologia | Papel |
| --- | --- |
| Next.js 16 (App Router) + TypeScript | Front e camada de servidor (Server Components, Server Actions, Route Handlers) |
| Supabase | Autenticação, banco Postgres com RLS, storage |
| Redis (ioredis) | Cache de leituras repetidas e rate limit |
| Resend | E-mail transacional e de automação |
| Stripe | Pagamentos e recebimentos (o doc original dizia "strapi", que é um CMS; a integração é Stripe) |
| n8n | Automações e integrações externas via webhooks |
| Emotion (`@emotion/styled`) | Styled components, consumindo os tokens CSS |
| cmdk | Paleta de comandos |
| Phosphor Icons | Ícones |
| zod | Validação de entrada no servidor |
| ESLint + jsx-a11y | Qualidade e acessibilidade |

## Organização de pastas

```
src/
  app/                  rotas (apenas roteamento, sem lógica de domínio)
    (marketing)/        site público: home, preços, termos, privacidade
    (auth)/             login, cadastro, recuperação de senha
    (app)/              área autenticada, protegida pelo proxy
    (public)/           páginas compartilháveis com clientes: portfólio, currículo, orçamento, contrato, cobrança
    api/                health e webhooks (stripe, n8n, resend)
    auth/callback/      troca de código do Supabase
    componentes/        vitrine do design system, pública e noindex
  components/
    ui/                 primitivos reutilizáveis (Button, Input, Card)
    layout/             shell da aplicação (Sidebar, Topbar)
    providers/          providers globais (Emotion, tema)
  features/<dominio>/   regra de negócio por domínio: actions, queries, schemas e componentes específicos
  hooks/                hooks compartilhados
  lib/                  clientes das integrações, metadata, env, segurança, utilitários
  styles/               reset.css, tokens.css, globals.css
  types/                tipos globais e tipos gerados do banco
  docs/                 regras, objetivo e estrutura
  proxy.ts              headers, sessão, MFA e proteção de rotas
db/
  README.md             convenções de banco e migrações
  migrations/<dominio>/ fonte da verdade das migrações, por domínio
  supabase/             projeto do Supabase CLI (config, seed; migrations é gerada)
```

## Domínios em `features`

`auth`, `organizations`, `onboarding`, `crm`, `clients`, `quotes`, `contracts`, `billing`, `projects`, `portfolio`, `resume`, `finance`, `automations`, `ai`, `gamification`, `settings`.

## Convenções

- Rotas em português, código em inglês.
- Páginas só compõem componentes de `features` e `components`.
- Estilo sempre com tokens de `styles/tokens.css`. Primitivos sem interação (Text, Stack, Container, Table, Label, Field, Logo...) são Server Components com CSS Modules (`*.module.css` ao lado do componente, variantes por `data-*`), zero JS no cliente. Componentes interativos (Button com loading, Dialog, Switch, Toast...) usam Emotion e `"use client"`. Nada de valores soltos.
- Todo componente novo entra na vitrine `/componentes` com nome e exemplo, conferido nos dois temas.
- Metadados via `createMetadata` em toda página.
- Dados via Server Components e Server Actions. Cache em Redis onde houver leitura repetida.
- Webhooks verificam assinatura. Toda entrada validada com zod no servidor.

## Fluxo de dados

1. Página (Server Component) chama `queries` da feature.
2. `queries` acessam Supabase pelo cliente de servidor, com cache em Redis quando fizer sentido.
3. Mutações passam por `actions` (Server Actions) com validação zod e revalidação por tag.
4. Eventos externos entram por `app/api/webhooks/*`, são verificados e despachados para a feature ou para o n8n.

## Design

### Cores

Paleta de cores do sistema Apple (Human Interface Guidelines, System colors), em `src/styles/tokens.css`:

- Primitivos `--sys-*`: red, orange, yellow, green, mint, teal, cyan, blue, indigo, purple, pink, brown e gray 1 a 6.
- Semânticos `--color-*` seguindo os nomes da Apple: label (4 níveis), placeholder, link, separator, bg (system e grouped, 3 níveis cada) e fill (4 níveis).
- Papéis do produto: `--color-brand` (preto no claro, branco no escuro, igual ao logo), `--color-accent` (system blue), success, warning, danger, info e focus.
- Claro e escuro com `light-dark()`: o tema segue o sistema por padrão e é forçado com `data-theme="light"` ou `data-theme="dark"` no `html`.

### Tipografia

- Inter (`--font-sans`) como principal, Geist Mono (`--font-mono`) para código e números, Playfair Display (`--font-serif`) para títulos editoriais. Todas via `next/font`.
- Use `--font-body`, `--font-code` e `--font-display`, que já incluem os fallbacks.
- Escala de tipos da Apple: caption 2 e 1, footnote, subheadline, callout, body, headline, title 3 a 1 e large title.

### Controles

- Altura e respiro em `--control-height-*` e `--control-padding-*`, nos tamanhos `sm`, `md` e `lg`.
- `--touch-target` garante 44px em ponteiro grosso. O helper `controlMetrics` de `src/components/ui/styles.ts` aplica os três de uma vez.
- Cor de botão e de controle sai de variáveis locais (`--button-background`, `--button-foreground`, `--button-border`), definidas por `data-variant` e sobrescritas por prop quando precisar de cor sob medida.
- Botão cobre a família inteira por prop: texto puro, `iconStart`, `iconEnd`, `iconOnly` (quadrado, exposto como `IconButton` com `label` obrigatório) e `locked` com `plan`, que anexa a etiqueta do plano sem tirar o clique, para o clique levar ao upgrade.

### Cantos

- Superelipse da Apple pelo cornerKit, obrigatório em todo canto arredondado. `squircle("lg")` de `src/lib/corners.ts` devolve os atributos e o `SquircleProvider` do layout raiz aplica. Contrato e armadilhas em `src/docs/libs.md`.
- `border-radius` continua declarado no CSS: é o que aparece antes do JS e o fallback onde o cornerKit não desenha.
- `globals.css` aplica `corner-shape: squircle` em `[data-squircle]`, que é o caminho nativo em Chromium 139+ e some sozinho onde não há suporte. Pílula e círculo não recebem `data-squircle` e ficam no `round`, que já é o padrão do CSS: não precisam declarar nada.
- Escala em passos de 4px para o encaixe concêntrico: xs 4, sm 8, md 12, lg 16, xl 20, 2xl 28. A regra da Apple é raio interno igual ao externo menos o padding, e nessa escala a conta sempre cai em outro token (20 menos 8 dá 12, 16 menos 4 dá 12).
- **Canto de dentro é sempre concêntrico.** Nada aninhado escolhe raio próprio: ele sai do raio do pai menos o padding que os separa. No CSS é `calc(var(--corner) - var(--pad))`, no TS é `concentric(raioDoPai, espacamento)` de `src/lib/corners.ts`. Quando os dois convivem, o mesmo número alimenta o `border-radius` e o `data-squircle-radius`, senão o fallback e o desenho do cornerKit discordam.
- Botão é o exemplo da casa: raio 20 no tamanho `md` e `padding-block` de 8 dão etiqueta interna de 12, que é outro token da escala. É por isso que a escala anda de 4 em 4.
- Botão só de ícone tem escala própria (`--icon-button-radius-*` e `iconButtonCornerRadius`), com o raio em exatamente metade do lado: 18 em 36, 22 em 44, 26 em 52. É o máximo que a superelipse aceita antes do clamp, e dá o formato de ícone do iOS. Passar disso não arredonda mais, só faz o CSS e o cornerKit divergirem.
- Nesse botão o lado é fixo (`width` e `height`, não `min-`), o padding é zero e o glifo é 45% da altura por `calc`, então a proporção do ícone é idêntica nos três tamanhos.

### Marca

Logos em `public/logotipo` (icon, logo e logotipo em preto e branco). O favicon em `src/app/icon.svg` deriva do icon preto e inverte no modo escuro. A imagem Open Graph usa o logotipo branco sobre preto.

## Ecossistema web + mobile (mesmo banco)

Haverá app Android/iOS usando literalmente o mesmo Supabase. Consequências que valem desde já:

1. **Regra de negócio no banco primeiro**: RLS, constraints, funções SQL (RPC) e triggers. Web e mobile falam com o mesmo Postgres e recebem as mesmas garantias.
2. **`service.ts` por feature**: lógica que precisa de segredo de servidor (Stripe, Resend, OpenAI, Redis) fica em `src/features/<dominio>/service.ts`. Server Actions (web) e Route Handlers em `src/app/api/v1/*` (mobile) são adaptadores finos sobre o mesmo service. Nunca duplicar lógica entre os dois.
3. **API para o app**: `src/app/api/v1/*` autentica por `Authorization: Bearer <access_token>` do Supabase usando `createClientFromRequest` em `src/lib/supabase/api.ts`. A RLS continua valendo porque o cliente carrega o JWT do usuário.
4. **Auth compartilhada**: Supabase Auth no mobile (deep link `specular://auth/callback` entra em `additional_redirect_urls` quando o app existir). MFA TOTP usa as mesmas APIs. Apple Sign In passa a ser obrigatório quando houver login social no iOS, então a conta Apple Developer entra junto com o app.
5. **Tipos e validação compartilháveis**: `src/types/database.ts` (gerado) e `src/features/*/schemas.ts` (zod) são o contrato. Se o app for Expo/React Native em TypeScript, esses arquivos migram para um pacote compartilhado em monorepo sem reescrever.
6. **Multi-tenant desde o schema**: organizações e membros modelados no banco antes de qualquer feature, porque o app precisará do mesmo contexto de conta.
