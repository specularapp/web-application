# Bibliotecas externas

Regra: só entra o que está aqui. Lib nova ganha uma linha nesta tabela (necessidade, por quê, descartadas) antes de ser instalada. Critérios: headless e estilizável com nossos tokens, acessível, tree-shakeable, manutenção ativa, compatível com React 19 e Next 16.

## Instaladas

| Lib | Uso |
| --- | --- |
| next, react, react-dom | base |
| @emotion/react, @emotion/styled, @emotion/cache | estilo dos componentes interativos (client), SSR com nonce. Primitivos estáticos usam CSS Modules |
| @phosphor-icons/react | ícones (importar por nome) |
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
| Seletor de data | react-day-picker v10 | acessível, headless, pt-BR | kits de UI |
| Editor de texto rico (contrato, proposta) | @tiptap/react, @tiptap/starter-kit | headless, extensível, JSON no banco, sanitizado no servidor | Quill |
| Toasts | componente próprio (`components/ui/toast.tsx` + `providers/toast-provider.tsx`) | identidade completa, comportamento simples e sob controle | sonner, react-toastify |
| Upload | react-dropzone + Supabase Storage com URL assinada | UI headless, servidor gera a URL | uppy |
| Animação | motion, só onde CSS não resolve (kanban) | layout animations | |
| E-mail | @react-email/components | templates em React para o Resend | |
| Máscaras (CPF, CNPJ, telefone, moeda) | react-number-format | input controlado com máscara | |
| Validação CPF e CNPJ | função própria em `lib/utils` | algoritmo simples | brazilian-utils |
| Estado global de UI | React context; zustand só se necessário | simplicidade | redux |
| Dados no cliente | Server Components, actions e `useOptimistic`; Supabase Realtime no kanban | evita cache duplicado | TanStack Query (reavaliar) |
| Rate limit | implementação própria com ioredis | já temos Redis | @upstash/ratelimit |
| Testes | vitest, @testing-library/react, playwright (instalar junto com a configuração) | padrão Next 16 | jest |
| Monitoramento | Sentry, ao publicar | | |

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
