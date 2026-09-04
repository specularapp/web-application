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
    previa/             prévias de front, só em homologação (fora dela a página é 404 e o proxy fecha)
    (marketing)/        site público: home, preços, termos, privacidade
    (auth)/             login, cadastro, recuperação de senha
    (app)/              área autenticada, protegida pelo proxy
    api/v1/             mesma regra das actions exposta ao aplicativo, por Bearer token
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
- Tela grande também ganha prévia em `/previa/*`, que é a vitrine no formato de verdade: tela cheia em vez de caixa, para ajuste visual sem sessão e sem dado no banco. `/previa/primeiros-passos` abre qualquer uma das três etapas por `?etapa=time|membros|plano`, e na etapa do plano escolher um plano pago abre a etapa de pagamento com o espaço do formulário do Stripe reservado. `/previa/plano` mostra `/configuracoes/plano` com assinatura em teste, cartão e faturas de exemplo. As rotas existem só em homologação: o proxy libera o prefixo `/previa/` por `isHomologation()` e a própria página devolve 404 fora dela. Os estados de exemplo vivem num lugar só, em `features/billing/preview.ts`, compartilhados com a vitrine.
- `OnboardingFlow` separa `demo` (não toca o servidor) de `boxed` (caixa dentro da página, o formato da vitrine): a prévia usa só `demo`, então ela aparece como a camada de verdade.
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
- Fundo do tema claro é `#fbfbfc`, e não branco puro (decisão de 2026-09-02): branco seco endurece a tela e some com a borda dos cartões, que são brancos de verdade (`--color-bg-tertiary`). O escuro segue em preto puro.
- Semânticos `--color-*` seguindo os nomes da Apple: label (4 níveis), placeholder, link, separator, bg (system e grouped, 3 níveis cada) e fill (4 níveis).
- Papéis do produto: `--color-brand` (preto no claro, branco no escuro, igual ao logo), `--color-accent` (system blue), success, warning, danger, info e focus.
- Claro e escuro com `light-dark()`, forçados com `data-theme="light"` ou `data-theme="dark"` no `html`. **Escuro é o padrão do produto**: sem cookie de preferência, o layout raiz põe `data-theme="dark"` em vez de seguir o sistema (decisão de 2026-09-01). Todo componente continua obrigado a funcionar nos dois temas, porque o claro segue disponível por preferência.

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
- `loading` é o estado de espera de toda ação: o `Spinner` toma o lugar do `iconStart`, o botão se desabilita sozinho e ganha `aria-busy`, com opacidade 0.75 e cursor `progress` para não se confundir com o desabilitado (0.4). O spinner puxa `currentColor` e `--diameter: 1.2em` pela regra do próprio botão, então acompanha variante e tamanho; o rótulo do `Spinner` fica vazio de propósito, porque quem anuncia é o texto do botão, que troca para o gerúndio ("Entrando", "Salvando"). Nos formulários com `useActionState` vem de `pending`; nos botões de provedor OAuth, que são um `<form>` por botão sem estado próprio, vem do `useFormStatus` dentro de um subcomponente.

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
- Esse listbox é o `Listbox` de `components/ui/listbox/`, genérico em `string | number`, com `placement` (`below` ou `above`, que vira dropup e troca o caret) e `prefix` (rótulo curto antes do valor, como "Mostrar 30"). Saiu do calendário no segundo uso, a `Pagination`.
- `actions` põe itens que executam em vez de escolher (remover, cancelar) no fim da lista, separados por um divisor, com `tone="danger"` quando destroem algo. Ação e opção dividem a mesma navegação, e é por isso que o item ativo passou a ser índice e não valor: seta e Enter precisam alcançar um item que não é um valor possível do campo. Substitui o botão solto ao lado do campo, que roubava espaço da linha e precisava de um lugar reservado para não desalinhar.
- `placement="auto"` decide o lado ao abrir, comparando o espaço abaixo do gatilho com a altura estimada da lista (número de opções pela altura fixa da opção, com teto). É estimativa e não medição porque medir só depois de montar faria a lista aparecer embaixo e pular para cima no mesmo quadro.
- `Select` é esse mesmo `Listbox` vestido de campo, não outro componente: o gatilho recebe altura, recuo, raio e fonte do tamanho de controle pelas variáveis locais (`--listbox-trigger-height`, `--listbox-trigger-padding`, `--listbox-trigger-radius`, `--listbox-trigger-font-size`, `--listbox-trigger-border`), com piso de 16px na fonte pelo mesmo motivo do `Input`. O valor sai num `input type="hidden"`, então funciona dentro de `form` sem JS de cola; `placeholder` aparece enquanto ninguém escolheu e o `id` vai para o gatilho, para o `Label` do `Field` apontar para ele. Não usa `select` nativo porque a lista do nativo é desenhada pelo sistema e não aceita fonte, raio nem cor.
- Largura de componente Emotion nunca sai de classe de CSS Module: a folha do Emotion é injetada em runtime, depois da do módulo, e com a mesma especificidade ela vence. Quem precisa apertar um `Select` numa linha (a lista de membros) põe o componente dentro de um `span` próprio e dimensiona o `span`.
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

- `Avatar` recebe `name` e, opcionalmente, `src` e `seed`. Sem imagem entra o `avvvatars-react` (por `avatar/shape.tsx`, o único ponto que importa a lib) com `style="shape"`: uma das 60 formas vetoriais da lib sobre uma das 20 cores de fundo, ambas determinísticas pelo `seed`, com o e-mail como semente para o avatar não mudar quando o nome muda. Iniciais foram testadas e descartadas, por decisão de produto: quem não tem foto fica com o vetor. O raio e o recorte continuam no invólucro, que já esconde o overflow por causa da foto, então círculo e squircle saem de um lugar só e a lib entrega só cor e forma.
- A lib traz o goober junto, que injeta `<style>` em runtime e lê o nonce de `window.__nonce__`. Sem isso a CSP por nonce bloqueia a folha e o avatar aparece sem estilo. Quem põe o nonce é o `GooberNonce` no layout raiz, na renderização e não em efeito, porque o goober cria a tag no primeiro avatar que montar.
- Foto de perfil do Google e do GitHub entra sozinha: o gatilho `handle_new_user` copia do metadata no cadastro e `handle_user_identity` faz o mesmo quando a identidade é vinculada depois, sempre com `coalesce`, para nunca sobrescrever o que a pessoa definir no produto. Com imagem usa `next/image` com `fill` e `sizes` fixo por tamanho; domínio remoto entra em `remotePatterns` quando o upload existir. Server Component com CSS Module.
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

### Barra de rolagem

Desenho único em `globals.css`, valendo em tudo que rola: 3px, polegar em `--color-fill-quaternary` que escurece no hover, trilho transparente e nenhuma seta nas pontas.

- As duas famílias não convivem. Assim que `scrollbar-width` ou `scrollbar-color` aparecem na regra, o Chrome descarta os pseudo-elementos `::-webkit-scrollbar` e cai na barra nativa, que no Windows vem grossa e com uma seta em cada ponta. Por isso as propriedades padrão ficam dentro de `@supports not selector(::-webkit-scrollbar)`, que só o Firefox atende, e o desenho vive nos pseudo-elementos.
- Pelo mesmo motivo, componente nenhum declara `scrollbar-width: thin` por conta própria: fazer isso desliga o desenho global naquele elemento. Quem quiser esconder a própria barra declara `scrollbar-width: none`, que é o caso do menu.


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

### Menu (Sidebar)

Uma composição só, duas apresentações. A ordem das partes não muda entre desktop e celular; o que muda é a moldura, e por isso o conteúdo mora num `SidebarPanel` com `variant`, enquanto o `Sidebar` decide a moldura por `useMediaQuery(MOBILE_QUERY)`. É troca de árvore, não de CSS, porque o rodapé tem conteúdo diferente nas duas formas.

De cima para baixo, seguindo a referência do usuário (a barra de projeto da Vercel): o time no lugar da marca, com logo de 24px, nome, etiqueta do plano e a seta dupla; campo de busca com a tecla de atalho; rotas em grupos separados por linha; e, colado no fim, o convite de ação, a meta e o perfil. A marca saiu do menu de propósito: quem identifica o contexto ali é o time, não o produto.

- O painel é avulso: sem fundo, borda ou raio em volta. **A página não abre recuo nenhum** (decisão de 2026-09-02): cada componente traz o seu por dentro, e o menu tem 8px internos no desktop e 12px na tela cheia do celular, na escala da referência. O valor sai de `--menu-padding`, declarado no painel, e a linha que sangra e a lista que rola leem dele, então os três nunca saem de sincronia. A coluna dele é trilha de grade, e não item de flex, porque trilha é limite duro: conteúdo nenhum cruza para cima do menu, nem quando o que está dentro passa da largura.
- Caixa sobrou só no convite, na meta e no perfil, todas com o preenchimento do botão secundário (`--color-fill-quaternary`), que sobre o preto fecha em #151517 e quase não aparece. Superfície opaca (`--color-bg-secondary`) foi testada e lida como cinza. O time não tem caixa nenhuma: fica solto no topo, separado por uma linha.
- Rótulo de rota em 75% do `--color-label` misturado ao fundo (`color-mix`), e não em token pronto: o secundário a 60% sumia no tema claro e o contraste cheio gritava. Hover e item em vigor sobem para o contraste cheio, e o item em vigor ainda ganha peso médio e preenchimento.
- Título de grupo não existe na tela: quem separa um grupo do outro é a linha, que sangra o recuo do menu pelos dois lados e corre de borda a borda. O nome do grupo continua para leitor de tela, em `role="group"` com `aria-label`. Linha só existe entre grupos de rota: nem abaixo da busca, nem antes do rodapé, e o vão em volta dela é o mesmo de uma opção para a outra, então a lista tem um ritmo só.
- Fio de 0,6px em todo o menu (`--menu-line`), mais fino que o 1px do resto da casa, e sempre em `--color-border` (12% no claro, 13% no escuro), nunca em `--color-separator`, que a 29% e 60% grita numa coluna estreita. Moldura some, sobra conteúdo. Ícone da lista em 18px e na cor do rótulo, herdada: ícone menor e mais claro que o texto quebrava a linha em dois pesos. Coluna de 16rem, na escala da referência.
- A busca parece campo e é botão, porque quem vai abrir é a paleta de comandos. Enquanto ela não existe, o botão fica de pé e mudo, com a tecla de atalho à direita num `Kbd`.
- Linha da lista em 36px, com 4px de recuo em cima e embaixo e 2px entre uma e outra. Em ponteiro grosso ela volta para 44px por `@media (pointer: coarse)`, que é a regra de alvo de toque: no celular a lista é o único jeito de navegar. A barra de rolagem do menu fica fora de vista (`scrollbar-width: none`), porque em coluna estreita ela come o respiro da direita.
- Alerta de plano no formato da referência: identidade em cima (ícone tingido, "plano atual" e o nome do plano), frase curta no meio e botão cheio embaixo. O chip do ícone estica junto com o bloco de texto (`align-items: stretch` mais `aspect-ratio: 1`), então a altura dele é exatamente a das duas linhas, sem número chumbado que envelhece quando o tipo muda. Fundo é um gradiente do invisível para 16% de accent, e a borda 22%, sempre misturados com `transparent` e nunca com `--color-bg`: assim o cartão se apoia no fundo da página em vez de abrir um bloco branco no claro e preto no escuro. O ícone do botão vai sem `weight`, para o `Button` aplicar o peso da casa por `matchIconWeight` e a cor sair do próprio botão.
- Meta em uma linha só: "Meta", a barra ocupando o vão e o valor no fim, em caption 2. O nome inteiro ("Meta de faturamento") vive no `aria-label`, então quem usa leitor de tela não perde o contexto que a tela encurtou.
- Rota que abre no lugar: entrada com `items` (`NavFolder`) troca a lista inteira pelas páginas de dentro, com voltar no topo. Submenu aninhado em painel de 17.5rem empurraria tudo para a direita e sairia da vista.
- A troca de pasta anima: a pilha do nav tem chave pela pasta, então cada troca remonta e entra deslizando na direção do movimento, da direita para dentro e da esquerda para fora. Abrir pasta também leva a rolagem ao topo de quem rola, que no desktop é o próprio nav e na tela cheia é a tela: lá a pasta costuma ser escolhida embaixo, e a lista curta que entrava no lugar ficava fora da vista.
- `nav.ts` é a fonte única do menu, e `href` é tipado por rota: página que não existe nem compila. Por isso tarefas, calendário e relatório da referência ficaram de fora até as páginas nascerem.
- O componente é apresentacional e recebe time, pessoa, convite e a lista de times por prop. Quem busca isso no banco é o `AppShell`, Server Component do grupo (app), que junta `getCurrentTeamState`, `getTeamOptions` e a cobrança e deriva o convite de plano.
- Meta de faturamento usa `compactMoney` de `lib/utils/format.ts`: R$ 30,5k, R$ 1,243M, sempre a partir de centavos, como todo dinheiro do produto.
- A barra flutuante declara `width: max-content`: elemento fixo com `left: 50%` encolhe até o espaço que sobra da metade para a direita, ou seja, meia tela, e o rótulo cortava por reticências mesmo com espaço de sobra na esquerda. O teto de largura impede o vazamento na tela estreita.
- A tela cheia do celular desbota na base por `mask-image`, onde o conteúdo passa por trás da barra flutuante, em vez de ser cortado pela borda da tela.
- Celular: o painel não fica na tela. Uma barra flutuante no rodapé, ao centro, traz "Buscar" e o botão de abrir; aberto, o painel toma a tela inteira, sem a marca, e as ações da conta aparecem listadas em vez de escondidas atrás do botão de seta, porque no celular esconder opção atrás de camada custa um toque a mais e uma camada a mais.
- A seta dupla do time abre a janela de troca (`TeamSwitcher`, 2026-09-03), a primeira camada flutuante do menu. Opções da conta, busca e notificações continuam de pé e mudas, esperando `DropdownMenu` e a paleta de comandos; `DropdownMenu` segue stub.
- Prévia em `/previa/menu` (só em homologação), que é onde dá para ver a forma do celular, e a forma do desktop também entra na vitrine `/componentes`, em caixa alta.

### Movimento das camadas

Toda camada flutuante da casa entra e sai animando, e a receita mora em dois lugares só: `usePresence` em `hooks/use-presence.ts` e `layerMotion` em `components/ui/styles.ts`.

- `usePresence(open)` devolve `present`, `state` e `onAnimationEnd`. `open` é a intenção; `present` é se a camada ainda existe na tela; `state` vai para `data-state` e é o que o CSS lê para escolher entre entrar e sair. A camada fica montada até o `animationend` da saída, com um temporizador de segurança caso ele não chegue. O ajuste de `present` ao abrir é feito durante o render, o padrão que o React recomenda para reagir a prop nova, e não em efeito, que o lint barra.
- `onAnimationEnd` vai só no elemento animado e ignora o que subiu dos filhos: o evento de animação borbulha, e um giro ou um badge lá dentro fechava a camada antes da hora.
- `layerMotion` é o gênio da lâmpada na versão que o CSS alcança: a caixa nasce a 90% e um degrau mais perto de quem a abriu (`--genie-x` e `--genie-y` dizem de onde) e cresce até o lugar com a mola curta da casa; ao fechar volta pelo mesmo caminho, mais rápido e sem mola, porque saída não pede atenção. Com movimento reduzido sobra só o fade: a regra é sobre deslocamento, e opacidade não desloca nada.
- Cada moldura tem o seu caminho: as caixas coladas no gatilho usam o gênio com a origem no lado do gatilho; a janela centralizada nasce um degrau abaixo e sobe; a gaveta lateral entra e sai deslizando pela lateral; a bandeja do celular sobe do rodapé e volta para ele; a tela cheia do menu sobe um degrau e desbota. Fundo que escurece e véu leve fazem fade nos dois sentidos.
- Quem monta uma camada com `Dialog` precisa mantê-la montada enquanto `open` é falso, senão a saída não acontece. A busca, que era montada só ao abrir, passou a ficar sempre montada com uma chave que muda a cada abertura: a chave remonta o conteúdo, então o estado nasce limpo sem escrever estado em efeito, e o cookie das recentes é lido só quando há documento, porque agora ela também renderiza no servidor.
- Troca de seleção dentro das camadas também anda: o traço da aba de notificações cresce a partir da esquerda, a lista troca com um fade curto quando a aba muda, a opção de tema desliza cor e sombra, e as linhas de lista já transitavam o fundo.

### Janela (Dialog)

Moldura da casa para conteúdo que interrompe: caixa centralizada no desktop e bandeja subindo do rodapé abaixo de 48rem, na mesma decisão do `DatePicker`. Portal em `document.body`, `role="dialog"`, Escape fecha, o Tab dá a volta por dentro da caixa e o foco volta para quem abriu. Rolagem da página trava enquanto está aberta e `prefers-reduced-motion` corta a animação.

- A bandeja do celular sempre põe alguma coisa atrás de si: o escurecimento cheio quando a janela bloqueia o resto, e um véu leve (`--color-scrim-soft`) quando ela é avulsa. Sem nada atrás, a bandeja lia como parte da página. No desktop, dispensar o escurecimento continua deixando a tela limpa.
- `scrim` decide o peso da janela. Com ele (o padrão) o fundo escurece em `--color-scrim`, a janela é `aria-modal` e o clique no fundo fecha; a moldura que centraliza cobre a tela e não recebe ponteiro, então o clique na área vazia atravessa e chega lá. Sem ele a janela não bloqueia o resto, não se anuncia como modal e passa a fechar por toque fora da caixa.
- Canto declarado direto no CSS, sem `data-squircle`: a janela guarda foco e conteúdo que sai do fluxo, e o recorte do fallback cortaria o anel de foco de quem está dentro. Mesma escolha do `Listbox` e do `Tooltip`.
- Tamanhos por `data-size`: `sm` 24rem, `md` 30rem, `lg` 40rem. A altura é limitada por `min(34rem, 100dvh menos 4rem)` no desktop e 85dvh na bandeja, e quem rola é o conteúdo de dentro, nunca a página.
- `focusOnOpen={false}` para o foco no próprio painel, e não no primeiro campo: no celular focar um campo faz o teclado subir sozinho e comer metade da bandeja antes de a pessoa ver o conteúdo. O Tab continua preso dentro da janela, porque o painel carrega `tabindex="-1"`. A prop não se chama `autoFocus` porque o lint barra esse nome em JSX.
- Janela e gaveta usam o mesmo canto, o raio `3xl`, porque são a mesma família e destoavam quando a centralizada ficava num raio menor. A bandeja continua no `xl`, que é o degrau da casa numa tela estreita.
- `placement="end"` troca a caixa centralizada por gaveta na lateral final, entrando por `translateX`, com 8px de folga nos quatro lados (o recuo mora na moldura) e canto completo, porque ela não encosta em borda nenhuma. No celular a bandeja continua ganhando, porque a regra dela vem depois e vence no que declara.
- `surface="glass"` troca a superfície opaca pelo vidro. A receita é a do painel do login e da barra flutuante do menu, agora num par de tokens (`--glass-bg`, que é `--color-bg` a 0% misturado com `transparent`, e `--glass-blur`, que é `blur(12px)`): o fundo some por inteiro e quem desenha a caixa é o borrão. Serve a camada leve; formulário longo continua em superfície opaca, senão o texto disputa com o que está embaixo.

### Troca de time

A seta dupla no topo do menu abre uma caixa com busca, os times da pessoa e o convite de criar no rodapé, no formato da referência (a troca de projeto da Vercel).

- Sem escurecer a tela e colada na origem (decisão de 2026-09-03): no desktop é caixa avulsa de 20rem medida a partir do próprio seletor, alinhada pelo início dele, virando para cima quando falta espaço embaixo e acompanhando rolagem e redimensionamento. A medida sai de `useLayoutEffect`, e não de `useEffect`, senão a caixa pinta no canto e pula para o lugar no quadro seguinte. No celular ela vira a bandeja do `Dialog` com `scrim={false}`, porque lá o topo do painel fica longe do polegar.
- A faixa dos times tem altura reservada, de 10rem a 15rem no desktop e até 22rem na bandeja, e é ela que rola. Sem piso, um time só deixava a caixa espremida entre a busca e o rodapé; sem teto, muitos times empurravam o convite de criar para fora da vista.

- Regra no banco: `set_current_org` já existia, é `security definer` e recusa organização de que a pessoa não participa. A web chama por `switchTeamAction` e o aplicativo por `PUT /api/v1/organizacoes/atual`, os dois pela mesma função, então a validação não é repetida em código.
- A lista sai de `listTeams`, que entra pela associação (`organization_members`) e não por `organizations`: a policy de select de lá também deixa passar o time que a pessoa criou, então quem saiu do time continuaria vendo um destino que a troca recusa. O plano de cada linha vem de uma leitura em lote de `organization_subscriptions` com os status de `grantingStatuses`, a mesma lista de `organization_plan`. O aplicativo lê em `GET /api/v1/organizacoes/minhas`.
- O foco fica no campo de busca o tempo todo: as setas movem o item ativo, Enter escolhe e o leitor de tela acompanha por `aria-activedescendant`, então as linhas são `role="option"` e não botões. A busca compara por `slugify` dos dois lados, então acento e maiúscula não atrapalham.
- Escolher um time chama a action, mostra giro na própria linha e refaz a árvore do servidor com `router.refresh()`. Enquanto a troca corre a janela não fecha, nem por Escape.
- A caixa é de vidro nos dois formatos, na mesma receita do painel do login: `--glass-bg` e `--glass-blur`.
- O convite de criar não encosta na borda do rodapé: o recuo é o mesmo da lista, então o hover pinta uma caixa arredondada por dentro, no ritmo das opções de cima, em vez de uma faixa de ponta a ponta.
- Criar equipe fecha a caixa e abre a gaveta de criação, descrita abaixo.

### Busca (CommandPalette)

O campo de busca do menu e o "Buscar" da barra flutuante abrem a mesma janela: campo em cima, atalhos em pílula, o que foi aberto por último e sugestões. Caixa de vidro `md`, centralizada no desktop e bandeja no celular.

- As opções saem de `nav.ts`, que já é a fonte única do menu e tem `href` tipado por rota, então a busca nunca oferece página que não existe. `navLinks()` achata as pastas e carrega o nome de onde a página mora, porque "Acompanhar" e "Visão geral" não dizem nada fora da gaveta; `navHighlights` é o punhado que vira pílula, com rótulo próprio.
- A pílula tinge pela mesma receita do Badge: tinta no matiz a 70% do rótulo e fundo no matiz em alfa baixo, mais forte no escuro, com o contraste já conferido nas 19 cores da paleta. O matiz de cada atalho fica em `navHighlights`, e o ícone herda a tinta em vez de puxar para o cinza. Canto pelo sistema da casa, no raio `md`, e não pílula redonda.
- A fila de atalhos rola na horizontal com a barra de `thinScrollbar`, e não escondida: a régua diz que a fila continua. Quebrar em duas linhas empurrava a lista para fora da vista numa tela estreita. O recuo dela é o mesmo da linha da lista, senão as duas faixas começam em pontos diferentes.
- As duas áreas que rolam desbotam nas pontas por `mask-image`, e não por uma faixa de cor por cima: o painel é de vidro, e um gradiente sólido viraria mancha em vez de sumiço. Em cima a faixa tem o tamanho do recuo, então cai sobre o vão; embaixo ela é maior, porque ali a lista encosta na régua de teclas e o corte seco aparecia inteiro.
- A pílula fica em 36px no toque, e não no alvo cheio: ela é atalho secundário, a lista logo abaixo é quem guarda os 44px da regra, e com 44 aqui a faixa do topo comia um terço da bandeja.
- Cada linha da lista é ícone, rótulo e a seção em etiqueta colorida na outra ponta. Sem seta de abrir no fim: a janela inteira já é uma lista de coisas que abrem, e o ícone repetido em toda linha só somava ruído.
- O matiz da etiqueta é o da seção, declarado em `nav.ts` na pasta e no grupo e propagado por `navLinks()`. Cor de seção mora onde a seção nasce, e não numa tabela paralela que envelhece quando o menu muda.
- A linha da lista tem a altura do menu, 36px com 4px de recuo, e volta ao alvo de toque em ponteiro grosso. Entre um grupo e outro corre a mesma linha que separa os grupos do menu, sangrando o recuo da lista.
- A régua de teclas no pé diz o que dá para fazer daqui: fechar, navegar e abrir. Ela e as próprias teclas somem no celular.
- O rótulo de grupo recua o mesmo que a opção. Ele mora dentro da lista, que já abre o recuo lateral, então o recuo cheio somava duas vezes e jogava "Recentes" e "Sugestões" para dentro.
- Com o campo vazio a janela mostra Recentes e Sugestões; com texto, uma lista só de Resultados, filtrada por `slugify` no rótulo e na seção, então acento e maiúscula não atrapalham.
- Recentes são as três últimas rotas abertas pela busca, em cookie (`sp-recent`), porque Web Storage é proibido pelo lint. Guarda só a rota, que já é pública e conhecida pelo menu, nunca o que foi digitado.
- Um `listbox` só, com o rótulo de cada grupo como item de apresentação dentro dele: um listbox por seção duplicaria o id que o campo aponta em `aria-controls`. O foco fica no campo, a seta move o item ativo e o leitor de tela acompanha por `aria-activedescendant`.
- Quem abre monta o componente, e não o mantém montado com `open={false}`: assim o estado nasce limpo a cada abertura e o cookie é lido uma vez, sem escrever estado dentro de efeito.
- O botão de busca no menu mostra o atalho inteiro, modificador e letra, e não só a letra. O rótulo do modificador vem de `useCommandKey`, que responde Ctrl no servidor e troca para ⌘ na hidratação em Mac, então a marcação não discorda. O atalho é o comando mais a tecla que o campo mostra. Ele toma o lugar da busca do navegador de propósito: procurar no texto da página não serve a quem quer pular para outra tela. A régua de teclas e a própria tecla somem no celular.

### Opções da conta

O chevron duplo do perfil abre a lista colada nele, que sobe porque o perfil mora no rodapé do menu: quem é você em cima, as telas da conta no meio, o tema e a saída embaixo. Vidro, fio da casa e a mesma linha do menu, na mesma altura e no mesmo tom, porque a camada é continuação dele.

- Assinatura leva o chip do plano em vigor, o mesmo rótulo curto que o topo do menu mostra.
- Tema em dois estados na própria linha, claro e escuro, com a fila na frente do rótulo como no celular. "Sistema" saiu: o produto é escuro por padrão e não segue o aparelho, então a terceira opção só confundia e estourava a linha estreita do celular. O estado do seletor nasce do que o html carrega, e não do cookie, porque sem cookie o produto é escuro. A troca chama `applyTheme`, que saiu do `ThemeToggle` de homologação para `lib/theme.ts` quando os dois passaram a precisar dela.
- Sair é `<a>` cru, e não `Link`: limpar o cookie de sessão exige uma ida ao servidor, coisa que navegação de cliente não faz.
- O painel só existe no desktop, mas as opções são as mesmas nos dois: `accountLinks` e `ThemePicker` saem daqui e a tela cheia do celular monta as mesmas linhas com o CSS dela. As molduras diferem, a lista não, então nenhuma das duas conta uma história diferente da outra.

### Notificações

O sino no rodapé do menu abre a caixa colada nele, que sobe porque ali não há espaço embaixo: cabeçalho com o que falta ler, categorias em aba e a lista. Bandeja no celular, onde o rodapé do menu fica longe do polegar.

- Quatro abas: todas, ação necessária, revisões e sistema. A fila rola na horizontal e desbota nas pontas, como a fila de atalhos da busca, porque quatro categorias não cabem numa tela estreita.
- A aba em vigor é marcada por traço embaixo, e não por preenchimento: preenchimento ali competiria com a marca de não lido de cada linha.
- Não lido acende um ponto na frente do título, e a linha lida cai de opacidade. Pintar a linha inteira transformava a lista num bloco de cor com meia dúzia de itens. Clicar na linha marca como lida.
- O sino carrega o contador do que falta ler na própria quina, virando "9+" acima de nove, e o cabeçalho tem só silenciar e fechar. Silenciar é preferência de interface, então mora em cookie e sobrevive ao recarregar; o sino troca para o riscado enquanto está mudo.
- No celular o sino também aparece na barra flutuante, ao lado do botão do menu, e some de lá quando não há nada sem ler. Os dois gatilhos leem a mesma lista, que mora na moldura do menu: o painel aceita `onChange` e, sem ele, guarda a própria lista, que é como a vitrine o usa.
- O botão dentro da notificação é o `Button` da casa, e não um link pintado à mão.
- A medida da caixa colada no gatilho é o hook `useAnchoredPosition`, o mesmo da troca de time: mede em `useLayoutEffect`, estima a altura em vez de medir, e vira para cima quando falta espaço embaixo.
- **O domínio não existe no banco.** A lista chega por prop e hoje vem de `notifications/preview.ts`. Quando a tabela nascer, muda só a origem: o painel não sabe de onde a lista vem.

### Criar equipe

Gaveta de vidro com 30rem na direita (`Dialog` com `placement="end"` e `surface="glass"`), entrando por deslize, com bandeja no celular. Ela vai sem o fundo que escurece, e não por descuido: o vidro borra o que está atrás dele, e com o escurecimento ligado quem seria borrado é o próprio escurecimento, deixando a gaveta cinza no tema claro em vez de translúcida. Uma lista só, sem etapas: quem cria a segunda equipe já conhece o produto, então o fluxo de primeiros passos, que é guiado, não se repete aqui.

- Cabeçalho enxuto e baixo: só o título, a etiqueta do plano que libera a operação e o X na outra ponta, sem linha de descrição. A etiqueta é o chip neutro de sempre, sem ícone, e o plano sai de `CREATE_TEAM_PLAN`, que é a fonte única: o convite que abre a gaveta mostra a mesma. O rótulo curto virou `planBadges` em `billing/plans.ts`, porque agora três lugares o usam.
- Os fios seguem o menu, e não o padrão genérico: 0,6px em `--color-border`, com a variável nascendo na janela e descendo por cascata para cabeçalho, divisor e rodapé. O `Separator` puro traz `--color-separator`, quase três vezes mais opaco, que numa coluna estreita vira um risco preto no meio do formulário.
- De cima para baixo: identidade (banner com a logo montada na borda de baixo, o mesmo `ImagePicker` dos primeiros passos), nome, site, área de atuação e as pessoas. Cabeçalho e rodapé ficam fixos, e só o meio rola.
- A capa é de perfil de rede social: banner deitado em cima e a bola da logo montada sobre ele, presa na esquerda. Quanto dela fica para fora sai de `--identity-logo-out`: 0,4 no desktop, que deixa 60% da bola dentro, e 0,25 no celular, onde a capa é baixa e ela precisa afundar mais. O par é montado pelo `ImageGroup`, exportado junto do `ImagePicker`, então a gaveta e os primeiros passos usam o mesmo agrupador.
- O transbordo e a margem que o reserva saem os dois do tamanho da bola (`calc` sobre `--identity-logo-size`), e não de números soltos: assim mudar só o tamanho mantém o encaixe em qualquer largura. Cada tela ajusta `--identity-ratio` e o tamanho; a gaveta usa 3 por 1 com bola de 5rem, porque numa coluna de 30rem a bola de 6rem cobria quase toda a capa.
- Os três campos da equipe leem como um bloco: nome na linha inteira e, logo abaixo, site e área lado a lado, com o mesmo vão entre eles.
- O recuo lateral mora em cada bloco, e não na coluna que rola: assim o divisor que abre as pessoas corre de ponta a ponta sem margem negativa, que dentro de `overflow-y: auto` é cortada de um lado e vira rolagem do outro.
- A coluna declara `align-content: start`. Ela cresce para preencher a gaveta e, no `stretch` que é padrão do grid, as linhas de altura automática esticam para dividir a sobra: os blocos abriam como se houvesse space-between, com os campos longe uns dos outros. A leitura é de cima para baixo e a sobra fica no fim. Depois dele vêm o título "Membros", os campos de convite com o botão e, por último, a lista de quem já está, com quem cria no topo.
- O endereço não aparece: ele sai do nome pela regra do domínio e não é editável, então campo travado só ocuparia linha sem dar escolha nenhuma.
- Quem cria já entra na lista de pessoas como proprietário, porque é o que o banco vai gravar. A linha não tem papel para escolher nem ação de remover.
- Os convites entram numa lista local antes de existir a equipe, porque `create_invite` precisa do id da organização. Só depois de a equipe nascer eles saem, com o papel escolhido em cada linha.
- Criar chama `saveTeamAction` e, na sequência, `switchTeamAction`: a equipe nasce e a pessoa já entra nela, então a gaveta fecha com o menu inteiro já refeito. Imagem e convite seguem em segundo plano, pelo mesmo motivo dos primeiros passos: cada envio custa uma ida ao servidor, em série, e segurando a tela isso somava segundos.

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

O primeiro domínio montado nesse formato é `organizations`: `service.ts` recebe o cliente Supabase de fora e não sabe quem chamou, `actions.ts` é a casca com sessão, zod, rate limit e revalidação, e `api/v1/organizacoes` (mais `organizacoes/membros`) é a mesma casca para o aplicativo, com `authorizeRequest` de `lib/api/v1.ts` cuidando de token, teto de requisições e leitura do corpo com limite.

## Cobrança e permissão por plano

Montado em 2026-09-01. Três fontes de verdade separadas, de propósito: **o Stripe guarda o dinheiro**, **o banco guarda quem pode o quê** e **`features/billing/plans.ts` guarda o texto de vitrine**. Nenhuma das três repete a outra, então não existe divergência para reconciliar.

### O que vive no banco

| Tabela | Papel |
| --- | --- |
| `billing_plans` | catálogo: código, nome, degrau (`tier`), dias de teste, se o teste exige cartão, se é pago |
| `billing_prices` | mapa plano + ciclo para o `stripe_price_id`. Sem valor: o valor está no Stripe |
| `plan_features` | catálogo de recursos que o plano libera (`flag` liga e desliga, `limit` guarda teto) |
| `plan_entitlements` | a permissão em si: um recurso por plano, com `enabled` e `limit_value` |
| `organization_subscriptions` | uma linha por organização: plano, ciclo, status, ids do Stripe, período, cartão |
| `billing_trials` | teste gratuito consumido, chaveado por organização e plano |
| `billing_events` | id do evento do Stripe já processado, para reentrega não processar de novo |

**`plan_features` e `plan_entitlements` nascem vazias.** Cada condição de plano entra junto com a tela que a exige, nunca antes. Sem linha, `plan_allows` nega e `plan_limit` devolve zero: negado por padrão.

### Como se define a regra de uma tela

Duas linhas de SQL numa migração de `billing`, e mais nada:

```sql
insert into public.plan_features (key, kind, name)
values ('active_projects', 'limit', 'Projetos ativos');

insert into public.plan_entitlements (plan, feature_key, enabled, limit_value)
values ('free', 'active_projects', true, 3),
       ('pro', 'active_projects', true, null),        -- nulo com enabled = ilimitado
       ('alliance', 'active_projects', true, null);
```

A partir daí a regra vale em qualquer lugar, sem código novo:

- Em policy de RLS: `using (public.plan_within_limit(organization_id, 'active_projects', (select count(*) from public.projects p where p.organization_id = ...)))`.
- Em `service.ts`: `client.rpc("plan_allows", { p_organization_id, p_feature_key })`.
- Na interface: o `Button` já tem `locked` com `plan`, que anexa a etiqueta do plano sem tirar o clique, para o clique levar ao upgrade.

Recurso que não existe em `plan_features` **derruba a chamada com erro**, em vez de negar ou liberar em silêncio: chave escrita errada aparece no primeiro teste.

### Funções de permissão

`organization_plan(org)` é a única que decide plano em vigor, e é o lugar único onde os status com direito estão escritos (`trialing`, `active`, `past_due`). Cancelado, expirado e não pago caem no gratuito sem ninguém mais precisar saber disso. As outras se apoiam nela: `current_plan()`, `plan_at_least(org, plano)`, `plan_allows(org, chave)`, `plan_limit(org, chave)`, `plan_within_limit(org, chave, quantidade)`, `trial_available(org, plano)`, `can_manage_billing(org)`.

### Quem escreve

Nenhuma tabela de cobrança tem policy de escrita. Ninguém troca o próprio plano falando direto com a API, nem o dono do time. As duas portas são:

- `attach_billing_customer(org, cliente)`, aberta para `authenticated`, exige owner ou admin e nunca sobrescreve um cliente já vinculado.
- `sync_subscription(...)`, **revogada de `authenticated`** e concedida só a `service_role`. Só o servidor escreve plano e status, e sempre com o que o Stripe devolveu, nunca com o que o pedido mandou.

### Fluxo de pagamento

O formulário é nosso, o cartão é do Stripe. Saiu o Payment Element (que traz rótulo, caixa, abas e o Link do provedor prontos) e entraram os três elementos avulsos, `CardNumberElement`, `CardExpiryElement` e `CardCvcElement`, cada um dentro de um `FieldShell` com `Label` nosso e mensagem de erro nossa. O que continua sendo do Stripe é só o campo em si, um iframe por campo, e é isso que mantém número, validade e CVV fora do nosso DOM e dos nossos servidores (PCI SAQ A). Campo de cartão de verdade no nosso HTML exigiria certificação PCI DSS nível 1 e liberação do Stripe, então não é caminho.

Dentro do iframe a nossa folha não chega: o que atravessa é o objeto `style` de `use-card-style.ts`, com as cores resolvidas em RGB por uma sonda invisível, porque `light-dark()` não sai pronto de `getPropertyValue` (mesma técnica do `GradientBlinds`). Trocar de tema reconstrói o estilo e o `react-stripe-js` repassa por `element.update`. A fonte entra por `fonts: [{ cssSrc }]` apontando para o Inter do Google Fonts: o arquivo do `next/font` é servido do nosso domínio sem CORS, e o iframe, que é outra origem, não consegue buscar. Falhando, cai no tipo do sistema. O raio e a superelipse ficam com o `FieldShell`, que é nosso, então a caixa do cartão tem o mesmo contorno de qualquer outro campo.

Confirmar é `confirmCardSetup` ou `confirmCardPayment` com o `clientSecret` e o elemento do número; o Stripe junta validade e código sozinho, porque os três vieram do mesmo `Elements`. A autenticação do banco abre num modal do próprio Stripe e a pessoa não sai da tela.

Elemento de cartão avulso monta **sem segredo nenhum**, e é por isso que a prévia e a vitrine mostram o formulário de verdade em vez de um espaço reservado: o `clientSecret` só é usado na confirmação, que a prop `preview` desliga.

Dois caminhos, escolhidos no servidor:

1. **Com teste gratuito** (Pro, 7 dias): cria um SetupIntent, guarda o cartão, e só então cria a assinatura com `trial_period_days`. Criar a assinatura antes daria sete dias de plano pago a quem abandonasse o formulário no meio.
2. **Sem teste gratuito**: cria a assinatura com `payment_behavior: "default_incomplete"` e devolve o segredo de `latest_invoice.confirmation_secret`. O plano só passa a valer quando o pagamento confirma, porque `incomplete` não está na lista de status com direito.

`trial_settings.end_behavior.missing_payment_method: "cancel"` fecha o caso do teste que termina sem cartão. O teste é uma vez por organização e por plano, garantido por `billing_trials`: cancelar e assinar de novo não devolve período grátis.

### Webhook

`api/webhooks/stripe` confere a assinatura com `constructEventAsync` antes de ler qualquer coisa, e então **relê a assinatura no Stripe** em vez de confiar no corpo do evento, porque reentrega fora de ordem gravaria estado antigo por último. `setup_intent.succeeded` é a rede de segurança do fluxo de teste: se a aba morrer depois de confirmar o cartão e antes da action responder, o webhook ativa o plano do mesmo jeito, e passar duas vezes não duplica porque a criação reaproveita a assinatura existente. O id do evento entra em `billing_events` **depois** de processar, senão uma falha de escrita perderia o evento; falha responde 500 para o Stripe reentregar.

### Comandos

| Comando | O que faz |
| --- | --- |
| `npm run stripe:sync` | publica produto e preço de cada plano pago no Stripe e grava o `stripe_price_id` em `billing_prices`. Idempotente: produto tem id fixo (`specular_<plano>`) e preço é achado por `lookup_key`. Preço com valor diferente do catálogo vira preço novo com a mesma chave, e o antigo é desativado dos dois lados, para assinatura em vigor continuar no que foi assinado |
| `npm run billing:probe` | teste ponta a ponta contra o Stripe em modo teste e o banco hospedado, pela mesma porta que o aplicativo usa (`api/v1` com Bearer). Cria usuário e time, assina, confirma cartão de teste, confere banco, cancela, retoma, dispara webhook assinado e apaga tudo no fim |

O `stripe:sync` lê `plans.ts` com `--experimental-strip-types`, para o catálogo continuar tendo uma fonte só.

## Telas

### Primeiros passos

- Configuração inicial do time **não tem rota própria**: é um modal sobre o painel, renderizado pelo próprio `/dashboard` quando `getOnboardingGate()` diz que falta configurar. Assim o primeiro acesso já cai no produto, com a configuração por cima, em vez de mandar a pessoa para outra página.
- Camada com `position: fixed` cobrindo tudo, véu em `color-mix(--color-bg-grouped 62%)` com `backdrop-filter`, e por cima o painel de vidro do cartão de login no mobile (blur com saturação, borda, sombra), com tinta leve porque sobre fundo liso o vidro puro sumiria e sobraria a borda. O véu segue o tema em vez de usar `--color-scrim` preto, senão o tema claro escureceria inteiro. Alinhamento é `align-content: safe center`, que centraliza quando cabe e vira topo quando o conteúdo passa da tela, sem cortar a primeira linha.
- O indicador de etapa é um anel no canto do cabeçalho, no lugar da marca: um arco por etapa no mesmo círculo (`dasharray` para o tamanho do arco, `dashoffset` para a posição), preenchido até a etapa atual, com o número no centro e a leitura completa em texto oculto. A troca é estado do cliente com `key` por etapa, então cada bloco monta de novo e roda `stepEnter` (opacidade e 8px de deslize), no mesmo espírito do `authEnter`.
- Etapa 1: identidade, nome, site e área de atuação. A identidade é banner mais logo, os dois enviáveis por `react-dropzone` (PNG, JPG ou WEBP até 2 MB), no formato capa de perfil: banner em 4:1 com canto squircle e a logo em círculo puro (sem `corner-shape`, pela regra dos cantos) montada sobre a borda de baixo, à esquerda. Vazio, cada alvo mostra ícone de nuvem e a dimensão ideal (1200 × 300 e 512 × 512); preenchido, a imagem ocupa o alvo inteiro.
- O endereço público (`slug`) saiu da tela: nasce do nome no servidor por `slugFromName`, que garante o mínimo de 3 caracteres mesmo com nome curto ou só de símbolo. Nome repetido não vira erro de quem preencheu: `saveTeam` tenta sufixo numérico e, por último, um aleatório, porque a colisão pode ser corrida entre dois cadastros simultâneos.
- "Site" é o endereço do próprio cliente, opcional, com `https://` como `FieldAffix` fixo em `data-tone="muted"`, o mesmo lugar do `R$` e do `%` mas em peso normal e cor terciária, porque prefixo de endereço é contexto e não pode competir com o que foi digitado. O campo guarda só o domínio, colar a URL inteira tira o protocolo repetido e `normalizeWebsite` recoloca antes do zod validar.
- Os alvos de envio centralizam o conteúdo numa camada absoluta própria, e não pelo grid do alvo: o `input` de arquivo do `react-dropzone` é filho real e entraria na conta do grid, empurrando o ícone para baixo do centro.
- Logo e banner vivem no mesmo bucket, separados pelo prefixo do arquivo (`<id da organização>/logo-…` e `…/banner-…`), então a policy de storage continua sendo uma só, presa à pasta do time.
- Área de atuação lista só o que o produto atende hoje, desenvolvimento e design, em seis opções. O `Select` abre com `placement="auto"`, então perto da base da tela a lista sobe em vez de vazar.
- A logo sobe por URL assinada: a action devolve `path` e `token`, o navegador manda o arquivo direto para o Storage e uma segunda action grava a URL pública e apaga o arquivo anterior. Passar a imagem por dentro da Server Action esbarraria no limite de corpo e ocuparia o processo do servidor.
- Etapa 2: convite com e-mail e nome, só isso. O convite entra sempre como membro e quem quiser dar mais acesso troca o papel na lista de baixo, o que tira um campo da tela sem tirar capacidade. Convite pendente mostra a etiqueta "Pendente" e aceita troca de papel (ganhou policy de update). Proprietário não é papel travado: quem for promovido a proprietário continua com o select livre, e a transferência é promover a outra pessoa e depois baixar o próprio papel. O único bloqueio é o último proprietário do time, que fica com o select desabilitado porque o `protect_last_owner` recusaria a troca de qualquer jeito.
- Remover e cancelar convite vivem dentro do dropdown de papel, depois de um divisor, e não num × ao lado. Foi o que tirou da linha o botão solto e o espaço reservado que ele exigia para os selects não desalinharem.
- O convite grava a linha, gera o token (hash no banco) e dispara o e-mail pelo Resend com link para `/convite/<token>`, que chama `accept_invite`. Falha de entrega não derruba a ação: o convite continua pendente e pode ser refeito.
- Quem entrou por convite não passa pelo fluxo: `getOnboardingGate` só pede configuração de quem é owner ou admin.
- **`insert ... returning` passa pela policy de select.** Criar o time quebrava com 42501 por isso: a associação em `organization_members` que torna a linha visível nasce no trigger AFTER INSERT, que roda depois do RETURNING ser materializado. A policy de select da organização passou a aceitar também `created_by = auth.uid()`, o que protege qualquer cliente que fale direto com a API, e o serviço gera o id e lê a linha num passo separado. Vale para toda tabela cuja visibilidade dependa de algo criado por trigger no mesmo insert.
- Etapa 3, o plano: o painel abre para 66rem, o cabeçalho padrão sai de cena e a etapa traz o próprio (logo, título, subtítulo e o alternador Mensal ou Anual com o desconto). Quatro bolas de cor sangram pelas quatro quinas, duas de cada lado, por gradiente radial em vez de filtro de desfoque: mesmo resultado sem custo de composição numa camada do tamanho do painel. Quem recorta é o painel, que ganha `overflow` escondido só nessa etapa.
- No desktop são três colunas: o plano atual fica raso, sem caixa, e as opções de subida ganham superfície e borda, cada uma com o próprio botão. O recuo é igual nos três para o conteúdo alinhar e o vão entre eles não pesar de um lado.
- No mobile viram três linhas selecionáveis (`radiogroup`), com nome e descrição à esquerda e preço à direita, e um único botão embaixo agindo sobre a linha escolhida. É troca de árvore por `useMediaQuery`, e não CSS: o cartão tem botão dentro e a linha inteira é um botão, então os dois não podem existir ao mesmo tempo no DOM.
- O catálogo (nome, descrição, preço em centavos por ciclo e recursos) fica em `features/billing/plans.ts`, longe da tela. Preço fechado não mostra centavo, porque "R$97" lê melhor que "R$97,00" numa tabela de planos.
- A etapa lê o plano em vigor e o teste gratuito do banco, por `getOnboardingGate`, e não de constante no código. Enquanto o time ainda não existe (ele nasce na etapa 1), o que chega é o catálogo com o gratuito em vigor, que é a verdade de quem acabou de se cadastrar.
- Plano gratuito conclui a configuração direto. Plano pago troca a etapa pelo checkout **no mesmo painel**, sem modal novo e sem sair para o Stripe: duas colunas dentro dos 66rem que já estavam abertos, resumo do pedido à esquerda e os campos de cartão à direita, com o mesmo gradiente das quinas atrás. Confirmado o cartão, `complete_onboarding` marca `organizations.onboarding_completed_at` e a pessoa vai para o painel.
- O resumo mostra "Total hoje R$ 0,00" e a data da primeira cobrança quando há teste gratuito, calculada no cliente porque a assinatura só nasce depois do cartão. Esse bloco só existe após um clique, então não há renderização no servidor para divergir da hidratação.
- A linha "7 dias grátis para testar" ocupa espaço reservado nos três cartões quando algum plano tem teste, senão o botão do Pro desceria uma linha sozinho e a fileira ficaria torta.

### Plano e assinatura

- `/configuracoes/plano` mostra o plano em vigor com etiqueta de situação, ciclo, fim do teste, próxima cobrança e valor; troca de plano com o alternador de ciclo; forma de pagamento com bandeira e quatro últimos dígitos; e a lista de faturas vinda do Stripe.
- Cancelar é em dois passos no próprio botão, sem modal: `Dialog` é stub, e o único modal real do projeto é o `.overlay` dos primeiros passos. O texto diz o que acontece de verdade: a assinatura fica ativa até o fim do período já pago, então cancelar não tira o acesso na hora.
- Trocar o cartão abre o mesmo formulário de cartão em modo `setup`, no lugar da linha do cartão atual. O novo cartão vira o padrão do cliente e da assinatura no mesmo passo.

### Login

- Telas de autenticação são sempre escuras, por decisão de produto. O proxy manda o caminho no header `x-pathname` e o layout raiz põe `data-theme="dark"` no `html` quando `isAuthPath()` (`lib/auth-paths.ts`, a mesma lista que o proxy usa) bate, no servidor, sem flash e sem mexer no cookie de tema. Tentativa descartada: `color-scheme: dark` só no shell não funciona, porque o Chrome resolve o `light-dark()` das variáveis no `:root`, onde elas são declaradas, e não no elemento que as usa. Foi isso também que tirou o quadrado claro que aparecia no fim da tela no mobile: era o fundo do tema claro aparecendo abaixo do conteúdo.
- Rota `/login` no grupo `(auth)`. O `layout.tsx` do grupo envolve toda tela de autenticação no `AuthCard` (`components/layout/auth-card/`), que recebe o `authHero` de `features/auth/banners.ts`: imagem, chamada curta e descrição. A página só compõe `LoginForm` de `features/auth/components/`.
- Fundo animado nos dois layouts, sem imagem nem carrossel (decisão de 2026-08-29): `GradientBlinds` (`components/ui/gradient-blinds/`, WebGL via `ogl`, portado do React Bits), em preto e branco (`--color-bg`, `--sys-gray-2`, `--color-label`) com as cores em tokens no `authHero` de `features/auth/banners.ts`, resolvidas em runtime por um `span` sonda porque o shader precisa de RGB. `mixBlendMode="normal"`: com `lighten` o `backdrop-filter` do cartão mobile não enxergava o canvas e o vidro sumia; sobre fundo preto os dois modos desenham igual. Holofote largo (`spotlightRadius` 2.2) para o gradiente aparecer inteiro sem ponteiro, e órbita automática lenta quando não há movimento por 2,5s (no celular nunca há mouse). Para em `prefers-reduced-motion` (desenha um quadro e fica) e com a aba oculta; `dpr` limitado a 1.5 para não pesar no celular. No desktop preenche a moldura da direita; no mobile é a própria tela, fixo atrás do cartão. O `Carousel` continua em `components/ui` para outro uso.
- Desktop (a partir de 64rem): duas colunas em `3fr 2fr` (60/40), com o conteúdo do login centralizado na coluna maior (`max-width: 32rem`, margem automática). Logo e título centralizados. A coluna direita é a moldura de raio `3xl` com margem 16, o `GradientBlinds` preenchendo por grid (`grid-area: 1 / 1` em todos os filhos, sem `position` no componente para não brigar com o Emotion), um degradê de `--color-scrim` subindo da base por `::after` e, sobre ele, o texto do hero: rótulo "Specular" em Geist Mono, título `title1` em `medium` e descrição `subheadline`, os dois com `--tracking-tight` (-0.02em) como o título da página, tudo em `--color-on-accent`.
- Mobile: o `GradientBlinds` é fundo fixo da tela, o hero fica oculto e o logo fica sozinho no topo, em branco (`--color-brand` trocado por `--color-on-accent` só nesse breakpoint) sobre um degradê fixo de `--color-scrim` que desce do topo até 32% e volta a partir de 55% até a base, para o logo e o cartão assentarem em fundo escuro em qualquer imagem. O formulário fica num cartão de vidro (sem divisor, título só para leitor de tela, respiros de 16): fundo `--color-bg` a 15% com `backdrop-filter: blur(12px)`, translúcido de verdade, deixando as persianas do fundo aparecerem desfocadas atrás dos campos, borda `--color-border`, raio `xl` (24; 40 ficava pesado no Safari, que arredonda sem superelipse), padding 20 e margem 16 das bordas da tela, assentado na base. Substituiu a fusão por gradiente, que dependia da altura da tela para não cair em cima de rótulo. Os botões de opção sobem para a altura `lg` (52px) só no mobile, por CSS sobre `[data-size]`, porque `size` é prop e trocar por media query em JS causaria salto na hidratação. No mobile, botões e campos do login usam raio fixo `--radius-lg` (20): o Safari não tem `corner-shape`, e raio acima de metade da altura (28 em 52, 24 em 44) vira pílula pura lá, o que no iPhone parecia `9999px`. A tela é `100dvh` com `overflow: hidden` em todo tamanho, e o layout raiz põe `data-scroll="locked"` no `html` nas rotas de auth: `globals.css` trava `html` e `body` (`overflow: hidden`, `overscroll-behavior: none`, `body` fixo), o que mata a rolagem elástica do iOS; a lateral é 12 fora e 16 dentro do cartão; o logo fica centrado no espaço que sobra acima do cartão (`grid-template-rows: 1fr auto`).
- Entrada suave em toda troca de tela: `.root` e `.confirmation` de `auth-form.module.css`, mais o `.root` do MFA, rodam a animação `authEnter` (opacidade e 6px de deslize vindo de cima) em `--duration-base` com `--ease-standard`. Como cada rota do grupo monta um elemento novo dentro do `AuthCard` que persiste, a mesma animação cobre navegação entre páginas, troca de etapa no mobile (o bloco que aparece anima) e troca de estado (formulário para "Confirme seu e-mail"). O deslize vem de cima porque contêiner de rolagem não estende a área rolável para trás: descer 6px poderia piscar barra de rolagem no `.content`. `prefers-reduced-motion` já é tratado no `reset.css`, que zera duração de animação e transição.
- Mobile em duas etapas por `data-step` e CSS, sem trocar a árvore: primeiro uma coluna com "Entrar com e-mail e senha" e "Continuar com" Google e GitHub, todos em `outline`; escolhendo e-mail, a coluna some, os campos aparecem e o rodapé "Criar agora" (que já estava na primeira etapa) dá lugar ao texto "Mude a forma de login, voltar", com "voltar" como botão em forma de link. No desktop tudo aparece de uma vez e os elementos só de mobile ficam `display: none` (via invólucro `.mobileOnly`, porque classe de módulo perde do Emotion no próprio botão).
- Opções de entrada (e-mail e provedores) em `size="md"` (44px) com o raio automático de controle, 24, o mesmo do `FieldShell`; o "Entrar" é `size="lg"` (52px) para pesar mais que as opções, por pedido do usuário. Voltar é texto, não botão.
- Provedores: cada botão é um `<form>` com `signInWithOAuth.bind(null, provedor, next)`, então funciona sem JS e o redirecionamento é do servidor. Ícones pelo `BrandIcon` (`components/ui/brand-icon/`): máscara CSS sobre o SVG de `public/brands/<nome>.svg` pintada com `currentColor`, a mesma técnica do `Logo`, então a marca segue a cor do botão nos dois temas. Com `color`, o SVG entra como imagem (`next/image`, sem otimização por ser SVG) na cor original: é o caso do Google, que tem quatro cores. GitHub e Apple são pretos no arquivo, e preto no tema escuro some, então ficam em `currentColor`, que é a versão oficial das duas marcas para fundo escuro. Nunca ícone de marca de outra fonte.
- O divisor "Faça login com e-mail" usa `--color-separator` no texto, a mesma cor das linhas, e sobe 12px para ficar colado à grade de provedores.
- Turnstile com o widget em modo **Invisible** no painel da Cloudflare (decisão de 2026-08-29): nunca desenha nada, então o container fica fora do fluxo (`position: absolute`, 0 por 0), sem cobrar nem o `gap` do grid. O `appearance: "interaction-only"` e o `size: "flexible"` ficam no código como rede de segurança caso o painel volte para Managed. Em desenvolvimento a chave de teste é a invisível (`1x00000000000000000000BB`), que espelha o modo do painel. O botão "Entrar" nasce desabilitado e só libera quando o widget devolve o token (`onVerify`), voltando a travar se expirar. Em desenvolvimento o `.env` usa as chaves de teste da Cloudflare (`1x000...AA`), que sempre passam; as reais ficam comentadas no mesmo arquivo para produção.
- Sem scroll no desktop: `.shell` tem `height: 100dvh` e `overflow: hidden`, e a coluna de conteúdo rola por dentro só se a altura não couber. No mobile o carrossel é `position: fixed`, então o fundo não acompanha a rolagem do cartão.
- Logotipo em 32px e título em `title1`, por pedido de presença. `devIndicators: false` no `next.config.ts` tira o indicador de desenvolvimento do Next, que atrapalhava a leitura da tela.
- Senha: `signInWithPassword` via `useActionState`. Rate limit `auth` por IP, Turnstile quando `TURNSTILE_SECRET_KEY` e `NEXT_PUBLIC_TURNSTILE_SITE_KEY` existem (`hasTurnstile()` em `lib/env.ts`; sem as chaves o widget não monta e a verificação não roda), zod em `signInSchema`, erro genérico "E-mail ou senha incorretos" para não vazar se o e-mail existe. Sucesso redireciona para `next` validado por `nextPathSchema`.
- "Relembrar senha" é comportamento, não enfeite: a action grava o cookie `sp-remember` (`1` ou `0`) e passa `remember` para `createClient`. Com `0`, `scopeToSession` em `lib/supabase/cookies.ts` tira `maxAge` e `expires` dos cookies do Supabase, no servidor e no proxy, então a sessão morre ao fechar o navegador. Com `1` (padrão), fica um ano.
- Erro nas telas de auth não é texto solto no formulário: vai para o `Toast`, pelo hook `useAuthToast` (`features/auth/components/use-auth-toast.ts`). Ele recebe título, mensagem e uma marca de identidade; a marca é o objeto de estado do `useActionState`, que muda a cada envio, então o mesmo erro repetido dispara o toast de novo em vez de passar despercebido. Cobre as três origens: erro da action, aviso de chegada (`?erro=` mapeado em `messages.ts` e o `#error` do fragmento) e Turnstile indisponível. Como o tom é `danger`, o toast fica na tela até a pessoa dispensar.
- `/auth/callback` entrou em `openPrefixes` no proxy. Antes, sem sessão, o callback era redirecionado para `/login` antes de trocar o código e o OAuth nunca fechava.
- Criar conta (`/cadastro`): mesmo `AuthCard` e mesmas duas etapas do mobile, com `SignUpForm` (`features/auth/components/signup-form.tsx`). O CSS é compartilhado em `auth-form.module.css` e os botões de provedor saíram para `OAuthButtons`, usados pelos dois formulários; nada duplicado. Campos: nome (vira `full_name` nos metadados, que a trigger de `profiles` lê), e-mail e senha com piso de 8 no zod (`signUpSchema`). A action `signUpWithPassword` repete o contrato do login (rate limit, Turnstile, erros amigáveis por `error.code`: conta existente, senha fraca) e chama `supabase.auth.signUp` com `emailRedirectTo` no callback. Com confirmação de e-mail ligada não há sessão na resposta: o formulário troca para o estado "Confirme seu e-mail" com o endereço enviado; se a confirmação estiver desligada, redireciona direto para `next`. Consentimento de Termos e Privacidade em texto com links abaixo do botão.
- Cadastro com e-mail já usado é bloqueado com "Já existe uma conta com esse e-mail" e link para o login. Com a proteção de enumeração do Supabase (confirmação ligada), o `signUp` de e-mail já confirmado devolve 200 com um usuário falso de `identities` vazio; é esse o sinal detectado (`data.user.identities.length === 0`, comportamento do `sanitizeUser` do gotrue). Para conta existente ainda NÃO confirmada o Supabase reenvia a confirmação e devolve o usuário real, então a tela cai no estado "Confirme seu e-mail", que é o desejado. Mostrar que a conta existe reabre a enumeração pelo formulário; decisão de produto consciente em troca de UX clara.
- Um usuário, várias formas de login: o Supabase vincula automaticamente identidades OAuth com o mesmo e-mail verificado ao mesmo usuário (padrão do gotrue, sem toggle para desligar). Google e depois GitHub com o mesmo e-mail viram UM usuário com duas identities; `profiles` não duplica porque a trigger é por id. Exceções que geram segunda conta: e-mail não verificado no provedor e e-mails diferentes entre provedores (GitHub com e-mail primário privado noreply). Conta nascida por OAuth ganha senha pelo fluxo de recuperar senha, unificando também o login por e-mail.
- Rate limit de auth em três camadas (`lib/security/rate-limit.ts` + `withinAuthLimit`/`withinEmailLimit` nas actions): por operação e IP (`auth`, 10/min), total por IP somando todas as operações de auth (`authTotal`, 30/min) e por e-mail alvo (`authEmail`, 5 por 15 min) nas ações que disparam e-mail (cadastro, reenvio, recuperação), onde limitar pelo alvo é o objetivo. No LOGIN por senha a chave é IP + e-mail e só FALHA consome a janela: `peekRateLimit` (leitura, sem consumir) barra antes de tentar e `checkRateLimit` registra só depois de senha errada. A revisão adversarial derrubou a primeira versão (chave só por e-mail, consumindo sucesso): 5 logins corretos em 15 min travavam o 6º, e qualquer pessoa com o e-mail da vítima travava o login dela com 5 POSTs por janela.
- Recuperar senha (`/recuperar-senha`): e-mail + Turnstile invisível, `resetPasswordForEmail` e estado de sucesso SEMPRE, inclusive quando o Supabase devolve erro (só loga no servidor). O `/recover` devolve 200 vazio para e-mail inexistente e o cooldown de reenvio (`over_email_send_rate_limit`) só existe para contas reais, então qualquer mensagem diferente viraria oráculo de existência; a revisão adversarial pegou exatamente isso na primeira versão. O e-mail usa o template recovery com token_hash, que leva a `/confirmar-email?type=recovery&next=/redefinir-senha`.
- Redefinir senha (`/redefinir-senha`): exige a sessão criada pela verificação do link; sem sessão mostra "O link não está mais ativo" com atalho para pedir outro. `updateUser({password})` exige aal2 quando o usuário tem TOTP (`insufficient_aal` no gotrue) e a sessão de recovery nasce aal1; o gate `mfaPending` do proxy resolve mandando para `/mfa` com `next=/redefinir-senha` preservado (única rota de auth cujo pathname sobrevive como next nos gates de MFA; `/confirmar-email` volta para `/dashboard` porque o `withNext` zera a query e o token_hash se perderia no caminho), o step-up eleva a aal2 e a troca acontece. Usuário logado pode acessar `/redefinir-senha` direto para trocar a senha; um `insufficient_aal` inesperado redireciona para `/mfa`.
- E-mails de autenticação com a nossa marca: 13 templates em `db/supabase/templates/`, os 6 de ação (confirmação, convite, magic link, redefinição, troca de e-mail e reautenticação) e os 7 avisos de segurança do painel (senha, e-mail e telefone alterados, forma de login conectada e removida, fator MFA adicionado e removido), todos gerados de um esqueleto único. Visual minimalista por decisão de 2026-08-30: fundo branco sem cartão, só o ícone da marca no topo à esquerda, título e texto soltos, botão preto pequeno só quando há ação, rodapé com linha fina, nenhum texto com ponto final. O ícone é `public/logotipo/specular-icon-email.png` (160px exibido a 40px): o ícone preto dentro de um chip branco com borda, tudo no próprio PNG, porque o modo escuro dos clientes de e-mail inverte fundo e texto sem tocar nas imagens e um ícone preto solto desaparecia no fundo escurecido. O chip sobrevive à inversão e fica legível nos dois temas. HTML de e-mail com estilos inline e tabela, logo em PNG (gerado do SVG, e-mail não renderiza SVG). `config.toml` aponta os 6 de ação para o ambiente local; no hospedado é colar tudo no painel e ligar o SMTP do Resend (tabela de slots e assuntos em `setup.md`). Cores literais aqui são exceção consciente: e-mail não tem tema nem tokens.
- Nenhum template de link usa `{{ .ConfirmationURL }}`: esse endereço vai direto ao `/verify` do Supabase e o token é de uso único, então scanner de e-mail corporativo consumia o link antes do clique e a pessoa via `otp_expired` na primeira tentativa. Os links apontam para `/confirmar-email?token_hash={{ .TokenHash }}&type=...` (página no grupo `(auth)`, mesma lista de `publicAuthPaths`, então tema escuro e acesso sem sessão), que mostra um cartão com título por tipo de link e só chama `verifyOtp` no clique do botão, via `confirmEmailWithToken` (server action com rate limit e zod em `token_hash` e `type`). Os estados de sucesso e de link incompleto (e o "Confirme seu e-mail" do cadastro) usam os ícones 3D de `public/3d-icons` (check e error) via `next/image` a 4rem de altura. Scanner faz GET e não consome nada. No sucesso a action redireciona para `next` e o proxy assume (primeiro login cai no `/mfa` pelo gate `mfaMissing`); o proxy não expulsa usuário logado do `/confirmar-email`, porque a troca de e-mail confirma com sessão ativa.
- A tela de confirmação do cadastro tem "Reenviar e-mail" (`resendConfirmation`, com rate limit e trava de 30s no botão), e o `/login` lê o fragmento `#error` que o Supabase devolve quando um link antigo falha e explica em português (link expirado ou usado), limpando o hash da URL.
- MFA (`/mfa`): uma rota, dois estados, tudo solto no AuthCard sem Surface (redesenho de 2026-08-30, seguindo o padrão das outras telas de auth). Com fator TOTP verificado, `MfaVerify`; sem fator, `MfaEnroll`: três ícones de autenticadores sobrepostos (Google Authenticator, Twilio e Microsoft Authenticator, este com o círculo preenchido no azul `#0078d7` do próprio logo, cor literal como exceção consciente de marca), título e descrição centrados, QR cru numa caixa branca sem padding e sem raio (decisão de 2026-08-31: limpo e funcional, a margem interna do próprio SVG basta), chave manual em UMA linha num box tracejado (`text-overflow: ellipsis`, fonte caption) com o "Copiar" dentro do box à direita (toast ao copiar) e `CodeInput` com `fullWidth`. O box é flex com padding de `--space-1` e a borda nele, não no `code`: assim o recuo do botão é o mesmo 4px em cima, embaixo e na direita, e a altura sai do próprio botão, que cresce para o alvo de toque no celular sem estourar a caixa. Não há botão de verificar: completar os 6 dígitos verifica sozinho nas duas telas, com "Verificando o código" durante a espera. A saída é "Sair da conta" em texto. Cantos pelo sistema da casa (`squircle()` no QR, na chave e nas caixas do código). No mobile a tela fica compacta: avatares e a linha de dica somem, o QR encolhe para 8.5rem e o gap cai para `--space-4`.
- O QR é um `<img>` com o data URL do Supabase direto no `src`: o `qr_code` vem como `data:image/svg+xml;utf-8,<svg ...>` sem encode, com aspas duplas dentro, que quebravam o `url("...")` de um `background-image` e o QR nunca renderizava (o bug só apareceu quando o enroll foi ligado no painel; o E2E anterior parava no skeleton). `next/image` não aceita data URL, então é `img` puro com o lint desativado na linha.
- `CodeInput` ganhou `fullWidth`: as caixas crescem por `flex: 1 1 auto` mantendo a base (3rem por 4rem no modo solto; raio lg via `squircle()`, dígito em `--text-title-2`). No `fullWidth` o gap cai para `--space-1` (4px) e as caixas viram QUADRADOS por `aspect-ratio: 1` com altura automática. Com `flex-basis: 0` e `width: auto` cada input voltava à largura intrínseca (~11rem) no cálculo de max-content, a trilha do grid estourava para ~70rem e o conteúdo inteiro saía da vista com scroll horizontal.
- O `.root` das telas de MFA usa `grid-template-columns: minmax(0, 1fr)`: sem isso a trilha implícita do grid cresce pelo max-content dos filhos (a chave em linha única, por exemplo) e a tela inteira ganha scroll lateral no mobile, que foi exatamente o bug reportado no iPhone.
- Confirmação de e-mail continua na aba original: `confirmEmailWithToken` para `type` signup/email não redireciona mais, devolve `done` e o cartão mostra "E-mail confirmado, volte para a outra aba" (com "Continuar por aqui" para quem abriu o link em outro aparelho). Ao confirmar, o cartão emite `confirmed` num `BroadcastChannel("sp-auth")`; a aba do cadastro (estado "Confirme seu e-mail") escuta o canal E faz polling da action `sessionEstablished` a cada 5s (os cookies são do navegador inteiro), e segue sozinha para `next` quando a sessão aparece. Os demais tipos (recovery, invite, magiclink, email_change) continuam seguindo na própria aba, porque o fluxo continua nela por natureza.
- As duas telas de MFA têm prévia na vitrine `/componentes` (grupo "Telas de autenticação"): `MfaEnroll` aceita `preview` com QR e chave falsos e pula o enroll no servidor, então dá para ver o layout em localhost sem sessão; a verificação da prévia falha de propósito. O fluxo real continua exigindo login em `/mfa`.
- `enrollTotp` passa `issuer: siteConfig.name`, então o autenticador salva a conta como "Specular" e não como o host do Site URL do projeto, que é o padrão do Supabase (a URI virava `otpauth://totp/app.specular.com.br:email`). O rótulo é gravado no momento do cadastro: quem já tinha cadastrado antes continua vendo o nome antigo no app até refazer o cadastro do fator.
- `enrollTotp` apaga os fatores TOTP não verificados antes de criar um novo, senão cada visita à tela acumularia um fator pendente; o componente ainda guarda um ref para não repetir a chamada no modo estrito do React.
- Cadastro convidado, não obrigatório (decisão de 2026-09-02): o `updateSession` devolve `mfaMissing` (aal1 sem próximo nível, ou seja, usuário sem nenhum fator verificado) e o proxy manda para `/mfa` na primeira rota protegida, mas a tela tem "Pular por agora". A `skipMfaEnrollment` grava o cookie `sp-mfa-skip` (httpOnly, 30 dias, contrato em `lib/mfa.ts`) e devolve a pessoa para o `next`; enquanto o cookie valer, o proxy para de convidar. Vencido, a tela volta a aparecer uma vez.
- **Step-up não se pula.** O cookie só silencia o convite de cadastrar: `mfaPending` (aal1 com aal2 disponível, ou seja, quem tem autenticador e ainda não digitou o código nesta sessão) continua barrando toda rota protegida sem olhar para ele, e a própria action recusa pular quando o nível seguinte é aal2. Quem pulou volta a cadastrar entrando em `/mfa` direto: sem nenhum fator a rota não devolve mais ao painel, justamente para ser esse caminho de volta.
- O conteúdo do `AuthCard` rola por dentro (`overflow-y: auto` no `.content`), porque o cartão do MFA é mais alto que a tela do celular e a página em si continua travada.
- `PasswordInput` (`components/ui/password-input/`): `Input` com `type` alternado e botão de olho na ponta, `aria-pressed` e rótulo que muda. O ícone de erro do `Field` entra antes do olho, porque o `Field` injeta `iconEnd` e o componente concatena em vez de substituir.
- O formulário não mostra asterisco: `required` vai direto no controle, e o `Field` só injeta `required` quando a prop dele é verdadeira (antes ele sobrescrevia com `false` o que o controle declarava).
- O `matcher` do proxy não usa a cláusula `missing` do exemplo da doc do Next. Ela isenta requisição de prefetch, e isenção do proxy significa rota protegida respondendo 200 sem sessão e sem CSP para quem manda `purpose: prefetch` na mão. O gate roda em toda requisição.
- Arquivo estático novo em `public/` precisa entrar no `matcher` do proxy (`logotipo`, `banners`, `bg`, `brands`, `3d-icons`). Sem isso o proxy trata a imagem como página protegida, responde redirect para `/login`, e o otimizador do `next/image`, que busca o arquivo por HTTP, recebe o redirect no lugar do PNG: a imagem quebra sem erro no console.
