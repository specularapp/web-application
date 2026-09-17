-- Projeto sem cliente (2026-09-16, a pedido). Nem todo projeto é de alguém: projeto de estudo, projeto
-- próprio, protótipo. Eles continuam contando para o portfólio e para o currículo, que é o que a página
-- serve, e o cliente passa a ser opcional como já é a data de entrega.
--
-- O vínculo em si não muda: continua apontando para `clients` com `on delete restrict`, e o gatilho que
-- cobra a mesma organização já devolve cedo quando a coluna é nula, então ele segue valendo para quem tem
-- cliente e não atrapalha quem não tem.

alter table public.projects
  alter column client_id drop not null;

comment on column public.projects.client_id is
  'De quem é o projeto. Nulo é projeto independente: estudo, projeto próprio, protótipo.';
