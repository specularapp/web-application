-- A despesa (2026-09-20, a pedido: "precisa existir a cobrança que eu recebo e precisa existir a despesa
-- também, que será uma cobrança mas que eu tenho que pagar e não receber").
--
-- Até aqui `charges` era só o que a equipe cobra do cliente, e o que a equipe paga só existia como
-- movimentação solta em `transactions`: um lançamento sem vencimento, sem parcela, sem situação e sem
-- contraparte. Quem tem uma assinatura para pagar todo mês ou um fornecedor parcelado não tinha onde
-- registrar isso antes de o dinheiro sair, então a conta a pagar vivia fora do sistema e o caixa só sabia
-- dela depois do fato.
--
-- A despesa é a mesma cobrança virada para o outro lado: mesmo título, mesma contraparte, mesmas parcelas
-- com vencimento, mesma situação saindo das parcelas e da data de hoje, mesma baixa. O que muda é o sinal:
-- baixar uma parcela de despesa gera uma **saída** no caixa, e não uma entrada. Por isso é uma coluna nesta
-- tabela, e não uma tabela nova: duplicar `charges`, `charge_installments` e `charge_events` para inverter
-- um sinal deixaria duas cópias da mesma regra para sair de sincronia no primeiro acerto.

create type public.charge_direction as enum ('incoming', 'outgoing');

comment on type public.charge_direction is
  'incoming: a equipe recebe (cobrança). outgoing: a equipe paga (despesa).';

alter table public.charges add column direction public.charge_direction not null default 'incoming';

-- As duas listas da tela são "a receber" e "a pagar", e cada uma varre a organização inteira pela direção.
create index charges_organization_direction_idx on public.charges (organization_id, direction, created_at desc);

-- Despesa não tem link de pagador: o link existe para o cliente ver o que deve e avisar que pagou, e do
-- lado de cá quem paga é a própria equipe. O `token_hash` continua nascendo (a coluna é obrigatória e única
-- para toda cobrança), mas enviar e ser visto passam a ser impossíveis por regra do banco, e não só por a
-- tela não oferecer o botão: a mesma barreira vale para o aplicativo e para a `api/v1`.
alter table public.charges add constraint charges_outgoing_not_shared
  check (direction = 'incoming' or (sent_at is null and viewed_at is null));
