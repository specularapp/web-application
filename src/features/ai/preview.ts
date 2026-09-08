import { addMonths, format, startOfMonth } from "date-fns";
import type { AiUsage } from "./summary";

/**
 * Uso de exemplo enquanto o domínio não existe no banco. Quem montar a contagem troca só a origem: o
 * widget recebe o uso por prop e não sabe de onde ele vem. O ciclo vira no primeiro dia do mês que vem,
 * relativo a hoje, para a data na janela nunca ficar no passado.
 */
export const previewAiUsage: AiUsage = {
  used: 128,
  limit: 500,
  renewsAt: format(startOfMonth(addMonths(new Date(), 1)), "yyyy-MM-dd"),
};
