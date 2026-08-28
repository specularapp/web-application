import type { Metadata } from "next";

const isProduction = process.env.NODE_ENV === "production";
const localUrl = "http://localhost:3000";

export const siteConfig = {
  name: "Specular",
  description:
    "Gestão completa para freelancers e agências: CRM, orçamentos, contratos, cobrança, projetos e portfólio em um só lugar",
  locale: "pt_BR",
  hosts: { app: "app.specular.com.br", site: "specular.com.br" },
  url: process.env.NEXT_PUBLIC_APP_URL ?? (isProduction ? "https://app.specular.com.br" : localUrl),
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? (isProduction ? "https://specular.com.br" : localUrl),
  themeColor: { light: "#ffffff", dark: "#000000", brand: "#007aff" },
} as const;

type PageMetadataInput = {
  title: string;
  description: string;
  path?: string;
  origin?: "app" | "site";
  noIndex?: boolean;
  absoluteTitle?: boolean;
};

export function createMetadata({
  title,
  description,
  path,
  origin = "app",
  noIndex = false,
  absoluteTitle = false,
}: PageMetadataInput): Metadata {
  const base = origin === "site" ? siteConfig.siteUrl : siteConfig.url;
  const url = path ? `${base}${path === "/" ? "" : path}` || base : undefined;

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
