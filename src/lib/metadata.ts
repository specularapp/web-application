import type { Metadata } from "next";

const isProduction = process.env.NODE_ENV === "production";
const localUrl = "http://localhost:3000";
const productionUrl = "https://app.specular.com.br";

/** Endereço da máquina de quem desenvolve: nunca vale como endereço do site em produção. */
const isLocal = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(url);

/**
 * O endereço do site, de onde saem os links compartilhados (o do orçamento, o do convite), os retornos do
 * login e os metadados. Em produção o valor configurado só vale se não for local: o `.env` de
 * desenvolvimento traz `http://localhost:3000`, e um build feito com ele presente gravava esse endereço
 * dentro do pacote, então em produção todo link e todo retorno de login caíam no localhost (relato de
 * 2026-09-10). Sem valor bom, entra o endereço que a Vercel dá ao deploy (o de produção, ou o do preview),
 * e por último o domínio do produto. Em desenvolvimento vale o configurado ou o local.
 */
function resolveSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (!isProduction) return configured ?? localUrl;
  if (configured && !isLocal(configured)) return configured.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : productionUrl;
}

export const siteConfig = {
  name: "Specular",
  description:
    "Gestão completa para freelancers e agências: CRM, orçamentos, contratos, cobrança, projetos e portfólio em um só lugar",
  locale: "pt_BR",
  hosts: { app: "app.specular.com.br" },
  url: resolveSiteUrl(),
  themeColor: { light: "#ffffff", dark: "#000000", brand: "#007aff" },
} as const;

type PageMetadataInput = {
  title: string;
  description: string;
  path?: string;
  noIndex?: boolean;
  absoluteTitle?: boolean;
};

export function createMetadata({
  title,
  description,
  path,
  noIndex = false,
  absoluteTitle = false,
}: PageMetadataInput): Metadata {
  const url = path ? `${siteConfig.url}${path === "/" ? "" : path}` || siteConfig.url : undefined;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    ...(url && { alternates: { canonical: url } }),
    openGraph: {
      title,
      description,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: "website",
      ...(url && { url }),
    },
    twitter: { card: "summary_large_image", title, description },
    ...(noIndex && { robots: { index: false, follow: false } }),
  };
}
