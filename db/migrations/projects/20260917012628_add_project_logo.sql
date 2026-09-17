-- A logo do projeto (2026-09-16, a pedido). É outra coisa que a capa: a capa é a faixa 16:9 do cartão, e a
-- logo é a marca quadrada que aparece toda vez que o projeto vira uma linha de lista, na ficha do cliente,
-- no painel, numa menção. Onde hoje há um glifo de pasta igual para todos.
--
-- Nula não é falta: sem logo própria, a tela cai na do cliente, e sem cliente cai na arte gerada no matiz do
-- projeto. Quem escolhe a ordem é a tela, e não o banco.

alter table public.projects
  add column if not exists logo_url text check (public.text_len_ok(logo_url, 1, 500));

comment on column public.projects.logo_url is
  'A marca quadrada do projeto. Nula cai na logo do cliente e, sem cliente, na arte gerada.';
