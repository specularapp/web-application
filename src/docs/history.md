# Histórico

Registro por dia do que foi feito e do tempo investido. Atualizar ao encerrar cada dia de trabalho. Tempo pelos horários de commit quando não anotado; ajuste se a sessão começou antes.

| Dia | Tempo | Resumo |
| --- | --- | --- |
| 2026-08-27 (qua) | ~3h (19:30 a 22:40) | Fundação completa: estrutura, auth, banco multi-tenant, segurança, tema, libs e primitivos |
| 2026-08-28 (qui) | ~5h (noite, até ~01:00 de 29) | Design system: cantos squircle com cornerKit, Button, Text, Surface, Progress, Spinner, campos com máscara, DatePicker, Tooltip e vitrine em /componentes |
| 2026-08-29 (sex) | em andamento | DatePicker em bottom sheet no mobile, canto nativo em campo e tooltip, Badge com modelo de cor por matiz, Listbox extraído e Pagination |

## 2026-08-27

Tempo: ~3h (primeiro commit 19:30, último 22:32). Commits: `7a4d655`, `f444d22`, `4517ac9`.

Feito:

- Docs de escopo reorganizados (`rules`, `objective`, `structure`) e criados `setup`, `security`, `theme`, `libs`.
- Estrutura Next 16: grupos `(marketing)`, `(auth)`, `(app)`, `(public)`, 44 rotas vazias com metadados via `createMetadata`, robots, sitemap, manifest, favicon derivado do logo, OG image.
- Tokens da paleta Apple com `light-dark()`, reset puro (sem zoom em input no mobile), fontes Inter, Geist Mono e Playfair Display.
- Credenciais: env validado por serviço, `env:check` pingando Supabase, OpenAI, Resend, Stripe e Redis. Todos ✓; n8n fica para depois.
- Auth Supabase: OAuth GitHub e Google ativos, MFA TOTP com step-up no proxy, callback seguro, actions de enroll/verify/unenroll. Apple aguarda conta Developer.
- Banco em `db/migrations/<dominio>/` com ledger gerado para o CLI: profiles, organizations (membros, convites por hash, papéis, funções RPC) e hardening (anon sem execute). Tipos gerados.
- Segurança: CSP por nonce (Emotion com nonce), headers, lint proibindo Web Storage, tema por cookie sem script inline.
- Libs decididas e instaladas (tabela, kanban, forms, exportação, gráficos, datas, editor, upload). Toast será próprio.
- Componentes: stubs de UI e layout; implementados Text, Stack/Inline, Container, Separator, Kbd, Label, Field, TextLink, Progress, Spinner, Skeleton, Table e Logo como Server Components com CSS Modules.
- Repositório `specularapp/web-application` criado, `main` publicada.

Pendências para o próximo dia:

- Componentes interativos em Emotion (Button, Input, Select, Checkbox, Switch, Dialog, Toast).
- Shell do app (Sidebar, Topbar, AppShell) e a tela de login.
- Redis: URL correta configurada e validada (ping PONG). n8n e Apple continuam para depois.

## 2026-08-28

Tempo: ~5h, estimado pelos commits (23:03) e pelo log do dev server (última atividade ~00:50 de 29). Commits: `8e7c9ac`, `0323e3e`, `b34d3f3`, `9b25daa`, `2278b4c`, `283e889`, `9635b0e` e o de docs.

Feito:

- Bug de CSP que derrubava todo estilo do Emotion: as tags `<style>` do registry saíam sem nonce. Uma linha, mas sem ela nenhum componente interativo renderizava estilo.
- Cantos squircle da Apple com `@cornerkit/core`, obrigatório em todo canto. Escala de raios em passos de 4px para o encaixe concêntrico. `squircle()` em `lib/corners.ts`, provider com MutationObserver próprio e raio lido do CSS quando não declarado.
- Descobertas lendo o dist do cornerKit, todas em `libs.md`: borda precisa da cor e não só da largura; com borda não há `clip-path`; a CSP bloqueia o `<style>` que ele injeta; `auto()` não observa mutação; `isolation: isolate` em todo elemento com borda cria contexto de empilhamento por campo.
- Button e IconButton: variantes, tamanhos, raio proporcional à altura, ícone com peso casando com o texto, `locked` com etiqueta de plano concêntrica, hover só de cor.
- Text com tracking por faixa de tamanho e número sempre em Inter.
- Surface: container aninhável com escada 40/16, 24/12, 12/8, 4/8.
- Progress tracejado, Spinner dual arc portado do loading-ui, Skeleton circular.
- Campos: FieldShell, Input com máscaras brasileiras sobre NumberFormatBase, afixo R$ e % em semibold, Field com erro em tooltip após preencher e sair, rótulo alinhado ao texto digitado, DatePicker sobre react-day-picker com legenda própria e popover por portal, Tooltip no visual do shadcn com seta centrada por geometria.
- Vitrine pública `/componentes` em caixotes por grid, liberada no proxy.

Decisões de produto registradas como desvio consciente de `rules.md`:

- Campo de texto sem anel de foco e sem marcação de autofill.
- Foco dentro do calendário em `--color-label`, não em `--color-focus`.

Pendências:

- Stubs restantes: Avatar, Badge, Card (nascer sobre Surface), Checkbox, Dialog, DropdownMenu, EmptyState, Radio, Select (nascer do listbox do DatePicker), Switch, Tabs, Textarea, Toast, e todo o layout (AppShell, Sidebar, Topbar, ThemeToggle...).
- ThemeToggle: a vitrine ainda depende do tema do sistema para conferir claro e escuro.
- Redis com URL correta, n8n e Apple continuam de antes.

## 2026-08-29

Tempo: em andamento. Commits até agora: `7bb9fbe`, `985620c`, `1a948e6`, `bdd98eb`, `8d0c779` e o do Badge.

Feito:

- Rótulo do Field rente à caixa, campo e tooltip com `corner-shape: squircle` nativo no lugar do cornerKit (motivo em `libs.md`), dropdown do calendário abrindo com o selecionado no topo, DatePicker como bottom sheet abaixo de 48rem.
- Badge: primitivo estático em CSS Module. Modelo de cor por matiz único (`--badge-hue`) que deriva tinta, tint e linha com `color-mix()` e `light-dark()`, contraste AA conferido por cálculo nos dois temas para as 19 cores. Variantes soft, solid e outline; tamanhos sm, md e lg com raio da escala; squircle pelo cornerKit ou pílula; ícone, só ícone com label obrigatório e contagem. A variante com ponto colorido foi feita e removida no mesmo dia, por decisão de produto. `matchIconWeight` saiu do Button para `components/ui/icons.ts` e serve aos dois.
- Listbox: o `CaptionDropdown` do calendário saiu para `components/ui/listbox/`, genérico, com `placement` (dropup) e `prefix`. Ids por índice, gatilho estilizável por variáveis locais. O `popIn` do popover foi para `styles.ts` e serve ao Listbox e ao DatePicker.
- Pagination: barra controlada com dropup de quantidade, faixa "1 a 30 de 720" e grupo com página atual, anterior e próxima em `IconButton`. Raios 22/18 na escala do botão de ícone, canto nativo com linha por `box-shadow` (motivo em `structure.md`). Nunca quebra linha; no mobile fica só o grupo de página. Demos client em `app/componentes/demos.tsx`.
- Checkbox: input nativo invisível sobre quadrado com `corner-shape` nativo no raio xs e ícone centrado por grid, estados por `:has()` e variáveis locais, indeterminado por prop. A primeira versão com cornerKit quebrou no browser do usuário (caixa invisível, ícone fora do lugar) e saiu.
- Switch: mesmo esqueleto do Checkbox com `role="switch"`, trilho em pílula 28 por 64, polegar largo deslizando por `translate` calculado das variáveis, verde do sistema ligado, tamanhos sm e md.
- Avatar e AvatarGroup: iniciais ou imagem por `next/image`, tamanhos xs a lg na escala dos controles, círculo ou squircle com raio em metade do lado, grupo sobreposto com anel na cor do fundo.
- Pagination com larguras fixas (indicador 5.5rem, faixa 12rem) para não pulsar ao trocar de página.
- Toast e ToastProvider: sempre ícone, título, descrição e botão de ação, sem fechar. Fila de 3, timer por item com pausa em hover e foco, erro fica até agir, Escape fecha. Animação só de transform e opacidade com mola na entrada. Raio xl com botão md concêntrico. Provider no layout raiz; contrato reescrito em `libs.md`.
- Checkbox subiu do raio xs para sm: a superelipse em 20px parecia quadrada.
- cornerKit removido. Sistema de cantos próprio em `src/lib/squircle/`: `path.ts` com a matemática do Figma (suavização 0,6), `engine.ts` com um ResizeObserver, rAF, cache e MutationObserver, `use-squircle.ts` com o hook. Nativo por `corner-shape` no Chromium, `clip-path` só em quem recorta ou pede `clip` no fallback, borda sempre CSS. `corners.ts` perdeu o argumento de borda; `--ck-*` e as regras do cornerkit em `globals.css` saíram. Toast com ícone no topo e descrição em `--leading-tight`.
- Vitrine: o caixote de demo passa borda transparente ao cornerKit para cair no modo SVG e não recortar dropups.

Pendências:

- Card, Dialog, DropdownMenu, EmptyState, Radio, Select (nasce do Listbox), Tabs, Textarea e o layout inteiro continuam stub.
- Conferir os componentes novos nos dois temas assim que o ThemeToggle existir. Hoje a conferência foi por captura headless forçando `prefers-color-scheme`, e por `CSS.supports` falso para exercitar o fallback do motor de cantos.
- CSP: o console da vitrine mostra ~100 avisos de "Applying inline style" por carga, pré-existentes, todos de atributos `style` vindos do SSR (o hash mais frequente é o de string vazia). `style-src` por nonce bloqueia atributo inline até a hidratação. Avaliar `'unsafe-hashes'` ou tirar os valores dinâmicos do atributo.
- Chip removível (etiqueta com ×) quando a seleção múltipla entrar.
- Login: tela em `/login` com `AuthCard` (duas colunas no desktop, carrossel de fundo no mobile), `Carousel` com direção de arte por `getImageProps`, `PasswordInput`, `signInWithPassword` com rate limit, Turnstile opcional e "Relembrar senha" real por cookie `sp-remember`. Bug do proxy corrigido: `/auth/callback` era redirecionado para `/login` antes de trocar o código. Banners placeholder em `public/banners/` gerados por script.
- Proxy: `banners` e `brands` excluídos do matcher; sem isso o `next/image` recebia redirect para `/login` ao buscar o PNG.
- Login revisado: BrandIcon por máscara sobre public/brands, Turnstile flexível com chaves de teste e botão travado até verificar, logotipo 32, título title1, sem scroll no desktop, banner fixo no mobile, devIndicators desligado. Otimizador de imagem exige quality 75 no Next 16 (80 dava 400).
- Login mobile como bottom sheet e Turnstile invisível (interaction-only), botão só libera com o token.
- Turnstile em modo Invisible no painel da Cloudflare; container fora do fluxo e chave de teste invisível no `.env`.
- Login mobile: sheet solto com 6px, imagem fixa por image-set no lugar do carrossel, sem logo e sem divisor, duas etapas (opções, depois campos) por data-step.
- Login mobile sem caixa, imagem fundindo no fundo por gradiente; desktop em 60/40.
- Login: logo e título centralizados, banner modelo `public/bg/bg-model.jpeg` no primeiro slide, `bg` no matcher do proxy.
- Login mobile: rodapé da etapa de e-mail vira só "Voltar"; "Entrar" no raio md como os demais.
- Login mobile: voltar como texto de rodapé e opção de e-mail em outline como as demais.
- ThemeToggle em homologação (Listbox flutuante Sistema/Claro/Escuro por cookie) e Apple fora da interface de login.
- Seletor de tema arrastável; FieldShell com fundo transparente; "Entrar" em lg.
- Login sem carrossel: imagem fixa nos dois layouts, texto do hero sobre a imagem no desktop, logo no topo no mobile.
- Autenticação sempre no tema escuro (`color-scheme: dark` no shell); hero com título medium e tracking -0.02em; rótulo Specular em mono.
- Tema escuro forçado nas rotas de auth pelo layout raiz via header `x-pathname` do proxy (color-scheme no shell não resolvia light-dark).
- Login mobile: cartão com blur no lugar do gradiente, botões de opção em lg, `html` com fundo do tema para não sobrar faixa clara no overscroll.
- Login mobile: cartão quase translúcido (28%) e scrim na base da imagem.
- Login mobile: raio 20 em botões e campos (Safari sem corner-shape virava pílula), tela sem rolagem, lateral menor, logo centrado no espaço acima do cartão.
