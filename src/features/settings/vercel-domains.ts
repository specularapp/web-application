import "server-only";

/*
 * Os domínios no projeto da Vercel (2026-10-29): a casa roda lá, e um domínio só chega até ela, com certificado,
 * depois de ser adicionado ao projeto. Com `VERCEL_API_TOKEN` e `VERCEL_PROJECT_ID` no ambiente (e
 * `VERCEL_TEAM_ID` quando o projeto é de um time), cadastrar e tirar um domínio na tela faz o mesmo na Vercel.
 * Sem eles, a lista funciona igual e o domínio precisa ser adicionado à mão no painel da Vercel.
 */

const API = "https://api.vercel.com";

function settings() {
  const token = process.env.VERCEL_API_TOKEN;
  const project = process.env.VERCEL_PROJECT_ID;
  if (!token || !project) return null;
  return { token, project, team: process.env.VERCEL_TEAM_ID };
}

export const vercelDomainsEnabled = () => settings() !== null;

async function call(path: string, method: "POST" | "DELETE", body?: unknown) {
  const config = settings();
  if (!config) return null;
  const query = config.team ? `?teamId=${encodeURIComponent(config.team)}` : "";
  return fetch(`${API}${path.replace(":project", encodeURIComponent(config.project))}${query}`, {
    method,
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
}

/** Adiciona o domínio ao projeto. Já estar no projeto conta como sucesso; estar em outro projeto, não. */
export async function attachVercelDomain(domain: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await call("/v10/projects/:project/domains", "POST", { name: domain });
    if (!response || response.ok) return { ok: true };
    const payload = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
    const code = payload?.error?.code ?? "";
    if (code === "domain_already_in_use_by_project" || code === "domain_already_exists") return { ok: true };
    if (code === "domain_already_in_use") return { ok: false, error: "Esse domínio já está ligado a outro site. Tire ele de lá antes de cadastrar aqui." };
    if (code === "invalid_domain") return { ok: false, error: "Esse domínio não é válido." };
    return { ok: false, error: "Não deu para ligar o domínio à hospedagem agora. Tente de novo em instantes." };
  } catch {
    return { ok: false, error: "Não deu para ligar o domínio à hospedagem agora. Tente de novo em instantes." };
  }
}

/** Tira o domínio do projeto. Falhar aqui não impede tirar da lista: o domínio sem dono na casa não serve nada. */
export async function detachVercelDomain(domain: string) {
  try {
    await call(`/v9/projects/:project/domains/${encodeURIComponent(domain)}`, "DELETE");
  } catch {
    // O domínio já não serve portfólio nenhum sem a linha no banco; a limpeza na Vercel pode esperar.
  }
}
