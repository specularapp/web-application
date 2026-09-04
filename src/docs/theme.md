# Tema claro e escuro: mapa completo

## Fonte da verdade

- `src/styles/tokens.css`: primitivos `--sys-*` e semânticos `--color-*` com `light-dark()`; `color-scheme: light dark` no `:root`.
- Preferência: cookie `theme` com `light`, `dark` ou `system`; ausente significa **escuro**, o padrão do produto (decisão de 2026-09-01, antes seguia o sistema). O layout raiz lê o cookie e, por `themeAttribute`, coloca `data-theme` no `html`, que só troca o `color-scheme`; `system` não põe atributo e a raiz segue o aparelho. Sem flash, sem script inline, compatível com a CSP. `system` virou preferência gravada em 2026-09-03, quando o seletor entrou no menu da conta: até então apagava o cookie e o padrão escuro voltava na recarga, o que em produção lia como tema travado.
- Trocar o tema recalcula a página inteira, porque cada token `light-dark()` muda ao mesmo tempo. `applyTheme` grava o cookie na hora e deixa a troca do atributo para o quadro seguinte, para o botão apertado pintar antes do trabalho pesado; onde o navegador tem transição de visão, a troca acontece atrás de uma foto do estado antigo com fundido curto, e o recálculo deixa de aparecer como engasgo. Com movimento reduzido a troca é seca.
- Helper: `src/lib/theme.ts` (`readThemeCookie`, `themeCookieString`).
- `ThemeToggle` (`components/layout/theme-toggle/`): `Listbox` com Sistema, Claro e Escuro. Escreve o cookie por `themeCookieString` e troca `document.documentElement.dataset.theme` na hora (remove o atributo em Sistema). Recebe o valor inicial do layout raiz, que já leu o cookie, então não há salto na hidratação. Montado flutuando no canto inferior esquerdo, numa doca arrastável pela alça (ponteiro com captura, setas do teclado em passos de 16px, sempre dentro da viewport), só em homologação (`isHomologation()` em `lib/env.ts`: `NODE_ENV` diferente de produção ou `VERCEL_ENV` preview). Em produção o seletor vai para a tela de configurações.

## O que já responde ao tema

| Elemento | Como |
| --- | --- |
| Cores e sombras | tokens com `light-dark()` |
| Controles nativos, scrollbar, `::selection`, placeholder | `color-scheme` e tokens |
| Logo | máscara CSS sobre `--color-brand` (preto no claro, branco no escuro) |
| Favicon | `icon.svg` com `@media (prefers-color-scheme)`; segue o sistema, não o `data-theme` (limitação de favicon) |
| `theme-color` do navegador | `viewport.themeColor` por `prefers-color-scheme`; segue o sistema |
| Imagem Open Graph | sempre escura (imagem estática) |
| Emotion | só `var(--color-*)` |

## Tema forçado por rota

- Autenticação (`/login`, `/cadastro`, `/recuperar-senha`, `/redefinir-senha`, `/mfa`) é sempre escura. O proxy grava `x-pathname` e o layout raiz troca o `data-theme` para `dark` quando `isAuthPath()` bate, ignorando o cookie só nessas rotas. `color-scheme` num elemento interno não serve: o `light-dark()` das variáveis é resolvido no `:root`.

## Regras

- Nunca cor literal em componente. Só tokens. Exceções: imagem OG e `manifest`.
- Nunca `@media (prefers-color-scheme)` em componente: os tokens já resolvem. Se algo além de cor precisar variar (uma ilustração, por exemplo), preferir SVG com `currentColor` ou máscara CSS.
- Libs externas (tabela, kanban, gráficos, editor, toasts) recebem tema por variáveis CSS mapeadas para tokens em `src/styles/vendors/<lib>.css`. Nunca usar tema pronto da lib.
- Gráficos usam paleta categórica em ordem fixa: `--sys-blue`, `--sys-green`, `--sys-orange`, `--sys-purple`, `--sys-pink`, `--sys-teal`; sequencial usa opacidade do acento.
- Contraste AA nos dois temas em todo componente novo. Testar forçando `data-theme="light"` e `data-theme="dark"` no `html`.
- Componente novo só é aceito depois de visto nos dois temas.

## Depois

- Espelhar a preferência em `profiles` para valer entre dispositivos (e no app mobile).
- Testes visuais automatizados nos dois temas quando os componentes existirem.
