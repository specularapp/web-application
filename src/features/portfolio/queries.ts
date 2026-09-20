import "server-only";
import { requireOrganization } from "@/features/organizations/context";
import { getPortfolioSettings, type PortfolioSettings } from "./service";

/** A página interna do portfólio: a lista de projetos com o interruptor de público e o endereço da vitrine. */
export async function getPortfolioPage(): Promise<PortfolioSettings | null> {
  const { supabase, organizationId } = await requireOrganization("/portfolio");
  return getPortfolioSettings(supabase, organizationId);
}
