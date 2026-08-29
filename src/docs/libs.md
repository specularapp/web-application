# Bibliotecas externas

Regra: só entra o que está aqui. Lib nova ganha uma linha nesta tabela (necessidade, por quê, descartadas) antes de ser instalada. Critérios: headless e estilizável com nossos tokens, acessível, tree-shakeable, manutenção ativa, compatível com React 19 e Next 16.

## Instaladas

| Lib | Uso |
| --- | --- |
| next, react, react-dom | base |
| @emotion/react, @emotion/styled, @emotion/cache | estilo dos componentes interativos (client), SSR com nonce. Primitivos estáticos usam CSS Modules |
| @phosphor-icons/react | ícones (importar por nome) |
| @cornerkit/core | **obrigatória em todo border-radius**: cantos squircle no padrão Apple. Ver a seção Cantos |
| cmdk | paleta de comandos |
| zod | validação no servidor e no cliente |
| @supabase/ssr, @supabase/supabase-js | auth, banco, storage, realtime |
| ioredis | cache e rate limit |
| resend | e-mail |
| stripe | pagamentos |
| openai | IA |
| server-only | impede módulo de servidor no cliente |
| eslint, eslint-config-next, eslint-plugin-jsx-a11y, supabase (dev) | qualidade e banco |

## Instaladas, a usar quando a feature entrar

| Necessidade | Lib | Por quê | Descartadas |
| --- | --- | --- | --- |
| Tabela de dados | @tanstack/react-table v9 | headless total: ordenação, filtro, agrupamento, colunas, seleção; estilo 100% nosso | AG Grid e MUI DataGrid (tema e peso próprios) |
| Listas e tabelas grandes | @tanstack/react-virtual | milhares de linhas sem travar, headless | react-window |
| Kanban, arrastar e soltar, reordenar | @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/modifiers | acessível por teclado, sensores touch e mouse, headless, rápido | react-beautiful-dnd (abandonado), Pragmatic drag and drop (a11y manual) |
| Formulários | react-hook-form, @hookform/resolvers | sem re-render por tecla, integra zod v4 e Server Actions | Formik |
| Exportar CSV | função própria em `lib/utils` | 20 linhas resolvem | papaparse |
| Exportar XLSX | exceljs (no servidor, Route Handler) | estilos, larguras, abas; sem risco de supply chain | xlsx/SheetJS (npm desatualizado) |
| Exportar PDF (orçamento, contrato, cobrança, currículo) | @react-pdf/renderer (no servidor) | layout em React com controle total e fontes próprias | puppeteer (pesado em serverless), jsPDF (layout manual) |
| Gráficos (financeiro, painel, gamificação) | recharts v3 | SVG composável, cores por CSS vars, acessível com ajustes | visx (muito trabalho), echarts (pesado) |
| Datas | date-fns v4, @date-fns/tz | tree-shakeable, pt-BR, fuso | dayjs, moment |
| Dinheiro | `Intl.NumberFormat` com inteiros em centavos no banco | sem lib | dinero.js |
| Seletor de data | react-day-picker v10 | acessível, headless, pt-BR. **Em uso** pelo `DatePicker`, tema em `src/styles/vendors/react-day-picker.css` sobre as classes `rdp-*` padrão | kits de UI |
| Editor de texto rico (contrato, proposta) | @tiptap/react, @tiptap/starter-kit | headless, extensível, JSON no banco, sanitizado no servidor | Quill |
| Toasts | componente próprio (`components/ui/toast/` + `components/providers/toast-provider/`) | identidade completa, comportamento simples e sob controle | sonner, react-toastify |
| Upload | react-dropzone + Supabase Storage com URL assinada | UI headless, servidor gera a URL | uppy |
| Animação | motion, só onde CSS não resolve (kanban) | layout animations | |
| E-mail | @react-email/components | templates em React para o Resend | |
| Máscaras (CPF, CNPJ, telefone, moeda) | react-number-format | input controlado com máscara. **Em uso**: entra pelo `Input` com a prop `mask`, padrões em `src/lib/masks.ts`. Nunca importar direto em feature | |
| Validação CPF e CNPJ | função própria em `lib/utils` | algoritmo simples | brazilian-utils |
| Estado global de UI | React context; zustand só se necessário | simplicidade | redux |
| Dados no cliente | Server Components, actions e `useOptimistic`; Supabase Realtime no kanban | evita cache duplicado | TanStack Query (reavaliar) |
| Rate limit | implementação própria com ioredis | já temos Redis | @upstash/ratelimit (fala REST do Upstash, não o TCP do ioredis: exigiria segunda conexão e prendia a um fornecedor) |
| Testes | vitest, @testing-library/react, playwright (instalar junto com a configuração) | padrão Next 16 | jest |

## Mapeadas, ainda não instaladas

Aprovadas na tabela, sem `npm install` até a feature entrar.

| Necessidade | Lib | Por quê | Descartadas |
| --- | --- | --- | --- |
| Rastreamento de erros e integridade operacional | @sentry/nextjs, ao publicar | source maps do Next 16, captura em Server Component, Server Action e Route Handler, e liga erro a release. Instalar junto com a configuração de deploy | próprio (sem agregação nem alerta) |
| Fila, retry de webhook e processamento assíncrono (Stripe, Resend, n8n) | inngest | roda por HTTP em serverless, com retry, passo durável e concorrência. O deploy é Vercel | bullmq (exige worker Node sempre ligado, inviável em serverless, mesmo reaproveitando o ioredis) |
| Server Actions com validação e autenticação | next-safe-action | tipa entrada e saída de ponta a ponta e centraliza zod, sessão e erro num middleware, no lugar do `unknown` + `safeParse` + `ActionResult` repetido em cada action | wrapper próprio (mesma ideia, mas manutenção nossa) |

### Antes de adotar next-safe-action

`features/auth/actions.ts` já define o padrão da casa: entrada `unknown`, `safeParse` por argumento e retorno `ActionResult<T>` (`{ ok, data } | { ok, error }`), com mensagem de erro em português. A lib traz convenção própria de retorno, então a adoção precisa ou mapear para esse contrato ou migrar as actions existentes de uma vez. Não misturar os dois estilos, conforme `rules.md`.

### Não adotadas

| Proposta | Motivo |
| --- | --- |
| @t3-oss/env-nextjs | `lib/env.ts` já valida com zod e é lazy por serviço: só exige as variáveis da integração em uso. O t3 valida tudo no boot, o que obrigaria toda variável a existir em todo ambiente. Seria regressão |

## Cantos: @cornerkit/core é obrigatória

Todo canto arredondado do produto passa pelo cornerKit. Não existe canto redondo "na mão".

Como usar:

- O raio vem de `src/lib/corners.ts`, nunca um número solto. `squircle("lg")` devolve `data-squircle` e `data-squircle-radius` já convertidos de token para pixel.
- `squircleAuto()` emite só `data-squircle`, sem raio. O provider lê o `border-radius` computado e preenche o atributo antes de chamar `auto()`. É o que permite raio decidido no CSS (escada do `Surface`, media query) sem repetir número em TS. Atributo declarado sempre vence a leitura.
- `SquircleProvider` fica montado no layout raiz e roda `auto()`, que varre `[data-squircle]` e reaplica a cada navegação. Por isso primitivo estático continua Server Component e sem JS próprio: ele só emite os atributos.
- `border-radius` continua no CSS junto com os atributos. Ele é o que aparece antes do JS rodar e onde o cornerKit cai no fallback.
- Pílula e círculo (`--radius-full`) **não** recebem `data-squircle`. Capsule da Apple é arco de circunferência; superelipse no raio máximo distorce.
- Decorativo minúsculo e repetido em massa fica de fora: os traços do `Progress`, dezenas por barra com 2 a 12px de raio, usam `border-radius` puro. Nesse tamanho a superelipse é invisível e um clip por traço custaria observers às dezenas por barra. Máscara não serve aqui: gradiente não tem canto, e o traço precisa ser arredondado. As 42 células do calendário do `DatePicker` ficam de fora pelo mesmo motivo; o popover que as envolve é squircle.
- `CORNER_SMOOTHING` é 0.6, o valor iOS. Fica num lugar só.

O que saber antes de mexer:

- **Elemento com borda precisa da cor, não só da largura.** O cornerKit só entra no caminho de SVG se `border.color` existir: a checagem é `width > 0 && (color || gradient)`. Passar só a largura cai no caminho de `clip-path`, e aí a borda CSS segue o arco circular enquanto o recorte segue a superelipse, então ela aparece quebrada no canto. Por isso `squircle("lg", { color: "var(--color-separator)" })`. A cor pode ser `var(...)`: o atributo aceita qualquer string e vira `style.stroke` no path, que resolve porque o SVG é filho do elemento.
- **Com borda não existe recorte.** Nesse caminho o cornerKit insere um `<svg class="cornerkit-border">` como primeiro filho e limpa o `clip-path`. Some o problema de `outline` cortado. Sem borda ele usa `clip-path: path(...)`, e só aí o anel de foco precisa ser interno.
- **A CSP bloqueia o estilo que o cornerKit injeta.** Ele faz `document.head.appendChild` de um `<style id="cornerkit-svg-border-styles">` que posiciona `.cornerkit-border` em `position: absolute` com `z-index: -1`. Sem nonce isso não passa no nosso `style-src`, e o SVG entraria no fluxo empurrando o conteúdo. Por isso a regra `.cornerkit-border` está no nosso `globals.css`. Se atualizar a lib, confira se essa regra mudou.
- No caminho com borda ele força `background-color: transparent !important` e `box-shadow: none !important` no elemento e repinta pelo SVG lendo `--ck-background`. Todo elemento squircle declara `--ck-background` e `--ck-border-color`.
- O `globals.css` zera a borda CSS quando o SVG existe (`:has(> .cornerkit-border)`) ou quando há recorte, com `!important`. Antes do JS rodar a borda CSS aparece normal, como fallback. O `!important` não é preguiça: sem ele, qualquer regra de componente com dois seletores (`.classe[data-invalid]`, por exemplo) empata em especificidade e vence pela ordem, porque o Emotion injeta depois da folha global. O resultado é borda CSS e borda SVG desenhadas juntas, uma sobre a outra.
- `INPUT`, `SELECT`, `TEXTAREA`, `IMG`, `VIDEO`, `CANVAS` e outros elementos vazios ou substituídos não aceitam o SVG filho: neles o cornerKit cai no `clip-path` mesmo com borda, e a borda quebra no canto. **Solução da casa: o campo mora dentro de um `<span>` que leva a borda e o squircle, e o controle fica transparente e sem borda por dentro.** É o que o `Input` faz. O foco vai para o invólucro por `:focus-within`, e sobra espaço para ícone quando precisar.
- Ícone dentro de botão é `currentColor` por padrão no Phosphor, então herda a cor do texto sozinho. Não pinte ícone à mão.
- O `auto()` **não** observa mutação de DOM: ele varre `[data-squircle]` uma vez e registra um IntersectionObserver só para o que está fora da tela. Elemento criado depois (diálogo, item de lista, badge condicional) nunca seria desenhado. Por isso o `SquircleProvider` mantém um `MutationObserver` próprio, com `requestAnimationFrame` para agrupar e ignorando inserção do próprio `.cornerkit-border`, senão o desenho realimentaria a varredura.
- O provider destrói e recria a instância a cada navegação. O registro do cornerKit não poda elemento removido do DOM, então sem isso os observers acumulariam a cada rota.
- O React **não** apaga o que o cornerKit escreve em `style`: no diff ele só limpa chave que ele mesmo tinha posto antes. Convivem sem briga.
- Toda variante de botão passa borda, inclusive as de borda transparente. Sem borda o cornerKit usaria `clip-path`, que corta o `outline` do foco, e o anel ficaria por dentro em umas variantes e por fora em outras. Uniformidade vale o SVG a mais.
- `@cornerkit/react` foi avaliada e não ficou: expõe `useSquircle`, e hook não pode ser condicional. O Button tem variante pílula que não pode ser squircle, então precisaria chamar o hook sempre e desligar por dentro. Atributo resolve nos dois casos, e serve a Server Component, que o hook não serve.

## Padrões trazidos de fora, sem dependência

| Origem | O que veio | Por que não instalamos |
| --- | --- | --- |
| [loading-ui dual arc](https://loading-ui.com/docs/components/dual-arc) | Técnica do `Spinner`: círculo com `border` transparente e só `border-block-color` pintado, girando. Dois arcos opostos sem SVG nem máscara | É registry shadcn com Tailwind, que é proibido aqui, e o componente injeta `<style>` inline em runtime, que a nossa CSP bloqueia. Copiar direto daria spinner parado. Portamos a técnica para CSS Module com tokens, tamanhos e rótulo de leitor de tela |
| [shadcn tooltip](https://ui.shadcn.com/docs/components/base/tooltip) | Visual do `Tooltip`: fundo invertido, 12px, `px-3 py-1.5`, seta quadrada de 10px rotacionada com canto de 2px, entrada com fade, zoom de 95% e slide de 8px, sem borda nem sombra | Depende de Base UI ou Radix, com portal e posicionamento por JS. Não precisamos disso ainda: a bolha é absoluta em relação ao gatilho e a seta cai no centro dele por construção, sem medir nada |

## Proibidas

- Kits de UI prontos (MUI, Chakra, Ant Design, shadcn como dependência): conflitam com tokens e acessibilidade própria.
- Tailwind: a decisão é Emotion com tokens.
- moment, lodash inteiro, xlsx (SheetJS via npm), react-beautiful-dnd.

## Componentes próprios (sem lib)

### Toast

Contrato para implementar quando chegar a hora, já alinhado à identidade:

- API: `useToast()` devolve `toast({ title, description?, tone?, action?, duration? })` e `dismiss(id)`. Tones: `neutral`, `success`, `warning`, `danger`, `info` (cores dos tokens, ícone Phosphor por tone).
- Estado em `ToastProvider` (context), montado uma vez no shell do app. Máximo de 3 visíveis, fila para o resto.
- Posição: canto inferior direito no desktop; largura total na base no mobile, respeitando `safe-area-inset-bottom`.
- Visual: superfície `--color-bg-grouped-secondary`, borda `--color-separator`, `--radius-xl`, `--shadow-lg`, tipografia `subheadline` para título e `footnote` para descrição, faixa ou ícone na cor do tone.
- Acessibilidade: container `aria-live="polite"` para neutral/success/info e `role="alert"` para warning/danger; botão fechar com `aria-label`; pausa o timer em hover e foco; fecha com Escape quando focado; ação sempre acessível por teclado.
- Movimento: entrada e saída com `--duration-base` e `--ease-standard`; sem animação em `prefers-reduced-motion`.
- Duração padrão 5s; danger não fecha sozinho se tiver ação.
- Server Actions devolvem `{ toast }` no resultado e o cliente dispara; nunca disparar toast a partir de dados do servidor sem passar pelo zod do resultado.
