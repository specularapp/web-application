import "server-only";
import { getShellData } from "@/features/organizations/shell-data";
import type { AiUsage } from "./summary";

/**
 * O uso do ciclo que o widget do topo mostra em toda tela. Sai da mesma leitura da concha, que já está
 * guardada em Redis: pedir de novo por página seriam duas idas ao banco a cada navegação para mostrar o
 * mesmo número que o menu ao lado já sabe.
 */
export async function getAiUsageData(): Promise<AiUsage> {
  const shell = await getShellData();
  return shell.ai;
}
