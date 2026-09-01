import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/metadata";

// Só o acesso é indexável: o resto do aplicativo é privado e o robots.ts bloqueia.
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/login", "/cadastro"].map((path) => ({
    url: `${siteConfig.url}${path}`,
    changeFrequency: "monthly",
  }));
}
