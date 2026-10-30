import { redirect } from "next/navigation";

/* As integrações viraram duas páginas (2026-10-29): webhooks e API. O endereço antigo leva à primeira, para link
   salvo e favorito continuarem chegando. */
export default function IntegrationsPage() {
  redirect("/configuracoes/integracoes/webhooks");
}
