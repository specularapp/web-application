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
        "/convite/",
        "/dashboard",
        "/crm",
        "/clientes",
        "/orcamentos",
        "/contratos",
        "/cobrancas",
        "/projetos",
        "/tarefas",
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
        "/acompanhar/",
        "/formulario/",
        "/avaliacao/",
        "/aprovacao/",
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
