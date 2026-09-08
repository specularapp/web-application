import type { ListboxOption } from "@/components/ui/listbox";

/**
 * O lado leve do período do painel: o nome do parâmetro, os valores, os rótulos e a lista pronta para o
 * menu de opções.
 *
 * Está separado de `period.ts` por peso (varredura de 2026-09-08): o cabeçalho do painel é componente de
 * cliente e só precisa da lista e do nome do parâmetro, mas ao importá-los de `period.ts` levava junto o
 * zod que valida o valor vindo da URL, 63 KB comprimidos, para toda visita ao painel. A validação
 * continua onde sempre esteve, no servidor, porque parâmetro de URL é entrada de usuário.
 */

export const PERIOD_PARAM = "periodo";

export const periodValues = ["hoje", "semana", "mes", "trimestre", "ano"] as const;

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
