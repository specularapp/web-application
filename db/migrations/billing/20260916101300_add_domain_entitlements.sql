-- As condições de plano das telas que passaram a existir de verdade. Cada uma entra junto com a tela que a
-- exige, como manda a regra: sem linha aqui, `plan_allows` nega e `plan_limit` devolve zero, e a chamada
-- que usa uma chave inexistente derruba, para erro de digitação aparecer no primeiro teste.
--
-- Nulo com `enabled` é ilimitado. Os tetos do gratuito são o que cabe numa conta de uma pessoa começando;
-- os pagos abrem.

insert into public.plan_features (key, kind, name)
values
  ('ai_actions', 'limit', 'Ações de IA por mês'),
  ('active_projects', 'limit', 'Projetos ativos'),
  ('team_members', 'limit', 'Pessoas no time'),
  ('automations', 'limit', 'Automações ativas'),
  ('custom_domain', 'flag', 'Domínio próprio no portfólio')
on conflict (key) do update set kind = excluded.kind, name = excluded.name;

insert into public.plan_entitlements (plan, feature_key, enabled, limit_value)
values
  ('free', 'ai_actions', true, 50),
  ('pro', 'ai_actions', true, 1000),
  ('alliance', 'ai_actions', true, null),
  ('free', 'active_projects', true, 3),
  ('pro', 'active_projects', true, null),
  ('alliance', 'active_projects', true, null),
  ('free', 'team_members', true, 1),
  ('pro', 'team_members', true, 5),
  ('alliance', 'team_members', true, null),
  ('free', 'automations', true, 1),
  ('pro', 'automations', true, 20),
  ('alliance', 'automations', true, null),
  ('free', 'custom_domain', false, null),
  ('pro', 'custom_domain', true, null),
  ('alliance', 'custom_domain', true, null)
on conflict (plan, feature_key) do update set enabled = excluded.enabled, limit_value = excluded.limit_value;
