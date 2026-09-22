-- O cinza entra na paleta da casa (2026-09-21, junto das etapas de tarefa editáveis).
--
-- A paleta tinha as doze cores do sistema e nenhuma neutra, mas o catálogo de etapas sempre teve o Backlog
-- em cinza: é a cor de "ainda não entrou na fila", e sem ela a etapa nasceria azul, que já quer dizer outra
-- coisa. Vale para todo domínio que pinta por `palette_hue`: projeto, funil, item de catálogo, etiqueta.
--
-- Migração sozinha de propósito: o Postgres não deixa usar um valor de enum na mesma transação em que ele é
-- criado, e a migração seguinte semeia etapas em cinza.

alter type public.palette_hue add value if not exists 'gray';
