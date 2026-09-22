-- A pasta de projetos ganha cor e ícone (2026-09-22, a pedido de trazer para as tarefas o que o funil de
-- vendas já tem: "cor e icone da pasta").
--
-- A pasta era só um nome na árvore do menu, com o mesmo glifo cinza para todas. Numa árvore de dez pastas
-- isso faz o olho ler o texto de cada linha para achar o caminho; com cor e glifo, a pasta é reconhecida
-- antes de ser lida, que é o que o projeto já tinha e o que o funil ganhou na mesma semana.
--
-- O ícone sai do mesmo enum do projeto: são os mesmos sete desenhos, e um enum próprio por nível da árvore
-- seria a mesma lista escrita duas vezes.

alter table public.project_folders
  add column hue public.palette_hue not null default 'gray',
  add column glyph public.project_glyph not null default 'tray';

comment on column public.project_folders.hue is
  'A cor da pasta na árvore do menu. Cinza é o padrão: pasta é caminho, e cor forte por padrão competiria com os projetos dentro dela.';
