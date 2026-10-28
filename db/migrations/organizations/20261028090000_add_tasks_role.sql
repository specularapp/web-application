-- O cargo "só tarefas" (2026-10-28, a pedido: "crie um cargo no sistema que terá acesso apenas a tarefas"). Num
-- arquivo só dele porque o valor novo de um enum não pode ser usado na mesma transação que o criou, e a migração
-- seguinte já o usa nas funções e nas policies.

alter type public.member_role add value if not exists 'tasks';
