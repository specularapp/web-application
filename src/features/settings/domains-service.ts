import "server-only";
import { promises as dns } from "node:dns";
import { dbMessage } from "@/lib/db/message";
import { siteConfig } from "@/lib/metadata";
import { DOMAIN_APEX_IP, DOMAIN_CNAME_TARGET, MAX_DOMAINS, recordOf, type DomainsOverview, type PortfolioDomain } from "./domains";
import type { ServiceResult, SettingsClient } from "./service";
import { attachVercelDomain, detachVercelDomain } from "./vercel-domains";

const SAVE_FAILED = "Não foi possível salvar. Tente de novo em instantes.";

const COLUMNS = "id, domain, verified_at, checked_at, check_error, created_at";

type DomainRow = { id: string; domain: string; verified_at: string | null; checked_at: string | null; check_error: string | null; created_at: string };

const toDomain = (row: DomainRow): PortfolioDomain => ({
  id: row.id,
  domain: row.domain,
  verifiedAt: row.verified_at,
  checkedAt: row.checked_at,
  checkError: row.check_error,
  createdAt: row.created_at,
  record: recordOf(row.domain),
});

/** Os domínios da equipe, do mais antigo ao mais novo, com o endereço da casa que sempre funciona. */
export async function listPortfolioDomains(client: SettingsClient, organizationId: string): Promise<DomainsOverview | null> {
  const [{ data: organization }, { data: rows }] = await Promise.all([
    client.from("organizations").select("slug").eq("id", organizationId).maybeSingle(),
    client.from("organization_domains").select(COLUMNS).eq("organization_id", organizationId).order("created_at"),
  ]);
  if (!organization) return null;
  return { domains: (rows ?? []).map(toDomain), fallbackUrl: `${siteConfig.url}/p/${organization.slug}` };
}

/**
 * Cadastra um domínio: no banco, e no projeto da Vercel quando a casa tem a chave dela. Se a Vercel recusar, a
 * linha sai de novo, para a lista não mostrar um domínio que nunca vai chegar até a casa.
 */
export async function addPortfolioDomain(client: SettingsClient, organizationId: string, userId: string, domain: string): Promise<ServiceResult<PortfolioDomain>> {
  const { count } = await client.from("organization_domains").select("id", { count: "exact", head: true }).eq("organization_id", organizationId);
  if ((count ?? 0) >= MAX_DOMAINS) return { ok: false, error: `Cada equipe cadastra até ${MAX_DOMAINS} domínios. Tire um para cadastrar outro.` };

  const { data, error } = await client.from("organization_domains").insert({ organization_id: organizationId, domain, created_by: userId }).select(COLUMNS).single();
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "Esse domínio já está cadastrado aqui ou em outra equipe." };
    return { ok: false, error: error ? dbMessage(error, SAVE_FAILED) : SAVE_FAILED };
  }

  const attached = await attachVercelDomain(domain);
  if (!attached.ok) {
    await client.from("organization_domains").delete().eq("id", data.id).eq("organization_id", organizationId);
    return attached;
  }

  return { ok: true, data: toDomain(data) };
}

/** Tira o domínio da lista e da Vercel. Dali em diante o endereço não serve mais o portfólio. */
export async function removePortfolioDomain(client: SettingsClient, organizationId: string, id: string): Promise<ServiceResult<{ id: string }>> {
  const { data, error } = await client.from("organization_domains").delete().eq("id", id).eq("organization_id", organizationId).select("domain").maybeSingle();
  if (error) return { ok: false, error: dbMessage(error, SAVE_FAILED) };
  if (!data) return { ok: false, error: "Esse domínio já não está na lista." };
  await detachVercelDomain(data.domain);
  return { ok: true, data: { id } };
}

const clean = (host: string) => host.replace(/\.$/, "").toLowerCase();

async function resolve<T>(lookup: () => Promise<T[]>): Promise<T[]> {
  try {
    return await lookup();
  } catch {
    return [];
  }
}

/**
 * O que o DNS diz do domínio, em palavras, ou nulo quando ele aponta para a casa. Aceita o registro pedido (o A
 * para o IP da Vercel no raiz, o CNAME para o nome dela no subdomínio) e também o que leva ao mesmo lugar por
 * outro caminho: um CNAME para o endereço do aplicativo, ou um proxy (como o da Cloudflare) que achata o CNAME e
 * responde com os IPs da casa.
 */
async function dnsProblem(domain: string): Promise<string | null> {
  const record = recordOf(domain);
  const [cnames, addresses, houseAddresses] = await Promise.all([
    record.type === "CNAME" ? resolve(() => dns.resolveCname(domain)) : Promise.resolve([]),
    resolve(() => dns.resolve4(domain)),
    resolve(() => dns.resolve4(siteConfig.hosts.app)),
  ]);

  const targets = new Set([DOMAIN_CNAME_TARGET, siteConfig.hosts.app]);
  if (cnames.some((name) => targets.has(clean(name)))) return null;
  if (addresses.some((address) => address === DOMAIN_APEX_IP || houseAddresses.includes(address))) return null;

  if (cnames.length > 0) return `O CNAME aponta para ${cnames.map(clean).join(", ")}, e precisa apontar para ${DOMAIN_CNAME_TARGET}.`;
  if (addresses.length > 0) return `O domínio aponta para ${addresses.join(", ")}, e precisa apontar para ${record.type === "A" ? DOMAIN_APEX_IP : DOMAIN_CNAME_TARGET}.`;
  return "Ainda não achamos o registro no DNS. A propagação pode levar até 24 horas.";
}

/**
 * Confere o DNS do domínio no servidor, porque é a conferência que libera o portfólio naquele endereço, e guarda
 * o que achou: conferido, ou o motivo de ainda não conferir. Um domínio já conferido que deixou de apontar volta
 * a aguardar, para não servir o portfólio de quem não tem mais o endereço.
 */
export async function verifyPortfolioDomain(client: SettingsClient, organizationId: string, id: string): Promise<ServiceResult<PortfolioDomain>> {
  const { data: current } = await client.from("organization_domains").select("domain").eq("id", id).eq("organization_id", organizationId).maybeSingle();
  if (!current) return { ok: false, error: "Esse domínio não está mais na lista." };

  const problem = await dnsProblem(current.domain);
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("organization_domains")
    .update(problem ? { verified_at: null, checked_at: now, check_error: problem } : { verified_at: now, checked_at: now, check_error: null })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select(COLUMNS)
    .single();

  if (error || !data) return { ok: false, error: error ? dbMessage(error, SAVE_FAILED) : SAVE_FAILED };
  return { ok: true, data: toDomain(data) };
}
