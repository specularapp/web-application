/**
 * Contas de paginação das listas em grade: quantos cabem numa página e como não perder o lugar quando
 * esse tanto muda. Compartilhado pelo catálogo e pela base de clientes (2026-09-08).
 */

/**
 * Quantos itens cabem em `rows` linhas de uma grade com `columns` colunas, sempre par e nunca acima de `max`:
 * a página só passa quando está completa, então ela é o que a grade mostra inteiro.
 */
export function gridPageSize(columns: number, rows: number, max: number) {
  const size = Math.min(max, Math.max(1, columns) * rows);
  return Math.max(2, size % 2 === 0 ? size : size - 1);
}

/** A página que mantém o primeiro item à vista quando o tamanho da página muda de `from` para `to`. */
export function remapPage(page: number, from: number, to: number) {
  return Math.floor(((page - 1) * from) / to) + 1;
}
