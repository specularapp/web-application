# Histórico

Registro por dia do que foi feito e do tempo investido. Atualizar ao encerrar cada dia de trabalho. Tempo pelos horários de commit quando não anotado; ajuste se a sessão começou antes.

| Dia | Tempo | Resumo |
| --- | --- | --- |
| 2026-08-27 (qua) | ~3h (19:30 a 22:40) | Fundação completa: estrutura, auth, banco multi-tenant, segurança, tema, libs e primitivos |

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
