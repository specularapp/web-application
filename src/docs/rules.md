# Regras do projeto

Leitura obrigatória antes de qualquer ação no código, a cada mensagem. Valem para todo código, texto e documentação, sem exceção.

## 1. Escrita e comunicação

- Nunca usar travessão ou ponto como separador em títulos, textos, labels ou nomes.
- Português brasileiro em rotas, textos de interface e documentação. Inglês em identificadores de código (variáveis, funções, arquivos de lib e features).

## 2. Código

- Comentários só quando indispensáveis. O código deve se explicar pelo nome.
- Reaproveitar componentes, hooks e utilitários existentes. Nunca duplicar nem criar algo sem necessidade.
- Seguir o padrão das páginas e componentes já existentes, sem fugir.
- TypeScript estrito. Nada de `any`.
- Nenhuma regra de negócio dentro de `src/app`. Páginas apenas compõem `features` e `components`.
- Toda regra de negócio precisa servir web e mobile: no banco (RLS, funções, triggers) ou em `features/<dominio>/service.ts` exposto por Server Action e por Route Handler em `api/v1`. Nunca só em Server Action.
- Estilo com tokens de `src/styles/tokens.css` (paleta Apple, claro e escuro). Nunca valores soltos de cor, espaçamento ou tipografia. Todo componente funciona nos dois temas. Primitivo sem interação: Server Component com CSS Module e variantes `data-*`. Interativo: Emotion com `"use client"`.

## 3. Interface: obrigatório em literalmente todo código de UI

### Metadados

- Toda página exporta `metadata` usando `createMetadata` de `src/lib/metadata.ts` com título, descrição e `path` (canonical e Open Graph).
- Páginas privadas e páginas acessadas por token são `noindex`.
- Páginas dinâmicas usam `generateMetadata` com dados reais assim que existirem.

### Responsividade

- Mobile first. Tudo funciona a partir de 320px de largura.
- Unidades relativas (`rem`, `%`, `dvh`). Nada de largura fixa que quebre.
- Tabelas, gráficos e blocos largos rolam dentro do próprio container, nunca a página inteira na horizontal.
- Alvos de toque com no mínimo 44px.

### Acessibilidade

- HTML semântico (`main`, `nav`, `header`, `section`, `button`, `a`) antes de qualquer `div`.
- Hierarquia de headings correta, um `h1` por página.
- Todo campo de formulário com `label` associado e mensagens de erro anunciadas.
- Foco visível e navegação completa por teclado, incluindo modais e menus.
- Contraste mínimo AA. Imagens com `alt` descritivo ou `alt=""` quando decorativas.
- `aria-*` somente quando o elemento semântico não resolve.
- Respeitar `prefers-reduced-motion` em qualquer animação.
- Todo componente funciona nos dois temas, só com tokens. Mapa em `src/docs/theme.md`.

## 4. Segurança

- Toda entrada de usuário validada no servidor com `zod`, mesmo que já validada no cliente.
- Nenhum segredo no cliente. Só variáveis `NEXT_PUBLIC_` chegam ao browser.
- Nunca `localStorage`, `sessionStorage` ou `IndexedDB` para token, sessão ou dado pessoal. Preferência de UI vai em cookie. O lint bloqueia. Mapa completo em `src/docs/security.md`.
- Supabase com RLS ativa em todas as tabelas. A chave secreta só existe no servidor.
- Webhooks (Stripe, Resend, n8n) sempre verificam assinatura antes de processar.
- Rate limit em rotas públicas, autenticação e endpoints de IA.
- Links públicos para clientes usam token aleatório com expiração.
- Headers de segurança centralizados em `next.config.ts` e `src/proxy.ts`.
- Banco: toda tabela com RLS e `organization_id`; funções `security definer` com `search_path` vazio; `anon` sem execute em funções por padrão; tokens só como hash. Detalhes em `db/README.md`.

## 5. Performance

- Sensação de offline: Server Components por padrão, `loading.tsx` ou `Suspense` por segmento, prefetch em links, cache em Redis para leituras repetidas, revalidação por tag.
- Client Components só onde há interação real.
- Imagens via `next/image`, fontes via `next/font`.
- Nenhuma dependência nova sem necessidade clara. Só bibliotecas listadas em `src/docs/libs.md`; lib nova entra na tabela antes de ser instalada.

## 6. Processo

- Ler `rules.md`, `objective.md` e `structure.md` antes de agir.
- Ao terminar qualquer alteração, rodar `npm run typecheck`, `npm run lint` e `npm run build`.
- Ao encerrar o dia, registrar feitos, tempo e pendências em `src/docs/history.md`.
