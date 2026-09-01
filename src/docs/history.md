# Histórico

Registro por dia do que foi feito e do tempo investido. Atualizar ao encerrar cada dia de trabalho. Tempo pelos horários de commit quando não anotado; ajuste se a sessão começou antes.

| Dia | Tempo | Resumo |
| --- | --- | --- |
| 2026-08-27 (qua) | ~3h (19:30 a 22:40) | Fundação completa: estrutura, auth, banco multi-tenant, segurança, tema, libs e primitivos |
| 2026-08-28 (qui) | ~5h (noite, até ~01:00 de 29) | Design system: cantos squircle com cornerKit, Button, Text, Surface, Progress, Spinner, campos com máscara, DatePicker, Tooltip e vitrine em /componentes |
| 2026-08-29 (sex) | ~8h30 (13:00 a 21:30) | Design system (Badge, Listbox, Pagination, Checkbox, Switch, Avatar, Toast, Carousel, PasswordInput, BrandIcon, GradientBlinds), motor de cantos próprio no lugar do cornerKit, tela de login completa nos dois layouts com fundo WebGL, tema escuro forçado em auth |
| 2026-08-30 (sáb) | ~1h no dia (21:15 a 22:10) mais a continuação no dia 31 (19:59 a 21:47) | Cadastro, MFA, e-mails próprios, auditoria da autenticação e correções de produção |
| 2026-08-31 (dom) | em andamento | Configuração inicial do time em duas etapas, domínio organizations com service e api/v1, Select do design system |

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

Pendências:

- Rodar `npm run db:push` e `npm run db:types` no projeto hospedado: as duas migrações novas ainda não foram aplicadas, e `src/types/database.ts` está escrito à mão com o que elas criam.
- Etapa do plano, que é a próxima conversa: Stripe, catálogo e a tela em si.
- Fluxo de convite ponta a ponta com dois usuários de verdade (e-mail entregue, `/convite/<token>`, aceite e troca de papel).
- As pendências de 2026-08-29 e 2026-08-30 continuam, tirando `requireUser` sem uso, a falta de `service.ts` com `api/v1` (que passam a valer só para o domínio `auth`) e os boundaries de erro em `null`, que agora só falta cobrir a raiz.
