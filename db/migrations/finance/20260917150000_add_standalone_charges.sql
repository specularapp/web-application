-- Cobrança avulsa, com foto e recorrência (2026-09-17, a pedido).
--
-- Até aqui toda cobrança nascia de um cliente da base: `client_name` era obrigatório e a criação recusava
-- sem `client_id`. Mas nem tudo que se cobra é de um cliente cadastrado. Uma assinatura de sistema, um
-- serviço avulso, um rateio de equipamento: existe cobrança cuja contraparte não é ninguém da base, e
-- obrigar a cadastrar um "cliente" falso só para poder cobrar sujava a base de clientes.
--
-- Então `client_name` passa a aceitar nulo. O `check` continua valendo para quando ele existe (em Postgres
-- um `check` sobre nulo dá nulo, que passa), e o vínculo com a base segue possível: o que muda é que ele
-- deixa de ser obrigatório.

alter table public.charges alter column client_name drop not null;

-- A foto da cobrança: o que está sendo cobrado, quando isso tem rosto. É o que o pagador vê no link
-- público, junto do título, e é o que diferencia "Assinatura do sistema" de "Serviço de manutenção" numa
-- lista de cobranças avulsas que, sem cliente, ficariam todas parecidas.
alter table public.charges add column image_url text check (public.text_len_ok(image_url, 1, 500));

-- Com que frequência ela se repete. `none` é a cobrança de uma vez só, que é a maioria.
create type public.charge_recurrence as enum ('none', 'monthly', 'quarterly', 'yearly');

alter table public.charges add column recurrence public.charge_recurrence not null default 'none';

/* De qual cobrança esta nasceu, quando ela é a repetição da anterior. Serve para a linha do tempo contar a
   série inteira, e para a próxima nunca nascer duas vezes da mesma: o `unique` é a trava, e não um `if` no
   serviço, que duas abas abertas ao mesmo tempo furariam. `on delete set null` porque apagar a de janeiro
   não pode apagar a de fevereiro, que já foi paga. */
alter table public.charges add column recurring_from_id uuid references public.charges (id) on delete set null;

create unique index charges_recurring_from_idx on public.charges (recurring_from_id) where recurring_from_id is not null;
