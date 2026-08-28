# Segurança

## Princípios

1. Servidor primeiro. Dados e regras passam por Server Components, Server Actions e Route Handlers. O browser nunca recebe segredo.
2. Nenhum token em Web Storage. `localStorage`, `sessionStorage` e `IndexedDB` são proibidos para sessão, tokens, chaves e dados pessoais. O lint bloqueia o uso. Preferência de tema vai em cookie.
3. O banco fecha tudo: RLS em toda tabela, funções `security definer` com `search_path` vazio, `anon` sem execute, MFA com step-up.
4. Toda entrada é validada no servidor com zod, mesmo já validada no cliente.

## Onde cada credencial vive

| Item | Onde | Quem acessa | Observação |
| --- | --- | --- | --- |
| Sessão Supabase (access e refresh token) | Cookies `sb-<ref>-auth-token*` geridos por `@supabase/ssr`, `SameSite=Lax`, `Secure` | proxy, RSC, actions e browser client | Não são `HttpOnly` por design do Supabase (o browser client precisa ler). Mitigação: CSP estrita, JWT de 1h com rotação de refresh, browser client só onde Realtime exigir |
| Chave secreta Supabase | `.env` no servidor | `createAdminClient` (`server-only`) | Nunca no browser |
| Publishable key Supabase e Stripe | bundle público | browser | Públicas por design; a proteção é a RLS |
| Stripe secret, Resend, OpenAI, Redis, n8n | `.env` no servidor | `lib/*` com `import "server-only"` | O build falha se um módulo desses for importado no cliente |
| Tokens de convite e links públicos | URL uma única vez; banco guarda só o hash sha256 | RPC `security definer` | Expiram (7 dias); um pendente por e-mail |
| Nonce da CSP | header `x-nonce` por request | layout raiz → Emotion | Novo a cada request |
| Preferência de tema | cookie `theme` | servidor e browser | Não é segredo |
| Mobile (futuro) | `expo-secure-store` (Keychain e Keystore) | app | Nunca `AsyncStorage` |

## Camadas já implementadas

1. Headers estáticos em `next.config.ts`: HSTS, `nosniff`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy.
2. CSP por nonce em `src/lib/security/csp.ts`, aplicada no proxy: `script-src` com nonce e `strict-dynamic`; `style-src` com nonce (o Emotion recebe o nonce pelo layout raiz); `style-src-attr 'unsafe-inline'` só para atributos `style` (exigido por `next/image` e variáveis CSS inline, risco baixo); `img`, `connect` e `frame` restritos aos domínios do Supabase, GitHub, Google e Stripe; `frame-ancestors 'none'`; `object-src 'none'`. Consequência: todas as páginas renderizam por request. Novo domínio externo entra em `csp.ts`, nunca em `'unsafe-inline'` de script.
3. Sessão: refresh a cada navegação no proxy, claims verificadas com `getClaims`, step-up MFA para quem tem autenticador.
4. Autorização: RLS com `is_member`, `has_role`, `mfa_satisfied`; `anon` sem execute em nenhuma função.
5. Entrada: zod em toda action e route; ids como uuid; `safeNext` contra open redirect no callback.
6. Webhooks: Stripe, Resend e n8n verificam assinatura antes de ler o corpo.
7. Segredos: `env.ts` valida formato por serviço; `.env` fora do git; `server-only` nos clientes.

## Regras para código no cliente

- Nunca `localStorage`, `sessionStorage` ou `indexedDB`. Preferência de UI vai em cookie não sensível (hoje só `theme`).
- Token em query string só nos fluxos de convite e callback, uma única vez, com hash no banco.
- Nunca logar token, e-mail, documento ou qualquer dado pessoal.
- Browser client do Supabase só para Realtime. Leitura e escrita passam pelo servidor.
- Nada de `dangerouslySetInnerHTML` com conteúdo de usuário. Conteúdo rico (editor) é sanitizado no servidor antes de salvar e de renderizar.
- Erros para o usuário são genéricos; detalhe vai só para o log do servidor.

## Plano de evolução, em ordem

1. Rate limit em `lib/security/rate-limit.ts` com ioredis (janela deslizante): login e callback 10/min por IP, actions 120/min por usuário, IA 20/min por usuário, links públicos 30/min por IP. Webhooks sem limite, protegidos pela assinatura.
2. Tabela `audit_logs` (quem, o quê, quando, organização) alimentada por triggers nas tabelas sensíveis.
3. Storage: buckets privados, upload por URL assinada gerada no servidor, validação de tipo e tamanho, RLS em `storage.objects` por `organization_id` no caminho.
4. CSP com `report-to` para observar violações antes de endurecer mais; remover `style-src-attr` quando viável.
5. Rotação de chaves (Stripe, Resend, OpenAI, Supabase secret) a cada 6 meses ou em qualquer suspeita.
6. Dependências: `npm audit` no CI, lockfile commitado, Dependabot.
7. Sessões: tela de segurança lista e revoga sessões; ações críticas (excluir organização, trocar e-mail) exigem `mfa_satisfied()`.
8. Mobile: PKCE com deep link, secure store, revisão de certificado.
