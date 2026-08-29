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

- Inter (`--font-sans`) como principal, Geist Mono (`--font-mono`) só para código, Playfair Display (`--font-serif`) para títulos editoriais. Todas via `next/font`.
- Número é sempre Inter: `numeric` no `Text` liga `tabular-nums` e força `--font-body`, mesmo sobre `font="code"`. Nada de trocar de família para alinhar algarismo.
- Use `--font-body`, `--font-code` e `--font-display`, que já incluem os fallbacks.
- Escala de tipos da Apple: caption 2 e 1, footnote, subheadline, callout, body, headline, title 3 a 1 e large title.
- Tracking sai do tamanho, não do gosto: `--tracking-tightest` (-0.06em) de 22px para cima, `--tracking-tighter` (-0.04em) entre 16px e 20px, `--tracking-tight` (-0.02em) até 15px. Texto grande precisa de mais aperto que texto pequeno.

### Controles

- Altura e respiro em `--control-height-*` e `--control-padding-*`, nos tamanhos `sm`, `md` e `lg`.
- `--touch-target` garante 44px em ponteiro grosso. O helper `controlMetrics` de `src/components/ui/styles.ts` aplica os três de uma vez.
- Cor de botão e de controle sai de variáveis locais (`--button-background`, `--button-foreground`, `--button-border`), definidas por `data-variant` e sobrescritas por prop quando precisar de cor sob medida.
- Botão cobre a família inteira por prop: texto puro, `iconStart`, `iconEnd`, `iconOnly` (quadrado, exposto como `IconButton` com `label` obrigatório) e `locked` com `plan`, que anexa a etiqueta do plano sem tirar o clique, para o clique levar ao upgrade.

### Campos de formulário

- Fonte com piso de 16px por `fieldMetrics`. Abaixo disso o iOS dá zoom ao focar, e a escala de tipos tem tamanhos de 13 e 15px, então o piso não é opcional.
- Rótulo, caixa do campo e dica compartilham a mesma borda esquerda, sem recuo óptico. O rótulo recuado até o texto digitado foi testado e descartado: parece deslocado.
- Campo de texto não tem indicador de foco, por decisão de produto. É desvio consciente de `rules.md`, que exige foco visível: quem navega por teclado perde a referência de onde está. Botão e link mantêm o anel.
- Máscara sai da prop `mask` do `Input`, com os padrões em `src/lib/masks.ts`: `cpf`, `cnpj`, `document` (troca de CPF para CNPJ ao passar de 11 dígitos), `phone` (fixo ou celular pelo comprimento), `cep`, `date`, `currency`, `percent` e `integer`. Nunca escrever regex de máscara solta em feature.
- Máscara numérica preenche a partir do centavo: o valor bruto é a sequência de dígitos e a formatação divide por 100 com `Intl.NumberFormat` em pt-BR. Digitar 1, 2, 3 dá R$ 0,01, R$ 0,12, R$ 1,23. É por isso que dinheiro vai para o banco em centavos inteiros: o campo já entrega assim.
- Máscara de tamanho variável (telefone, documento) usa `NumberFormatBase` com `format` por função, nunca `PatternFormat` com padrão trocado por estado. `PatternFormat` corta o dígito que passa do número de marcadores do padrão atual, então com o padrão de 10 dígitos o 11º nunca chega e celular fica impossível de digitar.
- O anel de foco some, mas o estado de erro fica: borda vermelha desenhada pelo cornerKit.
- Unidade fica fora do valor: `R# Estrutura e stack

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

- Inter (`--font-sans`) como principal, Geist Mono (`--font-mono`) só para código, Playfair Display (`--font-serif`) para títulos editoriais. Todas via `next/font`.
- Número é sempre Inter: `numeric` no `Text` liga `tabular-nums` e força `--font-body`, mesmo sobre `font="code"`. Nada de trocar de família para alinhar algarismo.
- Use `--font-body`, `--font-code` e `--font-display`, que já incluem os fallbacks.
- Escala de tipos da Apple: caption 2 e 1, footnote, subheadline, callout, body, headline, title 3 a 1 e large title.
- Tracking sai do tamanho, não do gosto: `--tracking-tightest` (-0.06em) de 22px para cima, `--tracking-tighter` (-0.04em) entre 16px e 20px, `--tracking-tight` (-0.02em) até 15px. Texto grande precisa de mais aperto que texto pequeno.

### Controles

- Altura e respiro em `--control-height-*` e `--control-padding-*`, nos tamanhos `sm`, `md` e `lg`.
- `--touch-target` garante 44px em ponteiro grosso. O helper `controlMetrics` de `src/components/ui/styles.ts` aplica os três de uma vez.
- Cor de botão e de controle sai de variáveis locais (`--button-background`, `--button-foreground`, `--button-border`), definidas por `data-variant` e sobrescritas por prop quando precisar de cor sob medida.
- Botão cobre a família inteira por prop: texto puro, `iconStart`, `iconEnd`, `iconOnly` (quadrado, exposto como `IconButton` com `label` obrigatório) e `locked` com `plan`, que anexa a etiqueta do plano sem tirar o clique, para o clique levar ao upgrade.

### Campos de formulário

- Fonte com piso de 16px por `fieldMetrics`. Abaixo disso o iOS dá zoom ao focar, e a escala de tipos tem tamanhos de 13 e 15px, então o piso não é opcional.
- Campo de texto não tem indicador de foco, por decisão de produto. É desvio consciente de `rules.md`, que exige foco visível: quem navega por teclado perde a referência de onde está. Botão e link mantêm o anel.
- Máscara sai da prop `mask` do `Input`, com os padrões em `src/lib/masks.ts`: `cpf`, `cnpj`, `document` (troca de CPF para CNPJ ao passar de 11 dígitos), `phone` (fixo ou celular pelo comprimento), `cep`, `date`, `currency`, `percent` e `integer`. Nunca escrever regex de máscara solta em feature.
- Máscara numérica preenche a partir do centavo: o valor bruto é a sequência de dígitos e a formatação divide por 100 com `Intl.NumberFormat` em pt-BR. Digitar 1, 2, 3 dá R$ 0,01, R$ 0,12, R$ 1,23. É por isso que dinheiro vai para o banco em centavos inteiros: o campo já entrega assim.
- Máscara de tamanho variável (telefone, documento) usa `NumberFormatBase` com `format` por função, nunca `PatternFormat` com padrão trocado por estado. `PatternFormat` corta o dígito que passa do número de marcadores do padrão atual, então com o padrão de 10 dígitos o 11º nunca chega e celular fica impossível de digitar.
 e `%` são um `FieldAffix` em semibold ao lado do controle, e o campo guarda só o número. Texto dentro de `input` não aceita peso parcial, então o afixo tem que ser elemento próprio.
- Data é seleção, não digitação: `DatePicker` sobre o `react-day-picker`, com mês e ano em lista. O popover vai por portal para o `body`, porque dentro do campo ele cairia no contexto de empilhamento do cornerKit e ficaria atrás do campo seguinte. Posição por `fixed`, abaixo quando cabe e acima quando não cabe. A máscara `date` continua para quem precisa digitar.
- `FieldShell` é o invólucro comum de todo campo: borda, raio por tamanho, estado inválido e desabilitado. `Input` e `DatePicker` só põem o controle dentro. O canto é `corner-shape: squircle` nativo, não cornerKit: motivo em `libs.md`.
- A legenda do calendário (mês e ano) é nossa, via `components.MonthCaption` do `react-day-picker` com `useDayPicker().goToMonth`. O `captionLayout="dropdown"` da lib usa `<select>` nativo, e a lista de um select é desenhada pelo sistema: não aceita fonte, raio, sombra nem cor. O `CaptionDropdown` é um listbox de verdade (`role="listbox"`, `aria-activedescendant`, setas, Home, End, Enter, Escape), com a opção atual marcada e rolada para a vista ao abrir.
- Quando o `Select` de formulário for construído, ele nasce desse listbox, não de outro. Hoje ele mora dentro de `date-picker/` porque só o calendário usa; ao segundo uso, sai para `components/ui/listbox/`.
- Barra de rolagem interna é sempre `thinScrollbar` de `src/components/ui/styles.ts`: 6px, trilho transparente, polegar em `--color-fill-quaternary` que escurece no hover. Vale para listbox, tabela e qualquer painel que rola dentro de si; a rolagem da página fica com a barra do sistema.
- Rolar item para a vista dentro de um painel é `scrollTop` no próprio painel, nunca `scrollIntoView`: esse rola todos os ancestrais, e num popover fixo isso arrasta a página inteira.
- O calendário é todo neutro: hoje leva anel fino em `--color-separator`, selecionado leva `--color-brand`, foco leva `--color-label`. O acento azul fica de fora dessa parte por decisão de produto.
- Pílula com fundo semitransparente **não** leva borda no cornerKit. Ele desenha a borda por cima do preenchimento, e dois alfas iguais empilhados viram um anel mais escuro na beirada. Sem borda ele recorta por `clip-path`, e o foco vai para dentro com `outline-offset: -2px`.
- A bolha de erro fica **sempre acima** do campo, e não é gosto. O cornerKit põe `isolation: isolate` em todo elemento com borda, então cada campo é um contexto de empilhamento próprio, pintado na ordem do DOM. Bolha para baixo cai por trás do campo seguinte e some. Para cima, ela cobre o campo anterior, que já foi pintado.
- `Tooltip`: Geist Mono em footnote (13px) com peso medium, respiro de 8 por 12, raio `--radius-md` e canto nativo. Um só `--bubble-radius` alimenta o raio da bolha, o recuo da seta e o alinhamento, então mudar o raio não desalinha nada.
- A seta do `Tooltip` cai no centro do gatilho por geometria, não por medição: a bolha alinhada ao fim tem a borda a `raio + metade da seta` do centro do gatilho, e a seta fica a `raio` da borda da bolha. Os dois números se cancelam e o centro coincide em qualquer largura de gatilho.
- Preenchimento automático não pinta o campo: o `reset.css` cobre o fundo do navegador com `box-shadow` inset em `--field-background`, que cada campo declara com a própria superfície.
- O controle vive dentro de um `<span>` que carrega borda, raio e squircle, porque `input` não aceita filho e o cornerKit quebraria a borda nele.

### Cantos

- Superelipse da Apple pelo cornerKit, obrigatório em todo canto arredondado. `squircle("lg")` de `src/lib/corners.ts` devolve os atributos e o `SquircleProvider` do layout raiz aplica. Contrato e armadilhas em `src/docs/libs.md`.
- `border-radius` continua declarado no CSS: é o que aparece antes do JS e o fallback onde o cornerKit não desenha.
- `globals.css` aplica `corner-shape: squircle` em `[data-squircle]`, que é o caminho nativo em Chromium 139+ e some sozinho onde não há suporte. Pílula e círculo não recebem `data-squircle` e ficam no `round`, que já é o padrão do CSS: não precisam declarar nada.
- Escala em passos de 4px para o encaixe concêntrico: xs 4, sm 8, md 12, lg 16, xl 20, 2xl 28. A regra da Apple é raio interno igual ao externo menos o padding, e nessa escala a conta sempre cai em outro token (20 menos 8 dá 12, 16 menos 4 dá 12).
- **Canto de dentro é sempre concêntrico.** Nada aninhado escolhe raio próprio: ele sai do raio do pai menos o padding que os separa. No CSS é `calc(var(--corner) - var(--pad))`, no TS é `concentric(raioDoPai, espacamento)` de `src/lib/corners.ts`. Quando os dois convivem, o mesmo número alimenta o `border-radius` e o `data-squircle-radius`, senão o fallback e o desenho do cornerKit discordam.
- Botão é o exemplo da casa: raio 20 no tamanho `md` e `padding-block` de 8 dão etiqueta interna de 12, que é outro token da escala. É por isso que a escala anda de 4 em 4.
- Botão só de ícone tem escala própria (`--icon-button-radius-*` e `iconButtonCornerRadius`), com o raio em exatamente metade do lado: 18 em 36, 22 em 44, 26 em 52. É o máximo que a superelipse aceita antes do clamp, e dá o formato de ícone do iOS. Passar disso não arredonda mais, só faz o CSS e o cornerKit divergirem.
- Nesse botão o lado é fixo (`width` e `height`, não `min-`), o padding é zero e o glifo é 45% da altura por `calc`, então a proporção do ícone é idêntica nos três tamanhos.

### Containers aninhados

- `Surface` é o container da casa. Empilhe à vontade: a profundidade sozinha define raio e padding, por seletor descendente no CSS Module. Ninguém passa nível nem faz conta no ponto de uso.

| nível | raio | padding | raio interno |
| --- | --- | --- | --- |
| 1 | 40 | 16 | 24 |
| 2 | 24 | 12 | 12 |
| 3 | 12 | 8 | 4 |
| 4 e além | 4 | 8 | 4 |

- A escada é concêntrica de verdade, não aproximação: em toda linha o raio interno é o externo menos o padding, e o resultado cai sempre num token existente. Só fecha assim por causa dos valores da escala (4, 8, 12, 20, 24, 32); mexer num deles quebra a corrente.
- O raio interno é o externo **menos** o padding, nunca mais. O arco do pai tem centro em (R, R); o filho recuado por P tem centro em (P + Ri, P + Ri). Para os centros baterem, Ri = R − P. Somar o padding empurra o centro do filho para dentro e desalinha: com pai 24 e padding 16, somar erra o centro em 32px.
- Por isso padding folgado se resolve **subindo o raio do pai**, não o do filho. O nível 1 usa `--radius-3xl` (40) justamente para caber 16 de padding e ainda sobrar 24 de raio interno.
- `Surface` não declara `data-squircle-radius`. O `SquircleProvider` lê o `border-radius` computado e preenche o atributo antes de aplicar. Assim o CSS continua sendo a fonte única do raio mesmo com o cornerKit precisando de pixel, e a escada funciona em qualquer profundidade sem duplicar número em TS.
- Quem precisa de raio fixo e conhecido (Button, Table, Kbd) continua declarando o atributo, que tem prioridade sobre a leitura.

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
