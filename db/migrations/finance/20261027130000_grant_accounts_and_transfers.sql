-- As tabelas novas do financeiro não nasciam legíveis pela API (2026-10-27, correção: o caixa da visão geral
-- respondia "sem permissão"). Este projeto não concede tabela nova ao `authenticated` sozinho, como a migração dos
-- funis do CRM já fazia à mão; a view de saldo roda com a permissão de quem lê e precisava da conta embaixo dela.
-- A RLS de cada tabela continua decidindo quais linhas.

grant select, insert, update, delete on public.finance_accounts to authenticated;
grant select, insert, update, delete on public.finance_categories to authenticated;
grant select, insert, update on public.finance_transfers to authenticated;
grant select on public.finance_account_balances to authenticated;

grant all on public.finance_accounts to service_role;
grant all on public.finance_categories to service_role;
grant all on public.finance_transfers to service_role;
grant select on public.finance_account_balances to service_role;
