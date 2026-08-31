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
- O anel de foco some, mas o estado de erro fica: borda vermelha no `FieldShell`.
- Unidade fica fora do valor: `R$` e `%` são um `FieldAffix` em semibold ao lado do controle, e o campo guarda só o número. Texto dentro de `input` não aceita peso parcial, então o afixo tem que ser elemento próprio.
- Data é seleção, não digitação: `DatePicker` sobre o `react-day-picker`, com mês e ano em lista. O popover vai por portal para o `body`, porque dentro do campo ele ficaria atrás do campo seguinte, pintado depois na ordem do DOM. Posição por `fixed`, abaixo quando cabe e acima quando não cabe. A máscara `date` continua para quem precisa digitar.
- `FieldShell` é o invólucro comum de todo campo: borda, raio por tamanho, estado inválido e desabilitado. Fundo transparente, o mesmo do botão `outline`, para campo e botão lerem como a mesma família sobre qualquer superfície; no escuro o fundo elevado destoava do botão ao lado. `Input` e `DatePicker` só põem o controle dentro. O canto é `corner-shape: squircle` nativo, declarado direto, e fica fora do recorte do fallback por conter o controle e os afixos.
- No mobile (abaixo de 48rem) o calendário vira **bottom sheet**: fixo na base, largura total, alça no topo, fundo em `--color-scrim`, página travada atrás, células maiores. O popover flutuante depende de medir o gatilho e reagir a rolagem e teclado virtual, o que no celular vira salto e recorte. `useMediaQuery` em `src/hooks` decide, com `useSyncExternalStore` para não divergir na hidratação.
- A legenda do calendário (mês e ano) é nossa, via `components.MonthCaption` do `react-day-picker` com `useDayPicker().goToMonth`. O `captionLayout="dropdown"` da lib usa `<select>` nativo, e a lista de um select é desenhada pelo sistema: não aceita fonte, raio, sombra nem cor. O `CaptionDropdown` é um listbox de verdade (`role="listbox"`, `aria-activedescendant`, setas, Home, End, Enter, Escape), com a opção atual marcada e rolada para a vista ao abrir.
- Esse listbox é o `Listbox` de `components/ui/listbox/`, genérico em `string | number`, com `placement` (`below` ou `above`, que vira dropup e troca o caret) e `prefix` (rótulo curto antes do valor, como "Mostrar 30"). Saiu do calendário no segundo uso, a `Pagination`. Quando o `Select` de formulário for construído, ele nasce desse `Listbox`, não de outro.
- O gatilho do `Listbox` é estilizado por variáveis locais (`--listbox-trigger-height`, `--listbox-trigger-radius`, `--listbox-trigger-background`, `--listbox-trigger-background-hover`), com o visual do calendário como padrão. Quem o embute define as variáveis, sem `className` de fora.
- Ids de opção saem do índice, não do valor: `aria-activedescendant` é um IDREF e valor com espaço quebraria.
- As opções ficam em grid com 2px de respiro (`--space-half`), para o fundo da ativa e da selecionada não colarem uma na outra.
- Barra de rolagem interna é sempre `thinScrollbar` de `src/components/ui/styles.ts`: 6px, trilho transparente, polegar em `--color-fill-quaternary` que escurece no hover. Vale para listbox, tabela e qualquer painel que rola dentro de si; a rolagem da página fica com a barra do sistema.
- Rolar item para a vista dentro de um painel é `scrollTop` no próprio painel, nunca `scrollIntoView`: esse rola todos os ancestrais, e num popover fixo isso arrasta a página inteira.
- O calendário é todo neutro: hoje leva anel fino em `--color-separator`, selecionado leva `--color-brand`, foco leva `--color-label`. O acento azul fica de fora dessa parte por decisão de produto.
- A bolha de erro fica **sempre acima** do campo: para baixo ela cairia atrás do campo seguinte, que é pintado depois na ordem do DOM. Para cima, ela cobre o campo anterior, que já foi pintado.
- `Tooltip`: Geist Mono em footnote (13px) com peso medium, respiro de 8 por 12, raio `--radius-md` e canto nativo. Um só `--bubble-radius` alimenta o raio da bolha, o recuo da seta e o alinhamento, então mudar o raio não desalinha nada.
- A seta do `Tooltip` cai no centro do gatilho por geometria, não por medição: a bolha alinhada ao fim tem a borda a `raio + metade da seta` do centro do gatilho, e a seta fica a `raio` da borda da bolha. Os dois números se cancelam e o centro coincide em qualquer largura de gatilho.
- Preenchimento automático não pinta o campo: o `reset.css` cobre o fundo do navegador com `box-shadow` inset em `--field-background`, que cada campo declara com a própria superfície.
- O controle vive dentro de um `<span>` que carrega borda, raio e squircle, porque `input` é elemento substituído: não aceita filho, nem afixo, nem ícone dentro.
- `Checkbox` segue a mesma ideia: o `input type="checkbox"` nativo fica invisível por cima (opacidade zero, cobrindo o rótulo inteiro), e o quadrado desenhado é um `<span>` de 20px em `display: grid` com o ícone centrado por `place-items`, borda CSS de 1,5px e `corner-shape: squircle` nativo no raio `sm`. O raio `xs` foi testado e parecia quadrado: a superelipse é mais reta que o arco de círculo no mesmo raio, e em 20px isso some. Estado sai de `:has(input:checked)`, `:has(input:indeterminate)`, `:has(input:focus-visible)` e `:has(input:disabled)` no invólucro, que troca variáveis locais; nenhum JS além de escrever `indeterminate`, que só existe como propriedade do DOM. Marcado e indeterminado pintam `--color-brand` com o traço em `--color-bg`, o mesmo par do botão primário. Com `children` o invólucro é `label`; sem, é `span` e quem usa passa `aria-label` ou associa um `Label`.
- `Switch` é o mesmo esqueleto com `input type="checkbox" role="switch"`. Trilho em pílula (`--radius-full`, que por regra não declara canto) de 28 por 64 com 2px de folga, polegar largo de 36 por 24 que desliza por `translate` calculado a partir das próprias variáveis (`largura - polegar - 2 folgas`), então mudar um tamanho não desalinha o outro. `sm` é 20 por 44 com polegar de 24. Ligado é `--color-success`, o verde do sistema, como no iOS; desligado é `--color-fill`. Polegar em `--color-on-accent` (branco nos dois temas, como o iOS) com `--shadow-sm`. `prefers-reduced-motion` desliga a transição do deslize.

### Etiquetas

- `Badge` é a etiqueta de situação, categoria e contagem. Server Component com CSS Module, sem JS.
- **Um matiz gera tudo.** Cada `tone` define só `--badge-hue`; o CSS deriva três cores dele e nenhuma variante escolhe cor própria:
  - `--badge-ink`: matiz misturado com `--color-label` em 70/30. No claro puxa para o preto, no escuro para o branco, então o mesmo cálculo dá contraste AA nos dois temas. Amarelo é o único que precisa de 60/40.
  - `--badge-tint`: matiz em 14% de alfa no claro e 18% no escuro, por `light-dark()` sobre `color-mix()`. Alfa, e não cor opaca, para a etiqueta assentar em qualquer superfície.
  - `--badge-line`: matiz em 36% e 44%, para a borda do contorno.
- Variantes só recombinam as três: `soft` (tinta sobre tint), `solid` (tinta como fundo e `--color-bg` como texto, o mesmo par de `--color-danger-solid` e `--color-on-danger`) e `outline` (tinta sobre transparente com a linha).
- Tons em dois grupos: papéis do produto (`neutral`, `brand`, `accent`, `success`, `warning`, `danger`, `info`) para situação com significado, e a paleta inteira (`red` a `brown`) para categoria em que a cor é arbitrária. `hue` por prop aceita uma cor escolhida pelo usuário, como etiqueta de CRM, sem sair do modelo.
- Tamanhos e raios saem juntos: `sm` 20 de altura e raio 8, `md` 24 e raio 8, `lg` 28 e raio 12. Canto por `squircle()` com `clip` nas variantes sem borda, para o fallback recortar o fundo; `shape="pill"` fica no `round` e não declara nada.
- Só ícone exige `label`, que vira texto para leitor de tela, no mesmo contrato do `IconButton`. O tipo obriga: ou `children`, ou `icon` com `label`.
- Ícone herda `currentColor` e o peso `bold` que casa com o texto semibold, pelo `matchIconWeight` de `components/ui/icons.ts`, compartilhado com o Button. Não existe variante com ponto colorido (dot), por decisão de produto: a cor do texto e do fundo já dizem a situação.
- Etiqueta com remoção (o × do chip) é outro componente, interativo, e não entra aqui.

### Avatar

- `Avatar` recebe `name` e, opcionalmente, `src`. Sem imagem mostra as iniciais (primeira letra da primeira e da última palavra) sobre `--color-fill-tertiary`. Com imagem usa `next/image` com `fill` e `sizes` fixo por tamanho; domínio remoto entra em `remotePatterns` quando o upload existir. Server Component com CSS Module.
- Tamanhos na escala dos controles: `xs` 24, `sm` 36 (`--control-height-sm`), `md` 44, `lg` 52. Círculo por padrão. `shape="squircle"` usa raio em metade do lado, que é a escala do botão de ícone (`--icon-button-radius-*`; `xs` usa `--radius-md`), então avatar e `IconButton` do mesmo tamanho têm o mesmo contorno.
- Canto por `squircleAuto()` quando `shape="squircle"`: nativo onde há `corner-shape`, e no fallback o recorte por `clip-path` entra sozinho porque o avatar já tem `overflow: hidden` para a imagem. O anel do grupo é `box-shadow` no próprio elemento e não é recortado.
- `AvatarGroup` só sobrepõe: cada avatar seguinte entra 8px sobre o anterior, e todos ganham anel de 2px em `--color-bg` por `box-shadow`, que não ocupa layout e não é recortado pelo `overflow` do próprio avatar. Sem contador "+N" por enquanto.

### Toast

- Todo toast tem ícone, título, descrição e um botão de ação, sem botão de fechar. Sem `action` o botão vira "Entendi" e só fecha. Contrato e comportamento em `libs.md`.
- `Toast` em `components/ui/toast/` é só o visual, e por isso aparece estático na vitrine. Fila, timer e posição ficam no `ToastProvider` de `components/providers/toast-provider/`, montado no layout raiz dentro do `EmotionRegistry`. `useToast()` devolve `toast(options)` e `dismiss(id)`.
- Geometria concêntrica: raio `--radius-xl` (24) com padding 12 dá 12 de raio interno, então o botão de ação é `Button size="sm" radius="md"`. Canto nativo declarado direto, como o Tooltip; fora do recorte do fallback porque contém um botão com anel de foco.
- Animação só de `transform` e `opacity`, que o compositor resolve sem layout: entra com `--ease-spring` em `--duration-slow`, sai em `--duration-base`. A saída existe porque `dismiss` primeiro marca `open: false` e só remove 240ms depois. `prefers-reduced-motion` corta as duas.
- Timer por item, com pausa em hover e foco: o efeito começa um `setTimeout` com o tempo restante e, ao pausar, desconta o que passou. Erro (`danger`) não fecha sozinho; os outros fecham em 5s. Escape fecha o toast focado.
- Três visíveis no máximo; o quarto espera na fila e só começa a contar quando aparece. `role="alert"` para erro e atenção, `role="status"` para o resto.
- Canto superior direito no desktop, largura total no topo no mobile com `safe-area-inset-top`. A entrada desce de cima (`translateY` negativo), no sentido de onde o toast vem. Ícone centrado na altura do bloco de texto.

### Paginação

- `Pagination` é controlada: recebe `page`, `pageSize`, `total` e devolve `onPageChange` e `onPageSizeChange`. Quem chama decide se vai para a URL ou para o estado, e volta para a página 1 ao trocar a quantidade. Sem `onPageSizeChange`, o dropup nem aparece.
- Três partes: `Listbox` com `prefix="Mostrar"` e `placement="above"`, faixa "1 a 30 de 720" em `Text` numérico e secundário, e o grupo com página atual em negrito, total em secundário e dois `IconButton` fantasmas separados por `Separator` vertical. A página atual tem leitura completa ("Página 1 de 24") em texto oculto e `aria-live`.
- Geometria na escala do botão de ícone, raio em metade da altura: barra de 44 com raio 22 (`--icon-button-radius-md`) e padding 4; gatilho e grupo de 36 com raio 18 (`--icon-button-radius-sm`). 22 menos 4 dá 18, então o encaixe é concêntrico, e os `IconButton` `sm` de dentro, também com raio 18, casam com o grupo no hover.
- Barra e grupo declaram `corner-shape: squircle` direto, sem `data-squircle`, e ficam fora do recorte do fallback: contêm botões com anel de foco e um dropup que não podem ser cortados. A linha fina vem de `box-shadow` de 1px, que não ocupa layout e mantém a conta 36 em 44.
- Fundo da barra em `--color-fill-quaternary`, translúcido, para assentar em qualquer superfície; gatilho e grupo em `--color-bg-tertiary`, que fica mais claro que a barra nos dois temas.
- Larguras fixas para a barra não pulsar ao navegar: o indicador de página tem 5.5rem centrado (cabe "999 / 999" em algarismo tabular) e a faixa de itens tem no mínimo 12rem. Assim trocar de página ou de quantidade não move o grupo de botões.
- A barra nunca quebra linha (`flex-wrap: nowrap`). Abaixo de 48rem (`MOBILE_QUERY`, por media query em CSS, sem JS) o dropup e a faixa somem e fica só o grupo com página, anterior e próxima. No desktop aparece tudo.

### Cantos

- Todo canto arredondado passa pelo sistema de cantos da casa, sem lib. `squircle("lg")` de `src/lib/corners.ts` emite `data-squircle` e `data-squircle-radius`; `squircleAuto()` emite só `data-squircle` e deixa o raio para o CSS; `squirclePx(n)` para raio fixo fora da escala. `border-radius` continua sempre no CSS: é o fallback e é o que o motor lê quando o raio não vem no atributo.
- Onde existe `corner-shape` (Chromium 139+), `globals.css` aplica `corner-shape: squircle` em `[data-squircle]` e acabou: fundo, borda, sombra, anel de foco e recorte de filhos saem do motor do navegador, sem JS. O motor detecta o suporte com `CSS.supports` e não liga nada.
- Sem `corner-shape` (Safari, Firefox), o motor em `src/lib/squircle/` recorta por `clip-path: path()` com a superelipse (suavização 0,6, a do iOS, pelo algoritmo de cantos suavizados do Figma em `path.ts`). Só recorta quem já recorta (`overflow: hidden` ou `clip`) ou quem pede com `{ clip: true }`. Tudo o mais fica no `round` do `border-radius`. Motivo: recorte cortaria anel de foco de botão e popover que sai do container, que foram exatamente os bugs do cornerKit.
- Elemento com borda nunca é recortado: a borda CSS segue o arco de círculo e o recorte seguiria a superelipse, então ela apareceria quebrada no canto. É por isso que nenhuma variante do fallback desenha borda; borda é sempre CSS.
- Motor (`engine.ts`): um `ResizeObserver` só para todos os elementos, escrita agrupada por `requestAnimationFrame`, cache de caminhos por tamanho e raio, `MutationObserver` para elemento que entra, sai ou troca de atributo, `WeakMap` para o que já foi aplicado. Escrever `clip-path` não muda layout, então não realimenta o observer: sem loop por construção. Nada de `<style>` injetado, então a CSP fica em paz. `SquircleProvider` no layout raiz só liga o motor uma vez.
- Componente client com raio dinâmico usa `useSquircle(raio, clip)` de `src/lib/squircle/use-squircle.ts`, que devolve um ref callback: emite os atributos e registra o elemento, com limpeza ao desmontar.
- Quem declara `corner-shape: squircle` direto no CSS, sem `data-squircle` (FieldShell, Tooltip, Listbox, Pagination, Checkbox, Toast), fica nativo no Chromium e redondo no fallback, de propósito: são elementos com anel de foco, popover ou conteúdo que não pode ser recortado.
- O cornerKit saiu em 2026-08-29 depois de uma sequência de bugs: `<style>` injetado bloqueado pela CSP, fundo repintado por SVG que atrasava e piscava, caixa de 20px do Checkbox virando invisível, borda semitransparente empilhando alfa, um observer por elemento. O nativo cobre o caso principal e o fallback nosso é pequeno, previsível e sem borda.
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
- `Surface` não declara `data-squircle-radius`. No fallback o motor lê o `border-radius` computado. Assim o CSS continua sendo a fonte única do raio e a escada funciona em qualquer profundidade sem duplicar número em TS.
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

## Telas

### Login

- Telas de autenticação são sempre escuras, por decisão de produto. O proxy manda o caminho no header `x-pathname` e o layout raiz põe `data-theme="dark"` no `html` quando `isAuthPath()` (`lib/auth-paths.ts`, a mesma lista que o proxy usa) bate, no servidor, sem flash e sem mexer no cookie de tema. Tentativa descartada: `color-scheme: dark` só no shell não funciona, porque o Chrome resolve o `light-dark()` das variáveis no `:root`, onde elas são declaradas, e não no elemento que as usa. Foi isso também que tirou o quadrado claro que aparecia no fim da tela no mobile: era o fundo do tema claro aparecendo abaixo do conteúdo.
- Rota `/login` no grupo `(auth)`. O `layout.tsx` do grupo envolve toda tela de autenticação no `AuthCard` (`components/layout/auth-card/`), que recebe o `authHero` de `features/auth/banners.ts`: imagem, chamada curta e descrição. A página só compõe `LoginForm` de `features/auth/components/`.
- Fundo animado nos dois layouts, sem imagem nem carrossel (decisão de 2026-08-29): `GradientBlinds` (`components/ui/gradient-blinds/`, WebGL via `ogl`, portado do React Bits), em preto e branco (`--color-bg`, `--sys-gray-2`, `--color-label`) com as cores em tokens no `authHero` de `features/auth/banners.ts`, resolvidas em runtime por um `span` sonda porque o shader precisa de RGB. `mixBlendMode="normal"`: com `lighten` o `backdrop-filter` do cartão mobile não enxergava o canvas e o vidro sumia; sobre fundo preto os dois modos desenham igual. Holofote largo (`spotlightRadius` 2.2) para o gradiente aparecer inteiro sem ponteiro, e órbita automática lenta quando não há movimento por 2,5s (no celular nunca há mouse). Para em `prefers-reduced-motion` (desenha um quadro e fica) e com a aba oculta; `dpr` limitado a 1.5 para não pesar no celular. No desktop preenche a moldura da direita; no mobile é a própria tela, fixo atrás do cartão. O `Carousel` continua em `components/ui` para outro uso.
- Desktop (a partir de 64rem): duas colunas em `3fr 2fr` (60/40), com o conteúdo do login centralizado na coluna maior (`max-width: 32rem`, margem automática). Logo e título centralizados. A coluna direita é a moldura de raio `3xl` com margem 16, o `GradientBlinds` preenchendo por grid (`grid-area: 1 / 1` em todos os filhos, sem `position` no componente para não brigar com o Emotion), um degradê de `--color-scrim` subindo da base por `::after` e, sobre ele, o texto do hero: rótulo "Specular" em Geist Mono, título `title1` em `medium` e descrição `subheadline`, os dois com `--tracking-tight` (-0.02em) como o título da página, tudo em `--color-on-accent`.
- Mobile: o `GradientBlinds` é fundo fixo da tela, o hero fica oculto e o logo fica sozinho no topo, em branco (`--color-brand` trocado por `--color-on-accent` só nesse breakpoint) sobre um degradê fixo de `--color-scrim` que desce do topo até 32% e volta a partir de 55% até a base, para o logo e o cartão assentarem em fundo escuro em qualquer imagem. O formulário fica num cartão de vidro (sem divisor, título só para leitor de tela, respiros de 16): fundo `--color-bg` a 15% com `backdrop-filter: blur(12px)`, translúcido de verdade, deixando as persianas do fundo aparecerem desfocadas atrás dos campos, borda `--color-border`, raio `xl` (24; 40 ficava pesado no Safari, que arredonda sem superelipse), padding 20 e margem 16 das bordas da tela, assentado na base. Substituiu a fusão por gradiente, que dependia da altura da tela para não cair em cima de rótulo. Os botões de opção sobem para a altura `lg` (52px) só no mobile, por CSS sobre `[data-size]`, porque `size` é prop e trocar por media query em JS causaria salto na hidratação. No mobile, botões e campos do login usam raio fixo `--radius-lg` (20): o Safari não tem `corner-shape`, e raio acima de metade da altura (28 em 52, 24 em 44) vira pílula pura lá, o que no iPhone parecia `9999px`. A tela é `100dvh` com `overflow: hidden` em todo tamanho, e o layout raiz põe `data-scroll="locked"` no `html` nas rotas de auth: `globals.css` trava `html` e `body` (`overflow: hidden`, `overscroll-behavior: none`, `body` fixo), o que mata a rolagem elástica do iOS; a lateral é 12 fora e 16 dentro do cartão; o logo fica centrado no espaço que sobra acima do cartão (`grid-template-rows: 1fr auto`).
- Mobile em duas etapas por `data-step` e CSS, sem trocar a árvore: primeiro uma coluna com "Entrar com e-mail e senha" e "Continuar com" Google e GitHub, todos em `outline`; escolhendo e-mail, a coluna some, os campos aparecem e o rodapé "Criar agora" (que já estava na primeira etapa) dá lugar ao texto "Mude a forma de login, voltar", com "voltar" como botão em forma de link. No desktop tudo aparece de uma vez e os elementos só de mobile ficam `display: none` (via invólucro `.mobileOnly`, porque classe de módulo perde do Emotion no próprio botão).
- Opções de entrada (e-mail e provedores) em `size="md"` (44px) com o raio automático de controle, 24, o mesmo do `FieldShell`; o "Entrar" é `size="lg"` (52px) para pesar mais que as opções, por pedido do usuário. Voltar é texto, não botão.
- Provedores: cada botão é um `<form>` com `signInWithOAuth.bind(null, provedor, next)`, então funciona sem JS e o redirecionamento é do servidor. Ícones pelo `BrandIcon` (`components/ui/brand-icon/`): máscara CSS sobre o SVG de `public/brands/<nome>.svg` pintada com `currentColor`, a mesma técnica do `Logo`, então a marca segue a cor do botão nos dois temas. Com `color`, o SVG entra como imagem (`next/image`, sem otimização por ser SVG) na cor original: é o caso do Google, que tem quatro cores. GitHub e Apple são pretos no arquivo, e preto no tema escuro some, então ficam em `currentColor`, que é a versão oficial das duas marcas para fundo escuro. Nunca ícone de marca de outra fonte.
- O divisor "Faça login com e-mail" usa `--color-separator` no texto, a mesma cor das linhas, e sobe 12px para ficar colado à grade de provedores.
- Turnstile com o widget em modo **Invisible** no painel da Cloudflare (decisão de 2026-08-29): nunca desenha nada, então o container fica fora do fluxo (`position: absolute`, 0 por 0), sem cobrar nem o `gap` do grid. O `appearance: "interaction-only"` e o `size: "flexible"` ficam no código como rede de segurança caso o painel volte para Managed. Em desenvolvimento a chave de teste é a invisível (`1x00000000000000000000BB`), que espelha o modo do painel. O botão "Entrar" nasce desabilitado e só libera quando o widget devolve o token (`onVerify`), voltando a travar se expirar. Em desenvolvimento o `.env` usa as chaves de teste da Cloudflare (`1x000...AA`), que sempre passam; as reais ficam comentadas no mesmo arquivo para produção.
- Sem scroll no desktop: `.shell` tem `height: 100dvh` e `overflow: hidden`, e a coluna de conteúdo rola por dentro só se a altura não couber. No mobile o carrossel é `position: fixed`, então o fundo não acompanha a rolagem do cartão.
- Logotipo em 32px e título em `title1`, por pedido de presença. `devIndicators: false` no `next.config.ts` tira o indicador de desenvolvimento do Next, que atrapalhava a leitura da tela.
- Senha: `signInWithPassword` via `useActionState`. Rate limit `auth` por IP, Turnstile quando `TURNSTILE_SECRET_KEY` e `NEXT_PUBLIC_TURNSTILE_SITE_KEY` existem (`hasTurnstile()` em `lib/env.ts`; sem as chaves o widget não monta e a verificação não roda), zod em `signInSchema`, erro genérico "E-mail ou senha incorretos" para não vazar se o e-mail existe. Sucesso redireciona para `next` validado por `nextPathSchema`.
- "Relembrar senha" é comportamento, não enfeite: a action grava o cookie `sp-remember` (`1` ou `0`) e passa `remember` para `createClient`. Com `0`, `scopeToSession` em `lib/supabase/cookies.ts` tira `maxAge` e `expires` dos cookies do Supabase, no servidor e no proxy, então a sessão morre ao fechar o navegador. Com `1` (padrão), fica um ano.
- Erros de OAuth chegam por `?erro=` e viram texto em `features/auth/messages.ts`; o erro da action vem pelo estado. Um só `Text` com `role="alert"` mostra os dois.
- `/auth/callback` entrou em `openPrefixes` no proxy. Antes, sem sessão, o callback era redirecionado para `/login` antes de trocar o código e o OAuth nunca fechava.
- Criar conta (`/cadastro`): mesmo `AuthCard` e mesmas duas etapas do mobile, com `SignUpForm` (`features/auth/components/signup-form.tsx`). O CSS é compartilhado em `auth-form.module.css` e os botões de provedor saíram para `OAuthButtons`, usados pelos dois formulários; nada duplicado. Campos: nome (vira `full_name` nos metadados, que a trigger de `profiles` lê), e-mail e senha com piso de 8 no zod (`signUpSchema`). A action `signUpWithPassword` repete o contrato do login (rate limit, Turnstile, erros amigáveis por `error.code`: conta existente, senha fraca) e chama `supabase.auth.signUp` com `emailRedirectTo` no callback. Com confirmação de e-mail ligada não há sessão na resposta: o formulário troca para o estado "Confirme seu e-mail" com o endereço enviado; se a confirmação estiver desligada, redireciona direto para `next`. Consentimento de Termos e Privacidade em texto com links abaixo do botão.
- E-mails de autenticação com a nossa marca: 13 templates em `db/supabase/templates/`, os 6 de ação (confirmação, convite, magic link, redefinição, troca de e-mail e reautenticação) e os 7 avisos de segurança do painel (senha, e-mail e telefone alterados, forma de login conectada e removida, fator MFA adicionado e removido), todos gerados de um esqueleto único. Visual minimalista por decisão de 2026-08-30: fundo branco sem cartão, logo no topo à esquerda, título e texto soltos, botão preto pequeno só quando há ação, rodapé com linha fina, nenhum texto com ponto final. HTML de e-mail com estilos inline e tabela, logo em PNG (gerado do SVG, e-mail não renderiza SVG). `config.toml` aponta os 6 de ação para o ambiente local; no hospedado é colar tudo no painel e ligar o SMTP do Resend (tabela de slots e assuntos em `setup.md`). Cores literais aqui são exceção consciente: e-mail não tem tema nem tokens.
- Nenhum template de link usa `{{ .ConfirmationURL }}`: esse endereço vai direto ao `/verify` do Supabase e o token é de uso único, então scanner de e-mail corporativo consumia o link antes do clique e a pessoa via `otp_expired` na primeira tentativa. Os links apontam para `/confirmar-email?token_hash={{ .TokenHash }}&type=...` (página no grupo `(auth)`, mesma lista de `publicAuthPaths`, então tema escuro e acesso sem sessão), que mostra um cartão com título por tipo de link e só chama `verifyOtp` no clique do botão, via `confirmEmailWithToken` (server action com rate limit e zod em `token_hash` e `type`). Scanner faz GET e não consome nada. No sucesso a action redireciona para `next` e o proxy assume (primeiro login cai no `/mfa` pelo gate `mfaMissing`); o proxy não expulsa usuário logado do `/confirmar-email`, porque a troca de e-mail confirma com sessão ativa.
- A tela de confirmação do cadastro tem "Reenviar e-mail" (`resendConfirmation`, com rate limit e trava de 30s no botão), e o `/login` lê o fragmento `#error` que o Supabase devolve quando um link antigo falha e explica em português (link expirado ou usado), limpando o hash da URL.
- MFA (`/mfa`): uma rota, dois estados. Com fator TOTP verificado, `MfaVerify` (código de 6 dígitos, verifica sozinho ao completar, "Sair da conta" como saída); sem fator, `MfaEnroll` com o cartão de cadastro: título com os ícones dos autenticadores, QR Code (o `qr_code` do Supabase é SVG em data URL, desenhado como `background-image` num `div role="img"` sobre fundo `--color-on-accent`, porque QR precisa de fundo claro), chave manual em mono com borda tracejada e "Copiar chave" com toast, e o `CodeInput` para confirmar. O cartão é um `Surface` com o QR num `Surface sunken`, então os raios saem da escada. "Cancelar" fica desabilitado enquanto o MFA for obrigatório.
- `enrollTotp` apaga os fatores TOTP não verificados antes de criar um novo, senão cada visita à tela acumularia um fator pendente; o componente ainda guarda um ref para não repetir a chamada no modo estrito do React.
- Cadastro obrigatório: o `updateSession` devolve `mfaMissing` (aal1 sem próximo nível, ou seja, usuário sem nenhum fator verificado) e o proxy manda para `/mfa` em qualquer rota protegida, espelhando o `mfaPending` do step-up. O conteúdo do `AuthCard` rola por dentro (`overflow-y: auto` no `.content`), porque o cartão do MFA é mais alto que a tela do celular e a página em si continua travada.
- `PasswordInput` (`components/ui/password-input/`): `Input` com `type` alternado e botão de olho na ponta, `aria-pressed` e rótulo que muda. O ícone de erro do `Field` entra antes do olho, porque o `Field` injeta `iconEnd` e o componente concatena em vez de substituir.
- O formulário não mostra asterisco: `required` vai direto no controle, e o `Field` só injeta `required` quando a prop dele é verdadeira (antes ele sobrescrevia com `false` o que o controle declarava).
- Arquivo estático novo em `public/` precisa entrar no `matcher` do proxy (`logotipo`, `banners`, `bg`, `brands`). Sem isso o proxy trata a imagem como página protegida, responde redirect para `/login`, e o otimizador do `next/image`, que busca o arquivo por HTTP, recebe o redirect no lugar do PNG: a imagem quebra sem erro no console.
