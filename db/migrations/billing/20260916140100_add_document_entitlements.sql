-- Gerar documento a partir de um cadastro (orçamento, contrato e cobrança abertos da ficha do cliente) é do
-- plano Pro. A regra já estava escrita no leque, em texto, mas não existia no banco: o selo decorava a linha
-- e qualquer um clicava. Agora ela é linha de `plan_entitlements`, como todas as outras.
--
-- O mapa de relação entra junto, pelo mesmo motivo: ele cruza a conta inteira para desenhar o que se liga ao
-- quê, e é o tipo de leitura que o gratuito não tem.

insert into public.plan_features (key, kind, name)
values
  ('client_documents', 'flag', 'Gerar documentos a partir do cadastro'),
  ('relation_map', 'flag', 'Mapa de relação'),
  ('record_history', 'flag', 'Histórico de edições')
on conflict (key) do update set kind = excluded.kind, name = excluded.name;

insert into public.plan_entitlements (plan, feature_key, enabled, limit_value)
values
  ('free', 'client_documents', false, null),
  ('pro', 'client_documents', true, null),
  ('alliance', 'client_documents', true, null),
  ('free', 'relation_map', false, null),
  ('pro', 'relation_map', true, null),
  ('alliance', 'relation_map', true, null),
  -- O histórico é o registro do que a própria pessoa fez: negar isso no gratuito seria esconder dela o que
  -- ela mesma mudou. Fica aberto em todos os planos, e existe como recurso para o dia em que a retenção
  -- longa virar diferença de plano.
  ('free', 'record_history', true, null),
  ('pro', 'record_history', true, null),
  ('alliance', 'record_history', true, null)
on conflict (plan, feature_key) do update set enabled = excluded.enabled, limit_value = excluded.limit_value;
