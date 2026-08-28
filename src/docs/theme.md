# Tema claro e escuro: mapa completo

## Fonte da verdade

- `src/styles/tokens.css`: primitivos `--sys-*` e semânticos `--color-*` com `light-dark()`; `color-scheme: light dark` no `:root`.
- Preferência: cookie `theme` com `light` ou `dark`; ausente significa seguir o sistema. O layout raiz lê o cookie e coloca `data-theme` no `html`, que só troca o `color-scheme`. Sem flash, sem script inline, compatível com a CSP.
- Helper: `src/lib/theme.ts` (`readThemeCookie`, `themeCookieString`).
- `ThemeToggle` (a implementar): escreve o cookie e `document.documentElement.dataset.theme` na hora; ciclo sistema → claro → escuro; `aria-label` descreve o estado atual e o próximo.

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
