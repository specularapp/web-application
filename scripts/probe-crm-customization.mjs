import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const base = process.env.PROBE_BASE_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key || !publicKey) throw new Error("Configure as chaves do Supabase antes da prova");
const admin = createClient(url, key, { auth: { persistSession: false } });
const cookieJar = new Map([["sp-mfa-skip", "1"]]);
const client = createServerClient(url, publicKey, { cookies: {
  getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
  setAll: (cookies) => cookies.forEach(({ name, value }) => cookieJar.set(name, value)),
} });
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "OK" : "FALHA"} ${name}${detail ? `: ${detail}` : ""}`);
};
let userId;
let organizationId;
let token;
async function api(path, method = "GET", body, expected = 200) {
  const response = await fetch(`${base}/api/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  check(`${method} ${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, "registro")}`, response.status === expected, response.status === expected ? "" : `${response.status} ${data?.error ?? "Resposta inesperada"}`);
  return data;
}

try {
  const email = `auditoria-${randomUUID()}@example.com`;
  const password = `${randomUUID()}Aa1!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Auditoria temporária" } });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;
  token = login.data.session.access_token;
  const team = await api("organizacoes", "POST", { name: `Auditoria ${Date.now()}`, industry: "web_development" });
  organizationId = team?.id;
  if (!organizationId) throw new Error("A equipe temporária não foi criada");
  await api("organizacoes/atual", "PUT", { organizationId }, 204);
  const completed = await client.rpc("complete_onboarding", { p_organization_id: organizationId });
  if (completed.error) throw completed.error;


  const folder = await api("crm/pastas", "POST", { name: "Pasta de teste", hue: "purple" });
  const funnel = await api("crm/funis", "POST", { name: "Funil de teste", folderId: folder.id, glyph: "target", hue: "green" });
  await api("crm/pastas", "POST", { id: folder.id, name: "Pasta revisada", hue: "pink" });
  await api("crm/funis", "POST", { id: funnel.id, name: "Funil revisado", glyph: "handshake", hue: "orange" });
  let tree = await api("crm/funis");
  check("Cor da pasta persistida", tree[0].hue === "var(--sys-pink)");
  check("Ícone, cor e pasta do funil persistidos", tree[0].children[0].glyph === "handshake" && tree[0].children[0].hue === "var(--sys-orange)");
  await api("crm/funis", "PATCH", { id: funnel.id, stages: [{id:"lead",label:"Entrada personalizada",hue:"purple"}] });
  tree = await api("crm/funis");
  check("Etapa predefinida aceita nome e cor personalizados pela API", tree[0].children[0].stageDefinitions[0].label === "Entrada personalizada" && tree[0].children[0].stageDefinitions[0].hue === "purple");
  const stage = { id: 'open_'+randomUUID(), label: "Diagnóstico", hue: "purple" };
  const won = { id: 'won_'+randomUUID(), label: "Cliente fechado", hue: "green" };
  const lost = { id: 'lost_'+randomUUID(), label: "Sem interesse", hue: "red" };
  await api("crm/funis", "PATCH", { id: funnel.id, stages: [stage, won, lost] });
  const input = { funnelId: funnel.id, title: "", description: "", clientId: null, clientName: "Cliente de teste", clientCompany: "", contactName: "", contactEmail: "", contactPhone: "", stage: stage.id, value: 10000, temperature: "warm", probability: 50, city: "", state: "", expectedAt: "", ownerId: userId, tags: [], source: "outro", partnerCode: "", nextStepLabel: "", nextStepAt: "" };
  const opportunity = await api("crm", "POST", input);
  check("Título vazio recebe o padrão", opportunity.title === "Nova oportunidade");
  const linked = await api('crm/'+opportunity.reference);
  check("Código da oportunidade resolve a ficha", linked.id === opportunity.id);
  await api('crm/OPO-1900-999999', "GET", undefined, 404);
  check("Oportunidade usa nome da etapa personalizada", opportunity.stageLabel === stage.label);
  await api('crm/'+opportunity.id, "PATCH", { id: opportunity.id, stage: won.id });
  const paid = await client.from("opportunities").select("stage,closed_at").eq("id", opportunity.id).single();
  check("Etapa ganha persiste com fechamento", paid.data?.stage === won.id && Boolean(paid.data.closed_at));
  const edited = await api("crm", "POST", { ...input, id: opportunity.id, stage: won.id, description: "Editada na própria ficha" });
  check("Edição persiste na mesma oportunidade", edited.id === opportunity.id && edited.description === "Editada na própria ficha");
  const retained = await client.from("opportunities").select("closed_at").eq("id", opportunity.id).single();
  check("Editar campos preserva a data de fechamento", retained.data.closed_at === paid.data.closed_at);
  let counts = await client.rpc("opportunity_open_counts", { p_organization_id: organizationId });
  check("Ganha não conta como aberta", !counts.data?.some(row => row.total > 0));
  await api('crm/'+opportunity.id, "PATCH", { id: opportunity.id, stage: stage.id });
  counts = await client.rpc("opportunity_open_counts", { p_organization_id: organizationId });
  check("Retorno à etapa aberta atualiza contagem", counts.data?.[0]?.total === 1);
  await api("crm/funis", "PATCH", { id: funnel.id, stages: [won, lost] }, 400);
  const unchanged = await client.from("crm_funnels").select("stages").eq("id", funnel.id).single();
  check("Remoção sem destino não altera funil", unchanged.data?.stages.includes(stage.id));
  await api("crm/funis", "PATCH", { id: funnel.id, stages: [lost, won], replacements: { [stage.id]: lost.id } });
  const moved = await client.from("opportunities").select("stage,closed_at").eq("id", opportunity.id).single();
  check("Remoção migra oportunidades atomicamente", moved.data?.stage === lost.id && Boolean(moved.data.closed_at));
  await api("crm/funis", "PATCH", { id: funnel.id, stages: [{...lost,label:"Recusado"},won] });
  tree = await api("crm/funis");
  check("Ordem e nome persistem", tree[0].children[0].stages[0] === lost.id && tree[0].children[0].stageDefinitions[0].label === "Recusado");
  await api("crm/funis", "PATCH", { id: funnel.id, stages: [] }, 422);
  await api("crm/funis", "PATCH", { id: funnel.id, stages: [won, {...won,id:lost.id}] }, 422);
  await api("crm/funis", "POST", { id: funnel.id, name: "Funil", glyph: "invalido" }, 422);
  await api('crm/'+opportunity.id, "PATCH", { id: opportunity.id, stage: 'open_'+randomUUID() }, 400);
  const forbidden = await client.rpc("configure_funnel_stages", { p_organization_id: randomUUID(), p_funnel_id: funnel.id, p_stages: [won] });
  check("Configuração de outra equipe recusada", Boolean(forbidden.error));
  const direct = await client.from("crm_funnels").update({stages:[won.id]}).eq("id",funnel.id);
  check("Banco impede ocultar oportunidades por escrita direta", Boolean(direct.error));
  const finalRow = await client.from("opportunities").select("id").eq("id", opportunity.id).single();
  check("Oportunidade preservada", Boolean(finalRow.data));
} finally {
  if (organizationId) {
    const removed = await admin.from("organizations").delete().eq("id", organizationId);
    check("Equipe temporária removida", !removed.error, removed.error?.message);
  }
  if (userId) {
    const removed = await admin.auth.admin.deleteUser(userId);
    check("Usuário temporário removido", !removed.error, removed.error?.message);
  }
}
const failures = results.filter((result) => !result.ok);
console.log(`${results.length - failures.length}/${results.length} verificações passaram`);
process.exitCode = failures.length ? 1 : 0;
