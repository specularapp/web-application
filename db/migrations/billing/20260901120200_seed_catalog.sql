-- Catálogo de planos. Nome e degrau acompanham `features/billing/plans.ts`; o valor cobrado fica no
-- Stripe e o vínculo com o preço entra por `npm run stripe:sync`. Teste gratuito de 7 dias só no Pro,
-- que foi o pedido; os outros ficam em zero até alguém decidir o contrário.
insert into public.billing_plans (code, name, tier, trial_days, trial_requires_payment_method, is_paid)
values
  ('free', 'Gratuito', 0, 0, false, false),
  ('pro', 'Specular Pro', 1, 7, true, true),
  ('alliance', 'Specular Alliance', 2, 0, true, true)
on conflict (code) do update set
  name = excluded.name,
  tier = excluded.tier,
  trial_days = excluded.trial_days,
  trial_requires_payment_method = excluded.trial_requires_payment_method,
  is_paid = excluded.is_paid;

-- `plan_features` e `plan_entitlements` nascem vazias de propósito: cada condição de plano entra
-- junto com a tela que a exige. Sem linha, `plan_allows` nega e `plan_limit` devolve zero.
