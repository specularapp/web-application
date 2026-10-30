/*
 * Os domínios do portfólio (2026-10-29, a pedido: "em domínios, uma interface semelhante à da Cloudflare, para o
 * cliente acessar o portfólio direto pela URL dele"): os tipos que a tela lê e a regra do registro de DNS que cada
 * domínio pede. Puro, sem servidor, porque a tela mostra as instruções e o servidor confere pelas mesmas.
 */

/** Para onde o domínio aponta: a casa roda na Vercel, então o raiz vai ao IP dela e o resto ao nome dela. */
export const DOMAIN_APEX_IP = "76.76.21.21";
export const DOMAIN_CNAME_TARGET = "cname.vercel-dns.com";

/** Quantos domínios uma equipe cadastra: o raiz, o `www` e alguma folga para campanha. */
export const MAX_DOMAINS = 5;

export type DomainRecord = { type: "A" | "CNAME"; name: string; value: string };

export type PortfolioDomain = {
  id: string;
  domain: string;
  verifiedAt: string | null;
  checkedAt: string | null;
  /** O que a última conferência achou, quando não conferiu. */
  checkError: string | null;
  createdAt: string;
  record: DomainRecord;
};

export type DomainsOverview = {
  domains: PortfolioDomain[];
  /** O endereço da casa, que sempre funciona. */
  fallbackUrl: string;
};

export type DomainStatus = "active" | "pending" | "failing";

/** Ativo quando conferiu; com erro quando a última conferência achou outra coisa; aguardando enquanto ninguém conferiu. */
export const domainStatusOf = (domain: Pick<PortfolioDomain, "verifiedAt" | "checkError">): DomainStatus => (domain.verifiedAt ? "active" : domain.checkError ? "failing" : "pending");

/* Os sufixos de dois níveis mais comuns por aqui: em `estudio.com.br` o raiz é o domínio inteiro, e não `com.br`. */
const SECOND_LEVEL = new Set(["com.br", "net.br", "org.br", "art.br", "adv.br", "arq.br", "eng.br", "blog.br", "ind.br", "inf.br", "tec.br", "app.br", "dev.br", "eco.br", "med.br", "co.uk", "com.pt", "com.ar", "com.mx"]);

/** O domínio raiz de um nome: `www.estudio.com.br` vira `estudio.com.br`. */
export function apexOf(domain: string) {
  const labels = domain.split(".");
  const size = SECOND_LEVEL.has(labels.slice(-2).join(".")) ? 3 : 2;
  return labels.slice(-size).join(".");
}

/**
 * O registro que o domínio pede no provedor de DNS: o raiz não aceita CNAME, então vai num A para o IP da casa
 * (nome `@`); um subdomínio vai num CNAME com o nome dele (`www`, `portfolio`) para o endereço da casa.
 */
export function recordOf(domain: string): DomainRecord {
  const apex = apexOf(domain);
  if (domain === apex) return { type: "A", name: "@", value: DOMAIN_APEX_IP };
  return { type: "CNAME", name: domain.slice(0, -(apex.length + 1)), value: DOMAIN_CNAME_TARGET };
}
