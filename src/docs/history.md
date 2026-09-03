# Histórico

Registro por dia do que foi feito e do tempo investido. Atualizar ao encerrar cada dia de trabalho. Tempo pelos horários de commit quando não anotado; ajuste se a sessão começou antes.

| Dia | Tempo | Resumo |
| --- | --- | --- |
| 2026-08-27 (qua) | ~3h (19:30 a 22:40) | Fundação completa: estrutura, auth, banco multi-tenant, segurança, tema, libs e primitivos |
| 2026-08-28 (qui) | ~5h (noite, até ~01:00 de 29) | Design system: cantos squircle com cornerKit, Button, Text, Surface, Progress, Spinner, campos com máscara, DatePicker, Tooltip e vitrine em /componentes |
| 2026-08-29 (sex) | ~8h30 (13:00 a 21:30) | Design system (Badge, Listbox, Pagination, Checkbox, Switch, Avatar, Toast, Carousel, PasswordInput, BrandIcon, GradientBlinds), motor de cantos próprio no lugar do cornerKit, tela de login completa nos dois layouts com fundo WebGL, tema escuro forçado em auth |
| 2026-08-30 (sáb) | ~1h no dia (21:15 a 22:10) mais a continuação no dia 31 (19:59 a 21:47) | Cadastro, MFA, e-mails próprios, auditoria da autenticação e correções de produção |
| 2026-08-31 (dom) | em andamento | Configuração inicial do time em duas etapas, domínio organizations com service e api/v1, Select do design system |
| 2026-09-01 (seg) | em andamento | Cobrança com Stripe ponta a ponta: pagamento dentro da nossa interface, teste gratuito de 7 dias no Pro, estrutura de permissão por plano no banco e a tela de plano e assinatura |
| 2026-09-02 (ter) | em andamento | Sidebar refinada (perfil enxuto, convite de plano com X, mobile em tela cheia com rolagem geral e escala de toque, barra flutuante de vidro) e ligada ao banco pelo `AppShell` no grupo (app) |
| 2026-09-03 (qua) | em andamento | Convite de plano acima do perfil no desktop, primitivo `Dialog` saindo de stub, troca de time em caixa de vidro ligada ao banco e gaveta de criar equipe |

## 2026-09-03

Feito:

- Convite de plano subiu para cima do perfil no desktop e continua por último no celular, depois das ações da conta. A posição é por árvore, e não por `order`: com `order` a ordem de leitura do leitor de tela discordaria da tela.
- `Dialog` deixou de ser stub e virou a moldura da casa: portal, caixa centralizada no desktop e bandeja no celular (a mesma decisão do `DatePicker`), Escape fechando, Tab dando a volta por dentro, foco devolvido a quem abriu, rolagem da página travada e animação cortada em `prefers-reduced-motion`. `scrim` decide se a janela escurece o fundo e bloqueia o resto ou se fica leve e fecha por toque fora.
- Troca de time no topo do menu (`TeamSwitcher`): busca com `Esc` à direita, times com logo, nome, etiqueta de plano e check no que está em vigor, estado vazio quando a busca não acha, divisor e o convite de criar equipe no rodapé. Teclado no formato de paleta: o foco fica na busca, setas movem, Enter escolhe e o leitor de tela acompanha por `aria-activedescendant`.
- A caixa nasceu centralizada e virou colada na origem no mesmo dia, por pedido: sem escurecer a tela, medida a partir do próprio seletor, alinhada pelo início dele e virando para cima quando falta espaço embaixo. A medida entrou em `useLayoutEffect` porque com `useEffect` a caixa pintava no canto e pulava para o lugar no quadro seguinte. No celular continua bandeja, agora sem o fundo escuro.
- A faixa dos times ganhou altura reservada (10rem a 15rem no desktop, até 22rem na bandeja) e é ela que rola: com um time só a caixa ficava espremida entre a busca e o rodapé, e com muitos o convite de criar saía da vista.
- Ligado ao banco pela função que já existia: `set_current_org` é `security definer` e recusa organização de que a pessoa não participa, então a web (`switchTeamAction`) e o aplicativo (`PUT /api/v1/organizacoes/atual`) trocam pela mesma porta, sem repetir a checagem em código.
- `listTeams` entra pela associação e não por `organizations`, porque a policy de select de lá também deixa passar o time que a pessoa criou: quem saiu do time veria na lista um destino que a troca recusa. O plano de cada linha sai de uma leitura em lote de `organization_subscriptions` com `grantingStatuses`, novo em `billing/schemas.ts`, que é a mesma lista de status de `organization_plan` no banco. Lista para o aplicativo em `GET /api/v1/organizacoes/minhas`.
- Vidro na troca de time, por pedido: `--glass-bg` e `--glass-blur` novos em `tokens.css`, na mesma receita da barra flutuante do menu no celular, valendo no popover e na bandeja. `Dialog` ganhou `surface` para escolher entre a superfície opaca e o vidro.
- Criar equipe deixou de ser botão morto e virou gaveta de 30rem colada na direita (`Dialog` com `placement="end"`, deslizando por `translateX`; bandeja no celular). Uma lista só, sem etapas: identidade com banner e logo pelo mesmo `ImagePicker` dos primeiros passos, nome, endereço derivado em leitura, site, área de atuação e convites.
- Os convites ficam numa lista local até a equipe nascer, porque `create_invite` precisa do id da organização. Criar chama `saveTeamAction` e em seguida `switchTeamAction`, então a equipe nasce e a pessoa já entra nela; imagem e convite seguem em segundo plano, pelo motivo já medido nos primeiros passos.
- Vidro acertado na receita da casa, por pedido: `--glass-bg` virou `--color-bg` a 0% misturado com `transparent` e `--glass-blur` virou `blur(12px)`, que é exatamente o que o painel do login e a barra flutuante do menu já usavam. Os dois passaram a ler o token, então o valor existe num lugar só.
- Gaveta com 8px de folga nos quatro lados, no lugar de encostar na tela: o recuo mora na moldura e o canto voltou a ser completo.
- Convite de criar equipe deixou de ser faixa de ponta a ponta: o rodapé ganhou o recuo da lista e o botão ganhou raio, então o hover pinta uma caixa por dentro, no ritmo das opções de cima.
- Identidade parametrizada por variáveis (`--identity-ratio` e as três da logo): a gaveta é estreita e usa as medidas compactas dos primeiros passos no celular, porque no 4 por 1 a logo de 6rem cobria quase todo o banner e o par lia como desalinhado. A media query do fluxo guiado passou a mexer só nas variáveis.
- Endereço saiu da gaveta: sai do nome e não é editável, então campo travado só ocupava linha. Quem cria entra na lista de pessoas já como proprietário, sem papel para escolher nem ação de remover, porque é o que o banco vai gravar. `SidebarUser` ganhou `email` para essa linha.- Gaveta de criar equipe ganhou o mesmo vidro do seletor, raio `3xl` para destacar da tela e foi sem o fundo que escurece: com ele ligado, o borrão pegaria o próprio escurecimento e a gaveta ficaria cinza no tema claro em vez de translúcida. Fechar por toque fora entrou no lugar do clique no fundo.
- O par banner mais logo virou `ImageGroup`, exportado junto do `ImagePicker` e usado pelas duas telas, então o conjunto absoluto sai idêntico ao dos primeiros passos em vez de repetir as medidas em cada lado.
- Campos reagrupados: nome, site e área leem como um bloco só; o texto que explicava o convite saiu; as pessoas ficam depois de um divisor, sob o título "Membros".- Capa da equipe virou perfil de rede social de verdade: o transbordo da bola e a margem que o reserva saem os dois do tamanho dela por `calc`, no lugar de números soltos que só encaixavam numa largura. A gaveta deita o banner em 3 por 1 e usa bola de 5rem, porque numa coluna de 30rem a de 6rem cobria quase toda a capa.
- Gaveta reorganizada pelo pedido: nome, site e área num bloco só; divisor de ponta a ponta sangrando o recuo da coluna; e, abaixo dele, o título "Membros", os campos de convite com o botão e a lista por último.- Bola da capa afundou para três quartos dentro do banner, no lugar da metade.
- Campos que pareciam distribuídos por space-between: a coluna que rola é grid e cresce para preencher a gaveta, e no `stretch` que é padrão as linhas de altura automática esticavam para dividir a sobra. `align-content: start` põe a leitura de volta de cima para baixo.
- Divisor incompleto: ele chegava às bordas por margem negativa, e margem negativa dentro de `overflow-y: auto` é cortada de um lado e vira rolagem do outro. O recuo lateral saiu da coluna e foi para cada bloco, então a linha corre de ponta a ponta sem truque.- Ajustes de celular: a bandeja desceu de raio `2xl` para `xl`, que é o mesmo degrau que o painel do login já usa numa tela estreita; o `Kbd` some abaixo de 48rem, porque tecla de atalho não serve a quem não tem teclado; e a troca de time abre sem foco em campo, senão o teclado sobe junto e come metade da bandeja. O foco vai para a própria janela, que ganhou `tabindex="-1"`, então o Tab continua preso lá dentro. A prop virou `focusOnOpen` porque o lint barra `autoFocus` em JSX.- Mais celular: a fração da bola que fica para fora da capa virou `--identity-logo-out` (0,4 no desktop, que deixa 60% dela dentro; 0,25 no celular, onde a capa é baixa); a bandeja voltou a ter algo atrás de si, com véu leve em `--color-scrim-soft` novo quando a janela é avulsa; e campo e select deixaram de ler como pílula, porque com 44px de altura o raio de 24 passa da metade e fecha a curva. Abaixo de 48rem os dois usam o mesmo 12 do botão, então param de destoar lado a lado.- Cabeçalho da gaveta enxuto e mais baixo: título, etiqueta do plano que libera a operação e o X na outra ponta, sem linha de descrição e sem ícone no chip. O convite que abre a gaveta mostra a mesma etiqueta, colada no rótulo e não na outra ponta da linha, do mesmo jeito que o "Pendente" anda com o nome na lista de pessoas. As duas leem de `CREATE_TEAM_PLAN`. `planBadges` saiu do `AppShell` para `billing/plans.ts`, porque agora dois lugares usam o rótulo curto.
- Fios da gaveta e da caixa de troca alinhados ao menu: 0,6px em `--color-border`, no lugar de 1px e de `--color-separator`, que é quase três vezes mais opaco e virava um risco preto numa coluna estreita. O divisor precisa de `&&` para ganhar do módulo do `Separator`, que alveja `.separator[data-orientation]`.
Pendências:

- O dropdown do `Select` dentro da gaveta pode ser cortado: o painel do `Dialog` recorta e a área do formulário rola, e o `Listbox` abre em `position: absolute` dentro do fluxo. A saída conhecida é portal, como o `DatePicker` já faz, e é trabalho no primitivo.
- A gaveta de criar equipe não foi exercitada contra o banco: nenhuma equipe foi criada de verdade, nem convite enviado, nem imagem subida por esse caminho.
- O menu ainda não abre camada em opções da conta, busca e notificações. `DropdownMenu` segue stub e a paleta de comandos segue `return null`.
- A troca de time não foi exercitada contra o banco hospedado: `typecheck`, `lint` e `build` passam, mas ninguém trocou de time com dois times de verdade numa sessão.
- O X do convite de plano continua sem persistir, e `SidebarUser.role` continua prop morta.

## 2026-09-02

Feito:

- Rodapé do menu enxuto: perfil sem caixa (avatar, nome, sino e chevron agrupados no fim), meta removida, convite de plano por último com X para dispensar, eyebrow "Specular" em Geist Mono e botão em contraste invertido (`--color-label` sobre `--color-bg`).
- Mobile do menu: quem rola é a tela inteira (o `stretch` do grid espremia o topo; `align-self: start` resolve), folga da barra flutuante movida para dentro do painel (padding de fim em container rolável não entra na rolagem), tudo um degrau maior (44px, callout, avatares `sm`, badge `md`) e barra flutuante com divisor e vidro do login (`color-mix 0%` + blur).
- Fio da barra flutuante: `--menu-line` só existia em `.panel`, então borda e divisor da `.bar` eram descartados em silêncio; a variável nasceu de novo na `.bar`.
- `AppShell` deixou de ser stub: Server Component com grade de 16rem, busca `getCurrentTeamState()` + `getOnboardingBilling(team.id)` e monta a `Sidebar` com time, plano (badge curto), pessoa e convite derivado da cobrança (`trialing` ou gratuito em vigor; pago em dia não desenha a seção — `promo` virou opcional). Montado no layout do grupo (app), então o menu aparece em todas as páginas logadas.

Pendências:

- O X do convite de plano não persiste (estado em memória): dispensar e recarregar traz o cartão de volta. Persistir exige cookie ou banco, porque Web Storage é proibido pelo lint.
- `SidebarUser.role` segue prop morta: o componente não desenha o cargo desde o perfil enxuto.

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

Tempo: ~8h30 (13:00 a 21:30, com pausas). 14 commits, de `7bb9fbe` a este.

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
- Login com fundo WebGL `GradientBlinds` (ogl) no lugar da imagem; componente na vitrine.
- Login: fundo WebGL visível inteiro com órbita automática, cartão mobile em raio xl, rolagem travada por data-scroll no html.
- Login: fundo em P&B e blend normal para o vidro do cartão mobile voltar.
- Cartão mobile do login: fundo a 15% e blur de 12px.

Pendências:

- Próximas telas de auth no mesmo `AuthCard`: cadastro, recuperar senha, redefinir senha e MFA.
- Turnstile: `.env` está com as chaves de teste da Cloudflare (as reais comentadas na linha acima). Trocar de volta antes de publicar.
- Stubs: Card (nascer sobre Surface), Dialog, DropdownMenu, EmptyState, Radio, Select (nasce do Listbox), Tabs, Textarea e o layout (AppShell, Sidebar, Topbar). ThemeToggle vai para configurações em produção.
- Listbox dentro de container que recorta (Safari, sem `corner-shape`) pode cortar o dropup; a saída é portal, como o DatePicker.
- CSP: os ~100 avisos de "Applying inline style" por carga NÃO eram nossos e não são um problema. Diagnóstico fechado em 2026-08-31: a pilha das mensagens aponta para `next-devtools`, o bundle de ferramentas de desenvolvimento do Next, que só existe em `next dev`. Medido com `next start` no build de produção: zero violações, e atributo `style` aplicando normalmente (o `style-src-attr 'unsafe-inline'` do proxy cobre). Nada a fazer.
- Chip removível (etiqueta com ×) quando a seleção múltipla entrar.
- Conferir o fluxo real de OAuth e de senha com um usuário de teste no Supabase; hoje só a UI e as actions foram exercitadas.

## 2026-08-30

Tempo: em andamento.

Feito:

- Criar conta em `/cadastro`: `SignUpForm` com nome, e-mail e senha (zod com piso de 8), provedores compartilhados via `OAuthButtons`, CSS comum em `auth-form.module.css`, action `signUpWithPassword` com rate limit, Turnstile e erros por `error.code`, estado "Confirme seu e-mail" quando a confirmação está ligada, consentimento de Termos e Privacidade.
- MFA em `/mfa` com dois estados: cadastro do autenticador (QR do Supabase, chave manual com cópia e toast, CodeInput de 6 dígitos em caixas 3 e 3) e verificação de step-up. Gate novo no proxy: `mfaMissing` força o cadastro no primeiro login; `enrollTotp` purga fatores não verificados. Conteúdo do AuthCard rola por dentro no mobile.
- Link de confirmação à prova de scanner: página `/confirmar-email` no grupo `(auth)` que só chama `verifyOtp` no clique (action `confirmEmailWithToken`), porque o `{{ .ConfirmationURL }}` direto no `/verify` era consumido por scanner corporativo antes do clique e dava `otp_expired` na primeira tentativa. Templates trocados para `token_hash`, proxy não expulsa logado dessa rota.
- E-mails redesenhados no padrão minimalista: sem cartão, fundo branco, só o ícone da marca no topo (specular-icon-black.png novo), textos sem ponto final e sem travessão, botão preto só quando há ação. 13 templates gerados de um esqueleto único (6 de ação e 7 avisos de segurança do painel), tabela de slots e assuntos no setup.md.
- Tela de MFA reconstruída solta no AuthCard, sem Surface: QR em caixa branca, chave com "Copiar" ao lado, CodeInput com fullWidth novo (caixas crescem por flex mantendo a base) e Verificar lg de largura total. Dois bugs achados com o E2E completo (que agora fecha login, enroll, TOTP e /dashboard): o data URL do QR tem aspas sem encode e quebrava o background CSS (virou img), e o basis 0 nos inputs estourava a trilha do grid para ~70rem.
- Ícones 3D de public/3d-icons (check e error) nos estados de confirmação do cadastro e do /confirmar-email, no lugar dos ícones Phosphor genéricos.
- Logo dos e-mails à prova de modo escuro: specular-icon-email.png com o ícone dentro de um chip branco com borda no próprio PNG, porque clientes de e-mail invertem fundo e texto sem tocar em imagem e o ícone preto solto sumia. Validado com preview simulando a inversão do Gmail.
- MFA refinada: três avatares de autenticadores (Google, Twilio, Microsoft com círculo preenchido no azul da marca), QR sem padding, caixas do código em 3rem por 4rem com raio lg pelo squircle(), sem botão de verificar (auto ao completar) e prévias das duas telas na vitrine /componentes para ver em localhost sem sessão. E2E rerodado verde com a verificação automática.
- MFA compacta no mobile: avatares e linha de dica escondidos, QR em 8.5rem, gap menor.
- Cadastro duplicado bloqueado: detecção do usuário falso com identities vazio que o Supabase devolve sob proteção de enumeração, mensagem com link para o login. Validado por E2E contra o projeto hospedado.
- Contas unificadas entre provedores confirmadas por pesquisa no código do gotrue: linking automático por e-mail verificado é padrão e sem toggle; documentado com as exceções (e-mail noreply do GitHub, e-mail divergente).
- Rate limit de auth em três camadas: por operação e IP, total por IP (30/min) e por e-mail alvo (5 por 15 min) no login, cadastro, reenvio e recuperação.
- Recuperar e redefinir senha funcionais no mesmo AuthCard: resetPasswordForEmail com sucesso sempre (sem vazar existência), redefinição exigindo a sessão do link com step-up de MFA preservando o destino no proxy. E2E cobrindo cadastro duplicado, recuperação e redefinir sem sessão.
- Auditoria completa da autenticação em quatro frentes (segurança, validação de campos, conformidade com rules.md, cobertura de rotas), com correções aplicadas:
  - Bypass do proxy inteiro por header: a cláusula `missing` do matcher isentava requisição de prefetch, então `curl -H "purpose: prefetch" /dashboard` respondia 200 sem sessão e sem CSP. Confirmado com curl, corrigido tirando a cláusula, reconfirmado no build de produção.
  - Login de conta não confirmada dizia "E-mail ou senha incorretos" e travava a pessoa em 15 minutos de rate limit; agora tem mensagem própria e botão de reenviar a confirmação na própria tela.
  - CodeInput disparava a verificação a cada tecla com as seis caixas cheias, queimando o limite ao reescrever o código; só dispara na virada para completo, limpa as caixas ao errar e distribui o código do autofill.
  - Erro de OAuth e aviso de link expirado ficavam invisíveis no mobile, porque moravam dentro do formulário oculto na etapa de escolha.
  - Loop entre proxy e `/mfa` quando o JWT ainda parece válido mas a sessão morreu: rota `/auth/sair` limpa o cookie, coisa que Server Component não consegue fazer.
  - Token do e-mail sobrevive ao step-up de MFA (o `next` leva a query), Turnstile avisa quando o script é bloqueado, senha valida por bytes e não por caracteres, `weak_password` distingue senha vazada, cookies de sessão ganham `Secure` em produção, `maxAge: 0` volta a apagar cookie no logout, reenvio de confirmação parou de vazar existência de conta, TOTP ganhou teto por fator e a vitrine saiu do ar fora de homologação.
- Autenticador salva a conta como "Specular" (issuer no enroll do TOTP), no lugar do host do Site URL.
- Botão com `loading`: Spinner no lugar do ícone, trava do clique e `aria-busy`, ligado em todos os formulários de auth e nos botões OAuth (via useFormStatus); "Verificando o código" do MFA também ganhou spinner. Variação na vitrine.
- Troca de tela suave nas rotas de auth: animação authEnter (opacidade e deslize de 6px vindo de cima) no root dos formulários, nos cartões de confirmação e no MFA, cobrindo navegação, etapa do mobile e troca de estado.
- MFA mobile sem scroll lateral (grid com minmax(0,1fr); a trilha crescia pelo max-content da chave), QR cru sem padding e sem raio, chave em uma linha com Copiar absoluto dentro do box, caixas do código quadradas com gap de 4px.
- Confirmação de e-mail entre abas: a aba do link só confirma e avisa por BroadcastChannel + polling de sessão; a aba do cadastro segue sozinha para o próximo passo.
- Revisão adversarial (workflow com 17 agentes) confirmou e corrigiu 7 defeitos da primeira versão: lockout de login por terceiros no limite por e-mail (virou IP+e-mail só em falha, com peekRateLimit novo), oráculo de existência no aviso de cooldown do reset (virou sucesso silencioso com log), next=/confirmar-email sem token nos gates de MFA (voltou a /dashboard), token do Turnstile morto após erro re-tentável (widget ganhou resetOn), link de login do cadastro duplicado sem next, mensagem errada para senha acima de 72 caracteres. Refutados: spoof de x-forwarded-for (Vercel sobrescreve), redefinir quebrado com mfaMissing e troca de senha por logado direto.

Pendências:

- As pendências de 2026-08-29 continuam.
- E2E do MFA montado (usuário de teste via admin API, login pela UI, TOTP calculado em Node): revelou token do Turnstile perdido no input imperativo (virou input controlado pelos formulários) e enroll de TOTP desligado no projeto hospedado (config.toml não vale lá; instrução no setup.md).
- E-mails de autenticação próprios: 6 templates com marca em db/supabase/templates ligados no config.toml, logos em PNG gerados por headless, instruções de SMTP do Resend e URLs de redirect no setup.md, reenvio de confirmação na tela de cadastro e aviso de link expirado no /login.
- Recolar os 13 templates no painel do Supabase depois do deploy do /confirmar-email e ligar os toggles da seção Security.
- Achados da auditoria que continuam abertos, por serem produto e não correção (parte deles caiu no dia 31, ver a seção seguinte): perder o autenticador hoje é perda definitiva da conta (não existe código de recuperação, nem tela de gerenciar fatores, e `unenrollTotp` está sem uso), quem tem a senha de alguém sem MFA cadastra o próprio autenticador e assume a conta, `requireUser`/`requireMfaSatisfied` e `mfa_satisfied()` existem e não são chamados em lugar nenhum (precisam entrar nas páginas de `(app)` e nas policies antes de qualquer dado real aparecer), auth só vive em Server Action sem `service.ts` nem `api/v1` (regra 2), e os boundaries de erro renderizam `null`, então qualquer exceção vira tela branca.

## 2026-08-31

Tempo: em andamento (primeiro commit do dia 19:59). A parte da manhã e do começo da noite está registrada na seção de 2026-08-30, que essa sessão continuou.

Feito:

- Configuração inicial do time em `/primeiros-passos`, no grupo `(app)`: tema normal, fundo agrupado, logotipo no topo e um `Surface` de nível 1 com barra de três etapas. É processo dentro do produto, não mais uma tela de login. A rota antiga `/onboarding` saiu (rota em português, feature continua `onboarding` em inglês).
- Etapa 1 com logo, nome, domínio e área de atuação. O domínio é o `slug`, derivado do nome por `slugify` enquanto o campo não for editado, com o endereço público montado embaixo em tempo real. A logo vai por URL assinada: action prepara `path` e `token`, o navegador manda o arquivo direto ao Storage e uma segunda action grava a URL e apaga a anterior.
- Etapa 2 com convite por e-mail e nome, papel por `Select` e a lista do time. Convite pendente leva etiqueta "Pendente" e × para cancelar; o dono tem o papel travado porque o banco protege o último owner. O convite dispara e-mail pelo Resend com link para `/convite/<token>`, que chama `accept_invite`. Falha de entrega não derruba o convite.
- A etapa do plano entra na barra como terceira e ainda não existe: concluir a etapa 2 marca `onboarding_completed_at` e leva ao painel.
- Domínio `organizations` montado no formato que a regra 2 pede, o primeiro do projeto: `service.ts` que recebe o cliente Supabase de fora, `actions.ts` como casca fina com sessão, zod, rate limit e revalidação, e `api/v1/organizacoes` mais `organizacoes/membros` para o aplicativo, com `authorizeRequest` novo em `lib/api/v1.ts` cuidando de Bearer, teto por pessoa e leitura do corpo com limite.
- Banco: enum `organization_industry`, colunas `industry` e `onboarding_completed_at`, `name` no convite, `team_members` e `complete_onboarding` como RPC, `create_invite` recriada com nome e recusando convite para quem já é do time. Storage em migração separada, para uma recusa de policy em `storage.objects` não derrubar o resto: bucket público `organization-logos` (2 MB, PNG, JPG e WEBP, sem SVG) com as policies presas à pasta do id da organização por `can_manage_logo`.
- `Select` do design system, nascido do `Listbox` como a doc mandava: gatilho com as medidas do campo por variáveis locais, valor num input escondido para funcionar dentro de `form`, placeholder e `id` no gatilho para o `Label` do `Field`. Saiu da lista de stubs e entrou na vitrine junto com a prévia do fluxo de primeiros passos.
- Bug de largura achado na prévia: `Select` apertado por classe de CSS Module ignorava o tamanho, porque a folha do Emotion entra depois com a mesma especificidade. A linha de membro passou a envolver o componente num `span` próprio, e o espaço do × é reservado mesmo sem botão para os selects não desalinharem.
- `requireUser` saiu do papel: `requireOnboarding` no painel manda quem ainda não configurou de volta para o fluxo, e só desvia owner e admin, para quem entrou por convite não cair na configuração do time dos outros.
- Segunda passada na tela, por pedido do usuário: a página virou camada sobre a aplicação (fixa, véu no tema com desfoque e painel de vidro por cima), o cabeçalho com logo e sair saiu inteiro, as barras de etapa saíram do painel e perderam o rótulo "Etapa 1 de 3", e o alvo da logo ficou só com o ícone de nuvem centralizado, sem texto ao lado.
- Campos da etapa 1 reorganizados: nome e site lado a lado em duas colunas, uma no mobile. O endereço público saiu da tela e passou a nascer do nome no servidor, com sufixo automático quando o nome repete; "domínio" virou "site", opcional, com `https://` de afixo fixo como no `R$`. Área de atuação passou a listar só desenvolvimento e design, em seis opções.
- `Listbox` ganhou `placement="auto"`, usado pelo `Select`: perto da base da tela a lista sobe em vez de vazar. A decisão é por estimativa de altura, porque medir depois de montar faria a lista pular no mesmo quadro.
- Dois defeitos de alinhamento achados na prévia e corrigidos: o ícone da nuvem saía do centro porque o `input` do dropzone conta como filho no grid do alvo (virou camada absoluta própria), e as barras de etapa ficavam desalinhadas do conteúdo do painel (ganharam o mesmo recuo lateral).
- `(app)/error.tsx` deixou de renderizar `null`: tela de erro com o ícone 3D, texto e "Tentar de novo", com o digest quando existe. Um dos achados abertos da auditoria, que ia aparecer no primeiro teste como tela branca.
- Terceira passada, também por pedido: a configuração deixou de ter rota e virou modal sobre o painel, renderizado pelo próprio `/dashboard` quando falta configurar. As barras de etapa saíram e viraram um anel no lugar da marca, com um arco por etapa e o número no centro. A identidade do time virou banner mais logo, os dois enviáveis, no formato capa de perfil: banner 4:1 com canto squircle e logo em círculo puro à esquerda, montada sobre a borda de baixo, cada um com a dimensão ideal escrita no centro enquanto está vazio.
- Bug do recorte da imagem: com `overflow` numa camada interna, a borda seguia a superelipse e o corte seguia o arco de círculo, e a diferença aparecia no canto. O recorte passou para o próprio alvo, que é quem tem a forma.
- Quarta passada na etapa de membros: convite só com e-mail e nome (entra sempre como membro, e o papel se ajusta na lista), avatar sem foto pelo `avvvatars-react` e a ação de remover dentro do dropdown de papel, depois de um divisor, no lugar do × solto na linha.
- O `avvvatars` traz o goober, que injeta `<style>` em runtime: a CSP por nonce bloquearia a folha e o avatar apareceria sem estilo. O goober lê `window.__nonce__`, então entrou o `GooberNonce` no layout raiz. Conferido no navegador: avatar colorido nos dois temas e nenhum erro de CSP novo (os que aparecem em dev continuam sendo os do next-devtools).
- Convite pendente ganhou troca de papel, com policy de update própria. Sem isso o gatilho do dropdown teria de ficar desabilitado nessas linhas e a ação de cancelar sumiria junto, ou pior, o select mudaria na tela sem mudar no banco.
- Foto do Google e do GitHub agora acompanha a conta mesmo quando o provedor é vinculado depois: gatilho novo em `auth.users` copiando nome e foto para o perfil, sempre com `coalesce` para não sobrescrever o que a pessoa definir no produto.
- Etapa 3 montada a partir de uma imagem de referência do usuário: painel largo com logo, título, subtítulo, alternador de ciclo e três planos, com quatro bolas de cor sangrando pelas quinas. Gradiente radial no lugar de `filter: blur`, porque o resultado é o mesmo sem custo de composição numa camada do tamanho do painel.
- No mobile a mesma etapa vira três linhas selecionáveis com um botão só embaixo. É troca de árvore por `useMediaQuery` e não CSS: o cartão do desktop tem botão dentro e a linha do mobile é um botão, então os dois não podem coexistir no DOM.
- Catálogo de planos em `features/billing/plans.ts`, com preço em centavos por ciclo. A cobrança não existe ainda, então escolher um plano pago conclui a configuração e avisa por toast que o pagamento entra depois, em vez de fingir assinatura.
- Ajustes finos por pedido do usuário: escuro virou o tema padrão do produto (sem cookie, `data-theme="dark"` no lugar de seguir o sistema; claro continua disponível por preferência), o painel do modal desce para raio 24 no mobile (a mesma lição do cartão de login no Safari), título e logo da etapa de planos menores no mobile, descrição de uma linha nas linhas compactas e botão de contratar com raio 20.
- Preço com contador animado ao trocar Mensal e Anual, nos dois layouts: corre do valor antigo ao novo em reais fechados, escrevendo direto no texto do nó (re-render por quadro para animar um dígito não se justifica), com `useLayoutEffect` para não piscar o valor final antes do primeiro quadro e troca seca em `prefers-reduced-motion`. Medido no navegador: 97 vira 74 no meio do caminho e fecha em 65.
- Alturas iguais nos três cartões do desktop: o `align-items: start` saiu e o grid estica todo mundo até o fim da linha.
- Pego na prévia: o tamanho do título via classe simples perdia do `.text[data-variant]` do Text, que tem especificidade maior; o seletor do módulo subiu para três classes de propósito.

- Migrações aplicadas no projeto hospedado (`db:push` com autorização do usuário) e tipos regerados: o arquivo escrito à mão bateu com o gerado, coluna por coluna e assinatura por assinatura. As policies de `storage.objects` passaram sem recusa de dono da tabela.
- Criar time devolvia 42501 "new row violates row-level security policy". Reproduzido com sessão real (usuário de teste pela admin API, login pelo cliente anônimo): o insert passa no WITH CHECK e quem barra é o RETURNING, porque o Postgres aplica a policy de select nas linhas devolvidas por `insert ... returning` e a associação que torna a linha visível só nasce no trigger AFTER INSERT, que roda depois. Insert sem `.select()` sempre funcionou, e foi isso que fechou o diagnóstico. Corrigido nos dois lados: a policy de select aceita `created_by = auth.uid()`, o que cobre também cliente que fale direto com a API, e o serviço gera o id e lê a linha num passo separado. Antes disso subiu uma migração de reparo das policies da organização, apostando em divergência do remoto, que não resolveu nada: o palpite estava errado e a migração ficou no histórico porque já tinha sido aplicada.
- Grant explícito de execute para `authenticated` em todas as funções de `public`, em migração própria de `security`. O revoke de `public` e `anon` das migrações anteriores dependia do default privilege do Supabase para manter `authenticated` executando, o que é suposição sobre configuração de fora do repositório: se ela mudasse, a lista de membros voltaria vazia e o convite falharia sem erro visível.

Pendências:
- Assinatura de verdade: Stripe, checkout, webhook e o vínculo do plano escolhido com a organização. A interface da etapa 3 já está pronta e é só ligar.
- A etapa 3 não tem volta para a de membros, por fidelidade à referência. Se incomodar, entra um voltar discreto no rodapé.
- Fluxo de convite ponta a ponta com dois usuários de verdade (e-mail entregue, `/convite/<token>`, aceite e troca de papel).
- As pendências de 2026-08-29 e 2026-08-30 continuam, tirando `requireUser` sem uso, a falta de `service.ts` com `api/v1` (que passam a valer só para o domínio `auth`) e os boundaries de erro em `null`, que agora só falta cobrir a raiz.

## 2026-09-01

Tempo: em andamento. A madrugada (00:09 a 00:55) está registrada na seção de 2026-08-31, que essa sessão continuou.

Feito:

- Domínio `billing` montado inteiro, no formato que a regra 2 pede: `service.ts` com toda a regra, `actions.ts` e `api/v1/planos/*` como cascas finas sobre o mesmo service, `schemas.ts` com zod e `queries.ts` para os Server Components. Nada de lógica em `src/app`.
- Três fontes de verdade separadas de propósito: o Stripe guarda o dinheiro, o banco guarda quem pode o quê e `plans.ts` guarda o texto de vitrine. Nenhuma repete a outra, então não existe divergência para reconciliar. `billing_prices` guarda só o mapa plano mais ciclo para o `stripe_price_id`.
- Banco: sete tabelas (`billing_plans`, `billing_prices`, `plan_features`, `plan_entitlements`, `organization_subscriptions`, `billing_trials`, `billing_events`), quatro enums e treze funções, em quatro migrações de `billing` já aplicadas no projeto hospedado. `plan_features` e `plan_entitlements` nascem **vazias** por decisão do usuário: a estrutura entra agora e cada condição de plano entra junto com a tela que a exige.
- `organization_plan` é o único lugar onde os status com direito estão escritos (`trialing`, `active`, `past_due`). Cancelado, expirado e não pago caem no gratuito sem nenhum outro código saber disso. Em cima dela: `plan_at_least`, `plan_allows`, `plan_limit`, `plan_within_limit`, `trial_available`, `can_manage_billing`.
- Recurso fora de `plan_features` **derruba a chamada** em vez de negar ou liberar em silêncio: chave escrita errada aparece no primeiro teste, não em produção.
- Nenhuma tabela de cobrança tem policy de escrita, nem para o dono do time. As portas são `attach_billing_customer` (aberta para `authenticated`, exige owner ou admin, nunca sobrescreve cliente já vinculado) e `sync_subscription`, revogada até de `authenticated` e concedida só a `service_role`. Plano e status só entram no banco com o que o Stripe devolveu.
- Pagamento dentro da nossa interface, sem Checkout hospedado: `@stripe/react-stripe-js` monta o Payment Element num iframe do provedor, então o cartão nunca toca o nosso DOM nem os nossos servidores, e o PCI fica com o Stripe. As cores saem dos nossos tokens pela Appearance API, resolvidos em RGB por uma sonda invisível, porque `light-dark()` não atravessa o iframe. Mesma técnica do `GradientBlinds`, que precisa de RGB para o shader.
- Teste gratuito de 7 dias no Pro, com cartão obrigatório e em duas etapas: SetupIntent primeiro, assinatura com `trial_period_days` depois. Criar a assinatura antes daria sete dias de plano pago a quem abandonasse o formulário no meio. `trial_settings.end_behavior.missing_payment_method: "cancel"` fecha o caso do teste que termina sem cartão, e `billing_trials` garante uma vez por organização e por plano, então cancelar e assinar de novo não devolve período grátis.
- Sem teste gratuito o fluxo é o canônico: assinatura com `payment_behavior: "default_incomplete"` e o segredo de `latest_invoice.confirmation_secret`. O plano só passa a valer quando o pagamento confirma, porque `incomplete` não está na lista de status com direito.
- Três armadilhas da SDK 22.6.0 (API `2026-08-26.dahlia`) que derrubariam código escrito de memória, confirmadas compilando contra os tipos instalados: `invoice.payment_intent` não existe mais (é `latest_invoice.confirmation_secret`), `subscription.current_period_end` saiu do objeto e vive em `subscription.items.data[].current_period_end`, e `invoice.subscription` virou `invoice.parent.subscription_details.subscription`.
- Webhook do Stripe deixou de só ecoar: `constructEventAsync` antes de qualquer leitura, e então **relê a assinatura no Stripe** em vez de confiar no corpo do evento, porque reentrega fora de ordem gravaria estado antigo por último. `setup_intent.succeeded` é a rede do fluxo de teste, para a aba morrer depois de confirmar o cartão e o plano ativar do mesmo jeito; passar duas vezes não duplica porque a criação reaproveita a assinatura existente. O id do evento entra em `billing_events` **depois** de processar, senão uma falha de escrita perderia o evento; falha responde 500 para o Stripe reentregar.
- Etapa 3 dos primeiros passos ligada de verdade: lê o plano em vigor e o teste gratuito do banco (a constante `CURRENT_PLAN` chumbada saiu), e plano pago troca a etapa pelo checkout no mesmo painel, em duas colunas dentro dos 66rem que já estavam abertos. Nada de modal novo: `Dialog` é stub.
- `/configuracoes/plano` saiu do `return null`: plano em vigor com etiqueta de situação, ciclo, fim do teste, próxima cobrança e valor, troca de plano com alternador de ciclo, forma de pagamento com bandeira e quatro últimos dígitos, e as faturas vindas do Stripe. Cancelar é em dois passos no próprio botão, sem modal.
- `npm run stripe:sync` publica produto e preço de cada plano pago e grava o `stripe_price_id` no banco. Idempotente: produto com id fixo (`specular_<plano>`) e preço achado por `lookup_key`; valor diferente do catálogo vira preço novo com a mesma chave e o antigo sai de `active` dos dois lados, para assinatura em vigor continuar no que foi assinada. Lê `plans.ts` com `--experimental-strip-types` para o catálogo continuar tendo uma fonte só. Rodado duas vezes: quatro preços criados, segunda passada toda "em dia".
- `npm run billing:probe`: 51 verificações ponta a ponta contra o Stripe em modo teste e o banco hospedado, pela mesma porta que o aplicativo vai usar (`api/v1` com Bearer). Cobre teste gratuito de 7 dias com cartão de teste confirmado, cobrança imediata, cancelar, retomar, troca de ciclo reaproveitando a assinatura, teste gratuito consumido uma vez só, webhook assinado, reentrega ignorada, assinatura inválida recusada, RLS escondendo assinatura de fora do time, escrita direta negada até para o dono e `sync_subscription` negada a `authenticated`. Cria usuário e time de teste e apaga tudo no fim.
- O guard que amarrava a cobrança à organização "atual" do perfil caiu no teste e foi corrigido: dono de dois times administra os dois, e quem decide é `can_manage_billing` no banco. O `getTeamState` na action e na rota era conferência redundante que só restringia mais do que a regra do banco.
- Vitrine ganhou duas telas: "Plano e assinatura (prévia)" com assinatura em teste gratuito, cartão e faturas de exemplo, e "Pagamento do plano (prévia)", que reserva o espaço do iframe porque o Stripe só monta com segredo válido. As duas conferidas no HTML renderizado pelo servidor.
- CSP ganhou `r.stripe.com` e `merchant-ui-api.stripe.com` em `connect-src` e `*.stripe.com` em `img-src`, o mínimo que o Payment Element exige. O script do Stripe entra pelo `strict-dynamic`, sem allowlist de host. Escopo `billing` novo no rate limit, 20 por minuto, mais apertado que os 120 do `action` porque cada chamada sai para fora e mexe em dinheiro.

Pendências:

- A conta do Stripe está em modo teste e com `charges_enabled: false`. Guardar cartão funciona, cobrança imediata não: o caminho sem teste gratuito entrega o segredo de pagamento certo, mas só cobra de verdade depois de ativar a conta no painel do Stripe.
- Endpoint de webhook no painel do Stripe ainda não existe para o ambiente hospedado. O `STRIPE_WEBHOOK_SECRET` do `.env` foi validado assinando evento na mão; em produção é criar o endpoint apontando para `/api/webhooks/stripe` e colar o segredo.
- Meio de pagamento fixo em cartão (`payment_method_types: ["card"]`), para o fluxo não depender de redirecionamento. Pix e boleto em assinatura precisam de tratamento próprio e entram quando forem decididos.
- `plan_features` e `plan_entitlements` vazias, esperando as condições de cada tela. O contrato de como declarar está na seção Cobrança de `structure.md`.
- E-mail de aviso de fim do teste: o webhook já recebe `customer.subscription.trial_will_end` e só reconcilia; falta o template no Resend.
- A vitrine `/componentes` agora tem quatro `h1` na mesma página, contando os das prévias de tela. Já era assim antes (MFA), e continua sendo desvio conhecido só da vitrine.

## 2026-09-02

Tempo: em andamento.

Feito:

- Avatar sem foto trocou iniciais por forma: o `avvvatars` passou a `style="shape"`, uma das 60 formas vetoriais sobre uma das 20 cores, tudo determinístico pelo e-mail. A função de iniciais e as regras de texto do CSS saíram junto. Conferido no HTML do servidor: três pessoas, três formas e três cores.
- Bug da etapa de membros: promover alguém a proprietário travava o select da pessoa, e o travamento era só da interface. O banco nunca proibiu (a policy exige ser proprietário para mexer, e o `protect_last_owner` só impede o time ficar sem nenhum). Agora o único bloqueio é o último proprietário do time, e transferir é promover a outra pessoa e depois baixar o próprio papel.
- Toast de sucesso ao remover pessoa e ao cancelar convite, com o nome de quem saiu, e o aviso de convite enviado passou a valer também na prévia, que antes não dizia nada.
- Payment Element aposentado. No lugar, os três elementos avulsos de cartão dentro do nosso `FieldShell`, com `Label` e mensagem de erro nossos: a identidade do checkout passou a ser inteira nossa e do Stripe ficou só o campo, um iframe por campo, que é o que mantém o PCI em SAQ A. Campo de cartão no nosso HTML exigiria certificação nível 1 e liberação do Stripe, então não é caminho.
- Efeito colateral bom: elemento avulso monta sem `clientSecret`, então a prévia e a vitrine mostram o formulário de verdade e o retângulo tracejado sumiu. Prévia e produto passaram a ter um caminho de código só, com a prop `preview` desligando apenas a confirmação.
- A fonte dentro do iframe vem do Google Fonts por `cssSrc`: o arquivo do `next/font` sai do nosso domínio sem CORS e o iframe, sendo outra origem, não consegue buscar.
- Pendência de 2026-09-01 corrigida: cobrança imediata **funciona** em modo teste mesmo com `charges_enabled: false`. Confirmado direto na API, com `PaymentIntent` de R$ 1,00 e `pm_card_visa`, que voltou `succeeded` e `livemode: false`. O que depende de ativar a conta é cobrar de verdade, em modo real.
- Cadastro de autenticador deixou de travar a operação: a tela de MFA ganhou "Pular por agora", que grava o cookie `sp-mfa-skip` por 30 dias e devolve a pessoa para onde ia. O convite volta quando o cookie vence, e `/mfa` continua alcançável para quem quiser cadastrar antes disso. O step-up de quem já tem fator não mudou e continua obrigatório, com a action recusando pular nesse estado.
- Prévia do checkout ganhou legenda dizendo por que o botão fica desligado: com o formulário de cartão montando de verdade, o botão desabilitado passou a parecer defeito.
- Menu montado a partir da referência do usuário: `SidebarPanel` com marca e três ações de ícone, seletor de time com etiqueta de plano, rotas em grupos, convite, meta de faturamento e perfil. Rota com filhos abre no lugar da lista, com voltar no topo, em vez de submenu aninhado. `nav.ts` virou a fonte única do menu, com `href` tipado por rota, então só página que existe entra: tarefas, calendário e relatório da referência ficaram de fora.
- Mesma composição em duas molduras: no celular o painel sai da tela e vira barra flutuante no rodapé (buscar mais abrir), que abre tela cheia sem a marca e com as ações da conta já listadas, sem esconder atrás de botão. Troca de árvore por `useMediaQuery`, não CSS, porque o rodapé difere.
- Por pedido, nada de camada flutuante nesta rodada: seletor de time, opções da conta, busca e notificações estão de pé e mudos, cada um para entrar depois com o primitivo certo. `Dialog` e `DropdownMenu` continuam stub.
- `compactMoney` em `lib/utils/format.ts` (o arquivo estava vazio): R$ 30,5k e R$ 1,243M a partir de centavos, para a meta caber na largura do painel.
- Prévia nova em `/previa/menu`, que é onde a forma do celular aparece, e a forma do desktop entrou na vitrine em caixa alta.

Pendências:

- O menu é apresentacional e vive só de prévia: ligar time, pessoa, meta e contador ao banco vem junto com o `AppShell`, que segue `return null`.
- O formulário de cartão novo ainda não passou por um teste de ponta a ponta no navegador. A confirmação mudou de `confirmSetup({elements})` para `confirmCardSetup(clientSecret, ...)`, e nenhum check automático cobre isso.
- Mensagem de erro do campo de cartão é escrita pelo Stripe (em pt-BR). Se incomodar, dá para mapear os códigos para texto nosso.
