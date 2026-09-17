/**
 * Prova do schema contra o banco hospedado: cria uma organização de teste, escreve uma linha de cada
 * domínio, confere o identificador gerado pelo gatilho, os `check` que precisam recusar e a conta das
 * parcelas, e apaga tudo no fim. Roda com a chave secreta, então a RLS não entra: o que está sendo provado
 * aqui é o schema, e não a permissão.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY");

const db = createClient(url, key, { auth: { persistSession: false } });

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });

const slug = `prova-${Date.now().toString(36)}`;
const { data: org, error: orgError } = await db
  .from("organizations")
  .insert({ name: "Prova do schema", slug })
  .select("id")
  .single();

if (orgError) throw new Error(`organização: ${orgError.message}`);
const organizationId = org.id;

try {
  // Cliente: identificador gerado pelo gatilho, no formato da casa.
  const { data: client, error: clientError } = await db
    .from("clients")
    .insert({ organization_id: organizationId, name: "Construtora Aurora", email: "contato@aurora.com.br", phone: "21991001742" })
    .select("id, reference")
    .single();
  check("cliente criado", !clientError, clientError?.message ?? client.reference);
  check("identificador do cliente", /^CLI-\d{4}-\d{4}$/.test(client?.reference ?? ""), client?.reference);

  // O segundo cliente anda a sequência.
  const { data: second } = await db
    .from("clients")
    .insert({ organization_id: organizationId, name: "Segundo cliente" })
    .select("reference")
    .single();
  check("sequência anda", second?.reference?.endsWith("0002"), second?.reference);

  // E-mail torto é recusado pelo `check` da coluna.
  const { error: badEmail } = await db
    .from("clients")
    .insert({ organization_id: organizationId, name: "Torto", email: "nao-e-email" });
  check("e-mail inválido recusado", Boolean(badEmail), badEmail?.code);

  // Etiquetas demais são recusadas pelo `text_array_ok`.
  const { error: manyTags } = await db
    .from("clients")
    .insert({ organization_id: organizationId, name: "Etiquetado", tags: Array.from({ length: 20 }, (_, i) => `t${i}`) });
  check("teto de etiquetas", Boolean(manyTags), manyTags?.code);

  // Catálogo: serviço com estoque é recusado pelo `check` cruzado de tipo.
  const { error: wrongKind } = await db.from("catalog_items").insert({
    organization_id: organizationId,
    name: "Serviço com estoque",
    kind: "service",
    price: 1000,
    unit: "project",
    stock_quantity: 1,
    stock_capacity: 2,
    stock_minimum: 1,
  });
  check("serviço não guarda estoque", Boolean(wrongKind), wrongKind?.code);

  const { data: item, error: itemError } = await db
    .from("catalog_items")
    .insert({ organization_id: organizationId, name: "Site institucional", kind: "service", price: 980000, unit: "project", duration_min: 20, duration_max: 30 })
    .select("id, reference")
    .single();
  check("item de catálogo", !itemError, itemError?.message ?? item.reference);

  // Projeto: slug único por organização e cliente da mesma organização.
  const { data: project, error: projectError } = await db
    .from("projects")
    .insert({ organization_id: organizationId, slug: "aurora", name: "Aurora", client_id: client.id })
    .select("id, reference, stages")
    .single();
  check("projeto criado", !projectError, projectError?.message ?? project.reference);
  check("etapas padrão do quadro", project?.stages?.length === 5, String(project?.stages));

  // Tarefa numa etapa que o projeto não declara: recusada pelo gatilho.
  const { error: badStage } = await db
    .from("tasks")
    .insert({ organization_id: organizationId, project_id: project.id, title: "Fora do fluxo", due_date: "2026-12-01", stage: "publishing" });
  check("etapa fora do quadro recusada", Boolean(badStage), badStage?.message?.slice(0, 60));

  const { data: task, error: taskError } = await db
    .from("tasks")
    .insert({ organization_id: organizationId, project_id: project.id, title: "Primeira tarefa", due_date: "2026-12-01", stage: "todo" })
    .select("reference")
    .single();
  check("tarefa criada", !taskError, taskError?.message ?? task.reference);

  // Orçamento com linha, e o resumo do token no formato que o `check` exige.
  const hash = "a".repeat(64);
  const { data: quote, error: quoteError } = await db
    .from("quotes")
    .insert({ organization_id: organizationId, title: "Site da Aurora", client_id: client.id, client_name: "Construtora Aurora", share_token_hash: hash })
    .select("id, reference")
    .single();
  check("orçamento criado", !quoteError, quoteError?.message ?? quote.reference);

  const { error: badHash } = await db
    .from("quotes")
    .insert({ organization_id: organizationId, title: "Token torto", client_name: "X", share_token_hash: "curto" });
  check("resumo de token torto recusado", Boolean(badHash), badHash?.code);

  const { error: lineError } = await db.from("quote_lines").insert({
    organization_id: organizationId,
    quote_id: quote.id,
    catalog_item_id: item.id,
    name: "Site institucional",
    quantity: 1,
    unit_price: 980000,
  });
  check("linha do orçamento", !lineError, lineError?.message);

  // Cobrança: a soma das parcelas precisa bater com o total, e o gatilho é diferido.
  const { data: charge, error: chargeError } = await db
    .from("charges")
    .insert({
      organization_id: organizationId,
      title: "Entrada do site",
      client_id: client.id,
      client_name: "Construtora Aurora",
      amount: 300000,
      token_hash: "b".repeat(64),
    })
    .select("id, reference")
    .single();
  check("cobrança criada", !chargeError, chargeError?.message ?? charge.reference);

  const { error: installmentsError } = await db.from("charge_installments").insert([
    { organization_id: organizationId, charge_id: charge.id, number: 1, amount: 150000, due_date: "2026-10-10" },
    { organization_id: organizationId, charge_id: charge.id, number: 2, amount: 150000, due_date: "2026-11-10" },
  ]);
  check("parcelas somam o total", !installmentsError, installmentsError?.message);

  const { error: mismatch } = await db
    .from("charge_installments")
    .insert({ organization_id: organizationId, charge_id: charge.id, number: 3, amount: 999, due_date: "2026-12-10" });
  check("soma que não bate é recusada", Boolean(mismatch), mismatch?.message?.slice(0, 60));

  // Contrato: as duas partes e a situação vinda do gatilho.
  const { data: contract, error: contractError } = await db
    .from("contracts")
    .insert({ organization_id: organizationId, title: "Contrato do site", source: "scratch", client_id: client.id, quote_id: quote.id })
    .select("id, reference, status")
    .single();
  check("contrato criado", !contractError, contractError?.message ?? contract.reference);

  const { error: partiesError } = await db.from("contract_parties").insert([
    { organization_id: organizationId, contract_id: contract.id, role: "issuer", name: "Equipe", email: "equipe@specular.app", token_hash: "c".repeat(64), position: 0 },
    { organization_id: organizationId, contract_id: contract.id, role: "client", name: "Aurora", email: "aurora@aurora.com.br", token_hash: "d".repeat(64), position: 1 },
  ]);
  check("partes do contrato", !partiesError, partiesError?.message);

  await db.from("contracts").update({ sent_at: new Date().toISOString() }).eq("id", contract.id);
  await db
    .from("contract_parties")
    .update({ signed_at: new Date().toISOString(), signature_url: "data:image/png;base64,AAA" })
    .eq("contract_id", contract.id)
    .eq("role", "client");

  const { data: afterSign } = await db.from("contracts").select("status").eq("id", contract.id).single();
  check("situação parcial após uma assinatura", afterSign?.status === "partial", afterSign?.status);

  await db
    .from("contract_parties")
    .update({ signed_at: new Date().toISOString(), signature_url: "data:image/png;base64,BBB" })
    .eq("contract_id", contract.id)
    .eq("role", "issuer");

  const { data: afterBoth } = await db.from("contracts").select("status, signed_at").eq("id", contract.id).single();
  check("assinado com as duas", afterBoth?.status === "signed" && Boolean(afterBoth?.signed_at), afterBoth?.status);

  // Oportunidade: etapa de desfecho exige data de fechamento.
  const { error: openWithClose } = await db
    .from("opportunities")
    .insert({ organization_id: organizationId, title: "Venda", client_name: "Aurora", stage: "won" });
  check("ganho sem data de fechamento recusado", Boolean(openWithClose), openWithClose?.code);

  const { data: opportunity, error: opportunityError } = await db
    .from("opportunities")
    .insert({ organization_id: organizationId, title: "Venda", client_name: "Aurora", client_id: client.id })
    .select("reference")
    .single();
  check("oportunidade criada", !opportunityError, opportunityError?.message ?? opportunity.reference);

  // Vínculo com outra organização é recusado pelo gatilho que compara os dois lados.
  const { data: other } = await db
    .from("organizations")
    .insert({ name: "Outro time", slug: `${slug}-outro` })
    .select("id")
    .single();

  const { error: crossOrg } = await db
    .from("projects")
    .insert({ organization_id: other.id, slug: "invasor", name: "Invasor", client_id: client.id });
  check("cliente de outra organização recusado", Boolean(crossOrg), crossOrg?.message?.slice(0, 60));

  await db.from("organizations").delete().eq("id", other.id);

  // Automação e execução pela função com a chave secreta.
  const { data: automation, error: automationError } = await db
    .from("automations")
    .insert({ organization_id: organizationId, name: "Lembrete", nodes: [], edges: [] })
    .select("id")
    .single();
  check("automação criada", !automationError, automationError?.message);

  const { error: runError } = await db.rpc("record_automation_run", {
    p_automation_id: automation.id,
    p_mode: "event",
    p_trigger_label: "Contrato enviado",
    p_status: "ok",
    p_steps: [],
  });
  check("execução registrada", !runError, runError?.message);

  const { data: counted } = await db.from("automations").select("run_count").eq("id", automation.id).single();
  check("contador de execuções", counted?.run_count === 1, String(counted?.run_count));

  // Consumo de IA pela função com a chave secreta.
  const { data: used, error: usageError } = await db.rpc("consume_ai_credit", { p_organization_id: organizationId, p_amount: 1 });
  check("consumo de IA somado", !usageError && used === 1, usageError?.message ?? String(used));

  // O teto do plano gratuito para ações de IA veio da migração de direitos.
  const { data: limit, error: limitError } = await db.rpc("plan_limit", { p_organization_id: organizationId, p_feature_key: "ai_actions" });
  check("teto de IA do plano gratuito", !limitError && limit === 50, limitError?.message ?? String(limit));

  // Recurso que não existe derruba a chamada, de propósito.
  const { error: unknownFeature } = await db.rpc("plan_limit", { p_organization_id: organizationId, p_feature_key: "nao_existe" });
  check("recurso inexistente derruba", Boolean(unknownFeature), unknownFeature?.message?.slice(0, 50));
} finally {
  await db.from("organizations").delete().eq("id", organizationId);
}

const failed = results.filter((entry) => !entry.ok);
for (const entry of results) console.log(`${entry.ok ? "ok  " : "FALHA"} ${entry.name}${entry.detail ? ` — ${entry.detail}` : ""}`);
console.log(`\n${results.length - failed.length}/${results.length} passaram`);
process.exit(failed.length === 0 ? 0 : 1);
