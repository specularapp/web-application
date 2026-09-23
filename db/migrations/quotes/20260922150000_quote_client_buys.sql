-- Orçamento é para quem compra. O seletor da tela já só oferece contatos de tipo cliente, mas o recorte
-- vivia só ali: o POST de /api/v1/orcamentos, que é o caminho do aplicativo, e o prefill por link
-- (/orcamentos/novo?cliente=<id>) continuavam aceitando o id de um fornecedor. Regra de negócio vale para
-- web e para o aplicativo, então ela desce para o banco.
--
-- O texto sobe para a tela porque `dbMessage` deixa passar o que vem de `raise exception` (P0001).
create or replace function public.assert_quote_client_buys()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind public.client_kind;
begin
  if new.client_id is null then
    return new;
  end if;

  -- Orçamento antigo já ligado a um fornecedor continua podendo ser salvo: a regra vale para quem entra
  -- agora e para quem troca de contato, e não para travar o que a base já tem.
  if tg_op = 'UPDATE' and new.client_id is not distinct from old.client_id then
    return new;
  end if;

  select kind into v_kind from public.clients where id = new.client_id;

  if v_kind = 'supplier' then
    raise exception 'Fornecedor não recebe orçamento. Escolha um contato que compra.';
  end if;

  return new;
end;
$$;

revoke execute on function public.assert_quote_client_buys() from public, anon;

create trigger quotes_client_buys
  before insert or update of client_id on public.quotes
  for each row execute function public.assert_quote_client_buys();

comment on function public.assert_quote_client_buys() is
  'Recusa orçamento ligado a contato que só fornece, em qualquer caminho de escrita.';
