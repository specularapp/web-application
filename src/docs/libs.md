# Bibliotecas externas

Regra: só entra o que está aqui. Lib nova ganha uma linha nesta tabela (necessidade, por quê, descartadas) antes de ser instalada. Critérios: headless e estilizável com nossos tokens, acessível, tree-shakeable, manutenção ativa, compatível com React 19 e Next 16.

## Instaladas

| Lib | Uso |
| --- | --- |
| next, react, react-dom | base |
| @emotion/react, @emotion/styled, @emotion/cache | estilo dos componentes interativos (client), SSR com nonce. Primitivos estáticos usam CSS Modules |
| @phosphor-icons/react | ícones (importar por nome) |
| ogl | WebGL mínimo (renderer, programa, malha) para o fundo animado `GradientBlinds` do login. Sem Three.js: 30KB contra 600KB para um único shader |
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

## Cantos: sem lib

O canto squircle é do sistema de cantos da casa (`src/lib/corners.ts` e `src/lib/squircle/`), documentado na seção Cantos de `structure.md`. Nativo por `corner-shape` onde existe, recorte próprio por `clip-path` no fallback, sem dependência.

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
- Visual: superfície `--color-bg-grouped-secondary`, borda `--color-border`, `--radius-xl` com canto nativo, `--shadow-lg`, título em `subheadline` semibold e descrição em `footnote` secundária. Botão de ação `sm` com raio `md`, concêntrico ao toast. Erro usa o botão primário, os outros o secundário.
- Acessibilidade: `role="alert"` para `warning` e `danger`, `role="status"` para o resto, com `aria-labelledby` e `aria-describedby`; pausa o timer em hover e foco; fecha com Escape quando focado; a ação é um `Button` comum, acessível por teclado.
- Movimento: entrada com `--ease-spring` em `--duration-slow`, saída em `--duration-base`, só `transform` e `opacity`; nada em `prefers-reduced-motion`.
- Duração padrão 5s; `danger` não fecha sozinho.
- Server Actions devolvem `{ toast }` no resultado e o cliente dispara; nunca disparar toast a partir de dados do servidor sem passar pelo zod do resultado.
