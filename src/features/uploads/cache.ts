import { cacheTags, type DomainTag } from "@/lib/cache/tags";
import type { UploadTarget } from "./schemas";

export const uploadDomains: Record<UploadTarget, { tag: DomainTag; path: string }> = {
  "client-avatar": { tag: cacheTags.clients, path: "/clientes" },
  "client-logo": { tag: cacheTags.clients, path: "/clientes" },
  "catalog-image": { tag: cacheTags.catalog, path: "/catalogo" },
  "project-cover": { tag: cacheTags.projects, path: "/projetos" },
  "project-logo": { tag: cacheTags.projects, path: "/projetos" },
  "charge-image": { tag: cacheTags.finance, path: "/cobrancas" },
};
