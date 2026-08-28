import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/precos", "/termos", "/privacidade"].map((path) => ({
    url: `${siteConfig.siteUrl}${path}`,
    changeFrequency: "monthly",
  }));
}
