import { z } from "zod";
import type { ListboxOption } from "@/components/ui/listbox";

export const PERIOD_PARAM = "periodo";

const periodValues = ["hoje", "semana", "mes", "trimestre", "ano"] as const;

export type DashboardPeriod = (typeof periodValues)[number];

export const DEFAULT_PERIOD: DashboardPeriod = "mes";

const periodLabels: Record<DashboardPeriod, string> = {
  hoje: "Hoje",
  semana: "Esta semana",
  mes: "Este mês",
  trimestre: "Este trimestre",
  ano: "Este ano",
};

export const dashboardPeriods: ListboxOption<DashboardPeriod>[] = periodValues.map((value) => ({
  value,
  label: periodLabels[value],
}));

/** Período vindo da URL: valor fora da lista cai no padrão em vez de derrubar a página. */
export const periodSchema = z.enum(periodValues).catch(DEFAULT_PERIOD);

export function parsePeriod(value: unknown): DashboardPeriod {
  return periodSchema.parse(value);
}
