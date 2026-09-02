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
3. Sessão: refresh a cada navegação no proxy, claims verificadas com `getClaims`, step-up MFA para quem tem autenticador. Cadastrar autenticador é convite e pode ser pulado (cookie `sp-mfa-skip`, 30 dias); o step-up de quem já tem fator não pode, e a action de pular recusa quando o nível seguinte é aal2.
4. Autorização: RLS com `is_member`, `has_role`, `mfa_satisfied`; `anon` sem execute em nenhuma função.
5. Entrada: zod em toda action e route; ids como uuid; `safeNext` contra open redirect no callback.
6. Webhooks: Stripe, Resend e n8n verificam assinatura antes de ler o corpo.
7. Segredos: `env.ts` valida formato por serviço; `.env` fora do git; `server-only` nos clientes.
8. Rate limit em `lib/security/rate-limit.ts`: janela deslizante com sorted set no Redis, num script Lua (contar, expirar e gravar num passo atômico). Escopos e limites por minuto em `rateLimitRules`: `auth` 10 por IP, `action` 120 por usuário, `ai` 20 por usuário, `publicLink` 30 por IP. Aplicado nas Server Actions de `features/auth` (OAuth, cadastro de autenticador, verificação e remoção de TOTP), com chave por operação e IP. Falha do Redis libera o request (fail-open): indisponibilidade do cache não pode derrubar o login. Webhooks seguem sem limite, protegidos pela assinatura.
9. Turnstile (Cloudflare) em `lib/security/turnstile.ts`, com o widget em `components/security/turnstile-widget/`. A verificação é fail-closed: token inválido, erro de rede ou timeout de 5s reprovam. `TURNSTILE_SECRET_KEY` só no servidor; `NEXT_PUBLIC_TURNSTILE_SITE_KEY` é pública por design. A CSP libera `challenges.cloudflare.com` em `frame-src` e `connect-src`; o script carrega pelo nonce com `strict-dynamic`, sem allowlist de host.

10. Caminho de redirecionamento em `lib/security/safe-path.ts`, usado pelo callback OAuth e por `nextPathSchema`. Recusa o que não começa com `/`, o que tem barra invertida em qualquer posição e o que tem caractere de controle, espaço ou DEL. O bloqueio de `//` sozinho não bastava: o navegador normaliza `\` para `/`, então `/\evil.com` virava protocol-relative e saía do domínio.
11. Limite de corpo em `lib/security/payload.ts`: webhooks leem no máximo 1 MB, conferindo o `Content-Length` antes e contando os bytes durante a leitura (o cabeçalho pode faltar ou mentir em transferência chunked). Acima disso responde 413 sem carregar o corpo na memória.
12. Dependências: `npm run audit` (`--audit-level=high`).

13. Cobrança (2026-09-01). Dado de cartão nunca entra no nosso perímetro: cada campo de cartão é um iframe do Stripe (elementos avulsos dentro do nosso `FieldShell` desde 2026-09-02), então número, validade e CVV não passam pelo nosso DOM nem pelos nossos servidores, e o escopo PCI segue SAQ A, e o que guardamos é bandeira e quatro últimos dígitos, que o próprio Stripe devolve. Nenhuma tabela de cobrança tem policy de escrita, então ninguém troca o próprio plano pela API do banco, nem o dono do time; escrever plano e status é privilégio de `sync_subscription`, revogada de `authenticated` e concedida só a `service_role`, e sempre com o objeto que o Stripe devolveu, nunca com o corpo do pedido. Quem pode gerenciar é `can_manage_billing` no banco, não a organização "atual" do perfil. A confirmação relê a intenção no Stripe e confere que o `metadata.organization_id` e o cliente batem com a linha da organização antes de gravar. O webhook confere a assinatura com `constructEventAsync` antes de ler o corpo, guarda o id do evento em `billing_events` para reentrega não reprocessar, e responde 500 quando a escrita falha, para o Stripe reentregar. Escopo `billing` no rate limit (20 por minuto por pessoa e operação), mais apertado que o `action`, porque cada chamada sai para fora e mexe em dinheiro. A CSP ganhou `r.stripe.com` e `merchant-ui-api.stripe.com` em `connect-src` e `*.stripe.com` em `img-src`, que é o mínimo que os campos de cartão exigem; o script do Stripe entra pelo `strict-dynamic`, sem allowlist de host.

## Auditoria OWASP

Levantamento contra a lista de API e Web Top 10.

| Risco | Situação | Onde |
| --- | --- | --- |
| BOLA e IDOR | coberto | RLS com `is_member` em toda tabela; trocar o id na URL não vaza porque o filtro é do banco, não da aplicação |
| BFLA | coberto | `has_role` por operação; excluir organização exige `owner` |
| Elevação de privilégio | coberto | `create_invite` recusa `p_role = 'owner'` e exige `owner` ou `admin` para convidar |
| SQL injection | coberto | Supabase parametriza; funções `security definer` com `search_path` vazio |
| XSS | coberto | escape padrão do React e CSP por nonce com `strict-dynamic` |
| Clickjacking | coberto | `X-Frame-Options: DENY` e `frame-ancestors 'none'` |
| CSRF | coberto | Server Actions do Next validam origem; cookies `SameSite=Lax` |
| Sequestro de sessão | coberto | CSP estrita, JWT de 1h com rotação, `Secure` |
| Força bruta | coberto | rate limit nas actions de auth |
| Segredo no bundle | coberto | `server-only` quebra o build se um módulo de servidor for importado no cliente |
| Open redirect | corrigido | `safe-path.ts` (item 10) |
| Fraude de assinatura | coberto | nenhuma policy de escrita em cobrança; `sync_subscription` só para `service_role`; plano em vigor sai de `organization_plan`, que exige status com direito; teste gratuito uma vez por organização em `billing_trials` |
| Webhook forjado | coberto | assinatura conferida antes da leitura, corpo cru com limite de 1 MB, id do evento registrado contra reentrega |
| Corpo gigante e exaustão | corrigido para webhooks | `payload.ts` (item 11) |
| Dependência vulnerável | monitorado | `npm run audit`; falta rodar em CI e ligar o Dependabot |
| Mass assignment | pendente | nenhuma escrita de feature existe ainda. Regra ao criar: montar o objeto campo a campo a partir do schema zod, nunca repassar o corpo recebido |
| Exposição excessiva de dados | pendente | idem. Regra: `select()` com colunas explícitas, nunca `select('*')` em resposta que sai para o cliente |
| CORS | pendente | `api/v1` ainda não existe. Ao criar, origem explícita, nunca `*` com credenciais |
| SSRF | pendente | não há campo que aceite URL. Vira risco no upload por link e no disparo para o n8n; validar host contra lista de permitidos e recusar faixa privada e `169.254.169.254` |
| ReDoS | atenção | evitar quantificador aninhado em regex sobre entrada do usuário |

Rate limit não é defesa contra DDoS volumétrico: o tráfego chega ao runtime e cada bloqueio ainda custa invocação e ida ao Redis. Ele cobre brute-force, scraping, enumeração e abuso de endpoint caro. Flood se resolve na borda (WAF e proteção do provedor), fora da aplicação.

## Regras para código no cliente

- Nunca `localStorage`, `sessionStorage` ou `indexedDB`. Preferência de UI vai em cookie não sensível (hoje só `theme`).
- Token em query string só nos fluxos de convite e callback, uma única vez, com hash no banco.
- Nunca logar token, e-mail, documento ou qualquer dado pessoal.
- Browser client do Supabase só para Realtime. Leitura e escrita passam pelo servidor.
- Nada de `dangerouslySetInnerHTML` com conteúdo de usuário. Conteúdo rico (editor) é sanitizado no servidor antes de salvar e de renderizar.
- Erros para o usuário são genéricos; detalhe vai só para o log do servidor.

## Plano de evolução, em ordem

1. Plugar os escopos `action`, `ai` e `publicLink` conforme cada feature entrar (o motor e os limites já existem; só `auth` está em uso). O `TurnstileWidget` já está no login, ligado por `hasTurnstile()` (só monta e só verifica quando as duas chaves existem); falta montar em cadastro e recuperação de senha quando esses formulários existirem.
2. Tabela `audit_logs` (quem, o quê, quando, organização) alimentada por triggers nas tabelas sensíveis.
3. Storage: buckets privados, upload por URL assinada gerada no servidor, validação de tipo e tamanho, RLS em `storage.objects` por `organization_id` no caminho.
4. CSP com `report-to` para observar violações antes de endurecer mais; remover `style-src-attr` quando viável.
5. Rotação de chaves (Stripe, Resend, OpenAI, Supabase secret) a cada 6 meses ou em qualquer suspeita.
6. Dependências: `npm audit` no CI, lockfile commitado, Dependabot.
7. Sessões: tela de segurança lista e revoga sessões; ações críticas (excluir organização, trocar e-mail) exigem `mfa_satisfied()`.
8. Mobile: PKCE com deep link, secure store, revisão de certificado.

## Sessão e cookie de lembrar

- O login com senha grava o cookie `sp-remember` (`1` um ano, `0` sessão). Quando é `0`, `scopeToSession` em `src/lib/supabase/cookies.ts` remove `maxAge` e `expires` de todo cookie que o Supabase grava, tanto em `createClient` do servidor quanto no `updateSession` do proxy. Assim a sessão acaba ao fechar o navegador e o refresh de token não a torna persistente de novo. Exceção: `maxAge: 0` passa intacto, porque é assim que o `@supabase/ssr` apaga cookie ao sair, e removê-lo deixaria o cookie vazio no navegador em vez de removido.
- O `Secure` dos cookies de sessão não vem de graça: o `@supabase/ssr` nunca acrescenta o atributo. Os dois clientes passam `cookieOptions: sessionCookieOptions` (`lib/supabase/cookies.ts`), que liga `secure` em produção e deixa desligado em desenvolvimento para o acesso por IP na rede local continuar funcionando.
- `/auth/callback` é prefixo aberto no proxy (`openPrefixes`). Sem isso o callback do OAuth caía no redirect para `/login` antes de trocar o código.
- Turnstile em desenvolvimento usa as chaves de teste da Cloudflare (site `1x00000000000000000000BB`, a invisível, e secret `1x0000000000000000000000000000000AA`), que sempre aprovam; o widget real está em modo Invisible no painel; as reais estão comentadas no `.env`. Antes de publicar, trocar de volta e conferir o domínio cadastrado no painel da Cloudflare.
