-- A mesma agenda reúne as duas pontas do financeiro: quem compra e quem fornece. Um contato pode ocupar
-- os dois papéis sem cadastro duplicado, e os registros atuais continuam clientes.
create type public.client_kind as enum ('customer', 'supplier', 'both');

alter table public.clients
  add column kind public.client_kind not null default 'customer';

create index clients_organization_kind_name_idx
  on public.clients (organization_id, kind, name);

comment on column public.clients.kind is
  'Papel do contato na operação: cliente, fornecedor ou ambos.';
