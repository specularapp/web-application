-- Um orçamento aprovado vira uma cobrança, e uma só (2026-09-22, na varredura).
--
-- A única trava contra cobrar o mesmo orçamento duas vezes era de leitura: a janela de nova cobrança esconde
-- os orçamentos que já têm cobrança. Filtro de leitura não é trava. Dois POST na rota com o mesmo `quoteId`,
-- ou duas abas abertas dentro do minuto em que a lista fica no cache, criavam duas cobranças do mesmo
-- orçamento de R$ 40.000, e a visão geral somava R$ 80.000 em "a receber".
--
-- O índice é parcial porque a cobrança avulsa e a despesa não têm orçamento, e `quote_id` nulo se repete à
-- vontade. Substitui o índice de busca por `quote_id`, que este também serve.

drop index if exists public.charges_quote_idx;

create unique index charges_quote_idx
  on public.charges (quote_id)
  where quote_id is not null;

comment on index public.charges_quote_idx is
  'Um orçamento tem no máximo uma cobrança; nulo se repete, porque avulsa e despesa não têm orçamento.';
