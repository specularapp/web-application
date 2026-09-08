import { z } from "zod";
import { DEFAULT_PERIOD, periodValues, type DashboardPeriod } from "./period-options";

/* A lista, o nome do parâmetro e os rótulos moram em `period-options.ts`, que não carrega zod: o
   cabeçalho do painel é cliente e só precisa daquela parte. Seguem saindo daqui para quem já os
   importava deste arquivo. */
export { DEFAULT_PERIOD, PERIOD_PARAM, dashboardPeriods, periodValues, type DashboardPeriod } from "./period-options";

/** Período vindo da URL: valor fora da lista cai no padrão em vez de derrubar a página. */
export const periodSchema = z.enum(periodValues).catch(DEFAULT_PERIOD);

export function parsePeriod(value: unknown): DashboardPeriod {
  return periodSchema.parse(value);
}
