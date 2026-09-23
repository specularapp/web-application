# Bibliotecas externas

Regra: só entra o que está aqui. Lib nova ganha uma linha nesta tabela (necessidade, por quê, descartadas) antes de ser instalada. Critérios: headless e estilizável com nossos tokens, acessível, tree-shakeable, manutenção ativa, compatível com React 19 e Next 16.

## Instaladas

| Lib | Uso |
| --- | --- |
| next, react, react-dom | base |
| @emotion/react, @emotion/styled, @emotion/cache | estilo dos componentes interativos (client), SSR com nonce. Primitivos estáticos usam CSS Modules |
| @phosphor-icons/react | ícones (importar por nome) |
| next/font: Inter, JetBrains Mono | as duas famílias da casa. A Inter é o texto; a **monoespaçada entrou em 2026-09-22** com o bloco de código do texto rico, porque ali a fonte é função e não estilo: é o alinhamento das colunas que faz a indentação de um trecho de código ser legível, e com a proporcional cada linha começava num lugar. Só o subconjunto latino e com `display: swap`, como a de texto; `--font-code` aponta para ela, então a tecla do atalho e o `code` no meio do texto foram junto |
| lowlight, @tiptap/extension-code-block-lowlight | o realce de sintaxe do bloco de código do texto rico (2026-09-22, a pedido de "uma visualização de codigo bem organizada, colorida estilo vs code mesmo"). `lowlight` é o highlight.js sem o DOM: ele devolve uma árvore, e não HTML, o que é justamente o que a casa precisa, porque documento nosso é desenhado nó por nó e nunca injetado. Entra pelo conjunto **`common`**, com as trinta e sete linguagens do dia a dia, e não pela entrada completa, que traz cento e noventa; sem linguagem declarada, ela é adivinhada pelo próprio highlight.js; a extensão do Tiptap é quem leva o realce para dentro do editor, por decoração, e vai presa na versão exata do núcleo instalado, como as outras da família. Descartadas: shiki (carrega gramáticas TextMate e um tema por rede, pesado demais para um bloco dentro de uma ficha) e realce próprio por expressão regular (frágil, e ainda precisaria de um plugin de decoração para o editor) |
| ogl | WebGL mínimo (renderer, programa, malha) para o fundo animado `GradientBlinds` do login. Sem Three.js: 30KB contra 600KB para um único shader |
| cmdk | paleta de comandos |
| zod | validação no servidor e no cliente |
| @supabase/ssr, @supabase/supabase-js | auth, banco, storage, realtime |
| ioredis | cache e rate limit |
| resend | e-mail |
| stripe | pagamentos (servidor) |
| @stripe/stripe-js, @stripe/react-stripe-js | formulário de pagamento dentro da nossa interface. Entrou em 2026-09-01 com a assinatura e em 2026-09-02 trocou o Payment Element pelos elementos avulsos de cartão, cada um dentro do nosso `FieldShell`: rótulo, caixa, erro e botão são nossos, e do Stripe fica só o campo, um iframe por campo. O cartão nunca toca o nosso DOM, então o PCI fica com o Stripe (SAQ A), e as cores saem dos nossos tokens resolvidos em runtime pelo `use-card-style.ts`. Descartadas: Checkout hospedado (leva a pessoa para fora e não aceita a nossa identidade) e campo de cartão próprio no nosso HTML (viraria escopo PCI SAQ D, com certificação nível 1 e liberação do Stripe) |
| openai | IA |
| server-only | impede módulo de servidor no cliente |
| eslint, eslint-config-next, eslint-plugin-jsx-a11y, supabase (dev) | qualidade e banco |
| @xyflow/react | o editor de fluxo das automações (2026-09-15): nós, ligações, arrastar, pan e zoom, alças de conexão e o fundo pontilhado, headless o bastante para os nós serem componentes nossos com os tokens da casa. É o mesmo motor (a família React Flow, irmã do Vue Flow que o n8n usa) das referências do usuário. Só na rota do editor, então o peso não chega às outras telas. Descartadas: canvas próprio em SVG (pan, zoom, toque e ligação à mão são meses de acerto) e rete.js (traz o próprio estilo) |

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
| Gráficos (financeiro, painel, gamificação) | recharts v3 | SVG composável, cores por CSS vars, acessível com ajustes. **Em uso** pelo bloco de projetos do painel (`features/dashboard/components/projects-chart.tsx`): gráfico com `responsive` em vez de `ResponsiveContainer`, cor por classe e regra de CSS (atributo `fill` não lê variável), `accessibilityLayer` desligado e a leitura por voz num texto oculto ao lado | visx (muito trabalho), echarts (pesado) |
| Datas | date-fns v4, @date-fns/tz | tree-shakeable, pt-BR, fuso | dayjs, moment |
| Dinheiro | `Intl.NumberFormat` com inteiros em centavos no banco | sem lib | dinero.js |
| Seletor de data | react-day-picker v10 | acessível, headless, pt-BR. **Em uso** pelo `DatePicker`, tema em `src/styles/vendors/react-day-picker.css` sobre as classes `rdp-*` padrão | kits de UI |
| Editor de texto rico (contrato, descrição de tarefa) | @tiptap/react, @tiptap/starter-kit, @tiptap/extension-text-align, @tiptap/extensions (Placeholder) | headless, extensível, JSON no banco, sanitizado no servidor. **Em uso** no editor de contrato desde 2026-09-14: o documento vai como JSON (`DocNode`) validado por zod no servidor com a lista fechada de nós e marcas, e a tela, a página pública e o PDF o desenham por conta própria, sem HTML injetado. Os pacotes vão presos na mesma versão do `@tiptap/core` instalado (3.30.5), porque cada um exige a versão exata. `@floating-ui/dom` entra declarado ao lado deles (2026-09-17): o `BubbleMenu` de `@tiptap/react/menus` depende dele, mas o menu é dependência opcional do `@tiptap/react` e o npm instala o pacote sem instalar o que ele pede, então o build quebrava com `Module not found` em toda instalação limpa  **Desde 2026-09-22 ele serve também a descrição da tarefa**, pela peça compartilhada `components/ui/rich-text` (o editor, a leitura estática e os nós próprios de lista de marcar e de imagem, escritos com o núcleo do Tiptap em vez de `@tiptap/extension-task-list` e `@tiptap/extension-image`: cada pacote exige a versão exata do núcleo e o que eles fazem cabe em cem linhas nossas). O tipo e o zod da árvore subiram para `lib/rich-doc.ts`, compartilhados pelos dois domínios | Quill |
| Ver PDF no navegador (contrato anexado: marcar onde cada parte assina, e a parte assinar sobre o documento) | pdfjs-dist (v6) | é o motor do Firefox, desenha a página num canvas e a camada dos campos vai por cima em frações da página; entra só no navegador, por importação dinâmica, com o worker do próprio pacote. Entrou em 2026-09-14 | react-pdf (embrulho do mesmo pdf.js, com mais uma camada), iframe do navegador (não deixa pôr nada por cima) |
| Escrever num PDF existente (carimbar as assinaturas e a página de registro no contrato anexado) | pdf-lib | edita o arquivo que a pessoa subiu sem redesenhá-lo, embute PNG e fontes padrão, roda no Node da rota. Entrou em 2026-09-14 | @react-pdf/renderer (só cria PDF do zero, não altera um existente), pdfkit (idem) |
| Toasts | componente próprio (`components/ui/toast/` + `components/providers/toast-provider/`) | identidade completa, comportamento simples e sob controle | sonner, react-toastify |
| Upload | react-dropzone + Supabase Storage com URL assinada | UI headless, servidor gera a URL | uppy |
| Avatar sem foto e arte do catálogo | @dicebear/core (v10) e @dicebear/styles | desenho determinístico pela semente, gerado em código, sem DOM e sem folha injetada, então sai igual no servidor e no cliente. Três estilos em uso, os três escolhidos pelo usuário em 2026-09-16 sobre as páginas de estilo do DiceBear: **Lorelei** no `Avatar`, para cliente e pessoa em geral, só quando não há `src` (esteve em uso de 2026-09-04 a 2026-09-05, saiu para o Adventurer e voltou agora); **Icons** na arte dos itens do catálogo sem foto, para produto e serviço em geral, com o ícone tingido no matiz do item; e **Waves** na capa de um projeto sem imagem, preenchendo a capa inteira no matiz do projeto (o Loops, de voltas abstratas, serviu os dois de 2026-09-08 a 2026-09-16). Todos com fundo transparente, porque quem pinta o fundo é o azulejo de quem chama, no matiz e sensível ao tema. A troca do Loops pelo Icons levou junto o recuo da arte dentro do azulejo, na tela e no PDF: o Icons já desenha o ícone com folga no próprio quadro, em dois terços do lado, e o recuo antigo virava recuo em dobro. Migrado do v9 (`@dicebear/adventurer`) para o v10 em 2026-09-08 porque o Loops só existe no v10, onde os estilos viraram JSON em `@dicebear/styles` lidos por `new Style()`; no v10 os `id` internos já saem com sufixo derivado da semente, então a reescrita do `id` que o v9 pedia saiu, e só o `<metadata>` continua sendo removido. Os desenhos saem pelas rotas `/api/avatar/[token]` e `/api/artwork/[style]/[hue]/[token]` (o estilo entrou no caminho em 2026-09-16, para dois desenhos diferentes dividirem a mesma moldura sem duas rotas iguais), com cache de um ano e CSP fechada, sobre a moldura comum de `lib/generated-svg.ts` (token, validação, cache e cabeçalhos); entram por `components/ui/avatar/shape.ts` e `lib/artwork.ts`, nunca direto em componente; a arte saiu de `features/catalog/` para `lib/` em 2026-09-16, quando o projeto ganhou estilo próprio e ela deixou de ser do catálogo | avvvatars-react (em uso de 2026-08-29 a 2026-09-04: trazia o goober, que injetava `<style>` e exigia `window.__nonce__`), boring-avatars (menos variedade), API HTTP do DiceBear (imagem de terceiro em toda carga, fora da CSP e da sensação de offline) |
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

## Cantos: sem lib

Os cantos usam apenas `border-radius` e os tokens da casa, com os helpers leves de `src/lib/corners.ts`, conforme a seção Cantos de `structure.md`. Não existe biblioteca, motor ou fallback próprio.

`@cornerkit/core` foi usada de 2026-08-28 a 2026-08-29 e saiu. O que aprendemos com ela e vale para qualquer lib de canto que apareça:

- Injetar `<style>` em runtime não passa na nossa CSP por nonce.
- Repintar fundo por SVG filho atrasa um quadro e pisca em elemento que re-renderiza (campo com máscara, tooltip, toast).
- Recorte por `clip-path` corta anel de foco e popover; borda desenhada por SVG cobra layout e quebra conta concêntrica.
- Um observer por elemento não escala para tabela e kanban.
- `@cornerkit/react` expõe hook que não pode ser condicional, e temos variante pílula que não pode ser squircle.

## Padrões trazidos de fora, sem dependência

| Origem | O que veio | Por que não instalamos |
| --- | --- | --- |
| [loading-ui dual arc](https://loading-ui.com/docs/components/dual-arc) | Técnica do `Spinner`: círculo com `border` transparente e só `border-block-color` pintado, girando. Dois arcos opostos sem SVG nem máscara | É registry shadcn com Tailwind, que é proibido aqui, e o componente injeta `<style>` inline em runtime, que a nossa CSP bloqueia. Copiar direto daria spinner parado. Portamos a técnica para CSS Module com tokens, tamanhos e rótulo de leitor de tela |
| [shadcn tooltip](https://ui.shadcn.com/docs/components/base/tooltip) | Visual do `Tooltip`: fundo invertido, 12px, `px-3 py-1.5`, seta quadrada de 10px rotacionada com canto de 2px, entrada com fade, zoom de 95% e slide de 8px, sem borda nem sombra | Depende de Base UI ou Radix, com portal e posicionamento por JS. Não precisamos disso ainda: a bolha é absoluta em relação ao gatilho e a seta cai no centro dele por construção, sem medir nada |
| [figma-squircle](https://github.com/phamfoo/figma-squircle) | A matemática do canto suavizado do Figma em `src/lib/squircle/path.ts`: parâmetros a, b, c, d e o arco por canto, com o orçamento de metade do lado menor | São 60 linhas; a lib traz raio por canto e opções que não usamos, e o motor em volta (observer, cache, fallback) é nosso de qualquer jeito |
| [React Bits GradientBlinds](https://reactbits.dev) | O shader das persianas com gradiente e holofote, em `components/ui/gradient-blinds/`. Portado para TypeScript estrito e Emotion, com cores vindas de tokens resolvidos em runtime, pausa em `prefers-reduced-motion` e aba oculta, e `dpr` limitado a 1.5 | React Bits é biblioteca de copiar e colar, não pacote; o código é nosso e segue as regras da casa |

## Proibidas

- Kits de UI prontos (MUI, Chakra, Ant Design, shadcn como dependência): conflitam com tokens e acessibilidade própria.
- Tailwind: a decisão é Emotion com tokens.
- moment, lodash inteiro, xlsx (SheetJS via npm), react-beautiful-dnd.

## Componentes próprios (sem lib)

### Toast

Implementado em 2026-08-29. Componente visual em `components/ui/toast/`, fila e timers em `components/providers/toast-provider/`, montado no layout raiz.

- API: `useToast()` devolve `toast({ title, description, tone?, action?, duration? })`, que retorna o id, e `dismiss(id)`. Tones: `neutral`, `info`, `success`, `warning`, `danger`, cada um com ícone Phosphor em `fill` na cor do token.
- Todo toast tem ícone, título, descrição e um botão de ação. Não existe botão de fechar: a ação fecha, e sem `action` o botão vira "Entendi". Decisão de produto de 2026-08-29.
- Máximo de 3 visíveis, o resto espera na fila e só começa a contar ao aparecer.
- Posição: canto superior direito no desktop; largura total no topo no mobile, com `safe-area-inset-top`.
- Visual: vidro das camadas da casa (`--glass-layer-bg` com `--glass-layer-blur`, desde 2026-09-07; antes era `--color-bg-grouped-secondary` opaco), fio de 0,6px em `--color-border`, `--radius-xl` com canto nativo, `--shadow-lg`, título em `subheadline` semibold e descrição em `footnote` secundária. Botão de ação `sm` com raio `md`, concêntrico ao toast. Erro usa o botão primário, os outros o secundário.
- Acessibilidade: `role="alert"` para `warning` e `danger`, `role="status"` para o resto, com `aria-labelledby` e `aria-describedby`; pausa o timer em hover e foco; fecha com Escape quando focado; a ação é um `Button` comum, acessível por teclado.
- Movimento: entrada com `--ease-spring` em `--duration-slow`, saída em `--duration-base`, só `transform` e `opacity`; nada em `prefers-reduced-motion`.
- Duração padrão 5s; `danger` não fecha sozinho.
- Server Actions devolvem `{ toast }` no resultado e o cliente dispara; nunca disparar toast a partir de dados do servidor sem passar pelo zod do resultado.

## Cache e velocidade

Nada novo foi instalado para isto. O cache de leitura repetida é o `ioredis` que já servia o teto de
requisições, com a camada da casa em `lib/cache/`: chave por organização e por filtro, tag por domínio e
invalidação na escrita. A memorização por requisição é o `cache` do React, que vem no próprio React. Os
esqueletos de rota são o `Skeleton` da casa em `loading.tsx`.

O que foi avaliado e **não** entrou:

| Necessidade | Descartada | Por quê |
| --- | --- | --- |
| Cache de dados por rota | `use cache` / `cacheComponents` do Next 16 | guarda por rota e argumento, sem saber quem pediu; aqui tudo é por pessoa e por organização. A variante que entende sessão (`use cache: private`) não guarda nada no servidor, então não ajuda entre instâncias |
| Fila para as automações agendadas | — | continua pendente: entra com o `inngest`, que já está mapeado acima |
