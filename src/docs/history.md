# Histórico

Registro por dia do que foi feito e do tempo investido. Atualizar ao encerrar cada dia de trabalho. Tempo pelos horários de commit quando não anotado; ajuste se a sessão começou antes.

| Dia | Tempo | Resumo |
| --- | --- | --- |
| 2026-08-27 (qua) | ~3h (19:30 a 22:40) | Fundação completa: estrutura, auth, banco multi-tenant, segurança, tema, libs e primitivos |
| 2026-08-28 (qui) | ~5h (noite, até ~01:00 de 29) | Design system: cantos squircle com cornerKit, Button, Text, Surface, Progress, Spinner, campos com máscara, DatePicker, Tooltip e vitrine em /componentes |

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
