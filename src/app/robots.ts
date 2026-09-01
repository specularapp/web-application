import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/mfa",
        "/primeiros-passos",
        "/convite/",
        "/dashboard",
        "/crm",
        "/clientes",
        "/orcamentos",
        "/contratos",
        "/cobrancas",
        "/projetos",
        "/portfolio",
        "/curriculo",
        "/financeiro",
        "/automacoes",
        "/ia",
        "/conquistas",
        "/configuracoes",
        "/orcamento/",
        "/contrato/",
        "/cobranca/",
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
