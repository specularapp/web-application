import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { FinanceOverview } from "../summary";
import { FinanceOverviewBoard } from "./finance-overview";
import styles from "./finance-screen.module.css";

export type FinanceScreenProps = {
  overview: FinanceOverview;
  ai: AiUsage;
};

// A visão geral do financeiro: o topo padrão da aplicação com o `h1`, e abaixo a prancha com o caixa, os
// números do período, o gráfico, o que vence e as movimentações. Server Component, na mesma moldura das
// outras telas; quem tem estado é a prancha.
export function FinanceScreen({ overview, ai }: FinanceScreenProps) {
  return (
    <div className={styles.screen}>
      <Topbar ai={ai} />
      <FinanceOverviewBoard overview={overview} />
    </div>
  );
}
