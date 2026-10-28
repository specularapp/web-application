-- Dinheiro vivo como forma de pagamento (2026-10-27, na vinda do financeiro da Le Ange): obra recebe e paga em
-- espécie, e sem a forma o caixa da equipe não tinha onde lançar. Num arquivo só dele porque o valor novo de um
-- enum não pode ser usado na mesma transação que o criou, e a migração seguinte já o usa.

alter type public.payment_method add value if not exists 'cash';
