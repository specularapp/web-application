-- Catálogo é leitura para quem está autenticado: nome do plano, ciclo, recurso e teto não são segredo,
-- e o id do preço no Stripe nunca sai daqui para o cliente, porque o servidor é quem resolve plano e
-- ciclo em preço. Nada em cobrança tem policy de escrita: quem grava é função `security definer` ou a
-- chave secreta no webhook. Assim ninguém troca o próprio plano falando direto com a API.
create policy billing_plans_select on public.billing_plans
  for select to authenticated
  using (true);

create policy billing_prices_select on public.billing_prices
  for select to authenticated
  using (active);

create policy plan_features_select on public.plan_features
  for select to authenticated
  using (true);

create policy plan_entitlements_select on public.plan_entitlements
  for select to authenticated
  using (true);

create policy organization_subscriptions_select on public.organization_subscriptions
  for select to authenticated
  using (public.is_member(organization_id));

create policy billing_trials_select on public.billing_trials
  for select to authenticated
  using (public.is_member(organization_id));

-- `billing_events` fica com RLS ligada e nenhuma policy: só a chave secreta do servidor enxerga.
