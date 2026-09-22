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

  const contactInput = { kind: "both", name: "Contato da auditoria", company: "", role: "", email: "", phone: "", website: "", city: "", about: "", tags: [], active: true, favorite: false };
  const contact = await api("clientes", "POST", contactInput);
  const contactId = contact?.id;
  const pageHeaders = () => ({ Cookie: [...cookieJar].map(([name, value]) => `${name}=${value}`).join("; ") });
  await (await fetch(`${base}/clientes`, { headers: pageHeaders() })).text();
  await api("clientes", "POST", { ...contactInput, id: contactId, name: "Contato revisado" });
  const refreshedClients = await (await fetch(`${base}/clientes`, { headers: pageHeaders() })).text();
  check("Edição pela API atualiza a página em cache", refreshedClients.includes("Contato revisado"));
  const item = await api("catalogo", "POST", { kind: "service", name: "Serviço da auditoria", description: "Descrição de teste do serviço", category: "Sites", price: 10000, unit: "project", cost: null, maxDiscount: 0, supportDays: null, duration: null, revisions: null, stock: null, deliverables: [], requirements: [], tags: [], notes: "", active: true });
  const project = await api("projetos", "POST", { name: "Projeto da auditoria", url: "", description: "", clientId: contactId, ownerId: userId, memberIds: [], status: "active", isPublic: false, tags: [], tools: [], budgetMin: null, budgetMax: null, startedAt: "2026-09-20", dueAt: "", progress: 0, coverUrl: "" });
  const task = await api("tarefas", "POST", { projectId: project?.id ?? null, title: "Tarefa da auditoria", description: "", dueDate: "2026-10-20", startDate: "", estimate: null, stage: "todo", priority: "normal", ownerId: userId, tags: [], alert: "" });
  const quote = await api("orcamentos", "POST", { title: "Orçamento da auditoria", clientId: contactId, issuedAt: "2026-09-20", validUntil: "2026-10-20", lines: [{ id: randomUUID(), catalogItemId: item?.id ?? null, name: "Serviço de teste", description: "", quantity: 1, unitPrice: 10000, unit: "project", courtesy: "no" }], discount: null, installments: 1, paymentMethods: ["pix"], cashDiscount: 0, notes: "", intent: "draft" });
  const contract = await api("contratos", "POST", { source: "scratch", clientId: contactId });
  const opportunity = await api("crm", "POST", { funnelId: null, title: "Oportunidade da auditoria", description: "", clientId: contactId, clientName: "Contato revisado", clientCompany: "", contactName: "", contactEmail: "", contactPhone: "", stage: "lead", value: 10000, temperature: "warm", probability: 50, city: "", state: "", expectedAt: "", ownerId: userId, tags: [], source: "outro", partnerCode: "", nextStepLabel: "", nextStepAt: "" });
  const chargeInput = { direction: "incoming", clientId: contactId, partyName: "", title: "Cobrança da auditoria", description: "", amount: 10001, installments: 3, firstDueDate: "2026-10-31", method: "pix", paymentInfo: "", notes: "", quoteId: null, recurrence: "none" };
  const charge = await api("cobrancas", "POST", chargeInput);
  const expense = await api("despesas", "POST", { ...chargeInput, direction: "outgoing", clientId: null, partyName: "Fornecedor de teste", title: "Despesa da auditoria" });
  check("Parcelas preservam os centavos", charge?.installments?.reduce((sum, entry) => sum + entry.amount, 0) === chargeInput.amount);
  check("Despesa permanece como saída", expense?.direction === "outgoing");
  const automation = await api("automacoes", "POST", { templateId: null });
  for (const path of ["clientes", "catalogo", "projetos", "tarefas", "crm", "orcamentos", "contratos", "cobrancas", "despesas", "financeiro", "painel", "organizacoes", "organizacoes/minhas", "automacoes", "planos"]) await api(path);
  await api("despesas", "POST", { ...chargeInput, direction: "outgoing", clientId: null, partyName: "A" }, 422);
  await api("cobrancas", "POST", { ...chargeInput, firstDueDate: "2026-02-31" }, 422);
  if (expense?.id) {
    const path = `cobrancas/${expense.id}/parcelas/${expense.installments[0].id}`;
    await api(path, "POST", null, 422);
    const wrongTeam = await client.rpc("change_charge_payment", { p_organization_id: randomUUID(), p_charge_id: expense.id, p_installment_id: expense.installments[0].id, p_operation: "pay" });
    check("Baixa recusa organização sem acesso", Boolean(wrongTeam.error));
    await api(path, "POST", {});
    const transactions = await client.from("transactions").select("id, kind, amount").eq("charge_id", expense.id);
    check("Baixa de despesa registra saída", transactions.data?.length === 1 && transactions.data[0].kind === "expense" && transactions.data[0].amount === expense.installments[0].amount);
    await api(path, "POST", {}, 400);
    await api(path, "DELETE");
    const reopened = await client.from("transactions").select("id").eq("charge_id", expense.id);
    check("Reabertura remove a saída", reopened.data?.length === 0);
    const args = { p_organization_id: organizationId, p_charge_id: expense.id, p_operation: "pay", p_installment_id: expense.installments[0].id };
    const concurrent = await Promise.all([client.rpc("change_charge_payment", args), client.rpc("change_charge_payment", args)]);
    check("Duas baixas simultâneas gravam apenas uma", concurrent.filter((result) => !result.error).length === 1);
    const afterRace = await client.from("transactions").select("id").eq("charge_id", expense.id);
    check("Sem movimentação duplicada após concorrência", afterRace.data?.length === 1);
    const cancelPaid = await client.rpc("change_charge_payment", { ...args, p_operation: "cancel" });
    check("Cancelamento recusa parcelas pagas", Boolean(cancelPaid.error));
    await api(path, "DELETE");
    const cancelled = await client.rpc("change_charge_payment", { ...args, p_operation: "cancel" });
    check("Cancelamento sem parcelas pagas", !cancelled.error);
    await api(path, "POST", {}, 400);
  }
  await api("financeiro", "POST", { kind: "income", title: "Entrada avulsa de teste", description: "", amount: 5000, date: "2026-09-20", method: null });
  await api("financeiro", "POST", { kind: "expense", title: "Saída avulsa de teste", description: "", amount: 2000, date: "2026-09-20", method: "pix" });

  const pages = ["dashboard", "clientes", "clientes/novo", "catalogo", "catalogo/novo", "projetos", "projetos/novo", "tarefas", "crm", "orcamentos", "orcamentos/novo", "contratos", "contratos/novo", "cobrancas", "cobrancas/nova", "despesas", "despesas/nova", "financeiro", "automacoes", "automacoes/nova", "ia", "portfolio", "curriculo", "conquistas", "configuracoes", "configuracoes/equipe", "configuracoes/seguranca", "configuracoes/notificacoes", "configuracoes/dominio", "configuracoes/integracoes", "configuracoes/plano"];
  const projectRow = project?.id ? await client.from("projects").select("slug").eq("id", project.id).single() : null;
  if (projectRow?.data?.slug) pages.push(`tarefas/${projectRow.data.slug}`);
  pages.push("crm/sem-funil");
  for (const [prefix, record] of [["clientes", contact], ["catalogo", item], ["projetos", project], ["orcamentos", quote], ["contratos", contract], ["cobrancas", charge], ["despesas", expense], ["automacoes", automation]]) {
    if (record?.id) pages.push(`${prefix}/${record.id}`);
  }
  if (project?.id) pages.push(`projetos/${project.id}/editar`);
  if (project?.slug) pages.push(`tarefas/${project.slug}`);
  if (contract?.id) pages.push(`contratos/${contract.id}/editar`);
  for (const path of pages) {
    const response = await fetch(`${base}/${path}`, { headers: { Cookie: [...cookieJar].map(([name, value]) => `${name}=${value}`).join("; ") }, redirect: "manual", signal: AbortSignal.timeout(60_000) });
    const html = await response.text();
    // Gráficos declarados com ssr:false usam BAILOUT_TO_CLIENT_SIDE_RENDERING normalmente.
    const failed = response.status !== 200 || /:E\{"digest"|document is not defined|NEXT_HTTP_ERROR_FALLBACK/.test(html) || [...html.matchAll(/<template\b[^>]*data-msg="[^"]+"[^>]*>/g)].some(([template]) => !template.includes("BAILOUT_TO_CLIENT_SIDE_RENDERING"));
    check(`Página /${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, "registro")}`, !failed, failed ? `${response.status} ${response.headers.get("location") ?? "Erro de renderização"}` : "");
  }
  check("Tarefa persistida", Boolean(task?.id));
  check("Oportunidade persistida", Boolean(opportunity?.id));
  if (task?.id) {
    await api(`tarefas/${task.id}`, "PATCH", { id: task.id, stage: "done", position: 0 });
    const done = await api(`tarefas/${task.id}`);
    check("Mudança de etapa persiste", done?.stage === "done");
    await api(`tarefas/${task.id}`, "DELETE");
    await api(`tarefas/${task.id}`, "GET", undefined, 404);
  }
  if (project?.id) await api(`projetos/${project.id}`, "DELETE");
  if (contactId) await api(`clientes/${contactId}`, "DELETE");
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
