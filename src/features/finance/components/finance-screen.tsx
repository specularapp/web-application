import { Topbar } from "@/components/layout/topbar";
import type { CashFlowData } from "../movements";
import { CashFlowBoard } from "./cash-flow-board";
import styles from "./finance-screen.module.css";

// A página de entrada do financeiro: o topo escondido com o `h1` e, desde 2026-10-27, o fluxo de caixa da Le Ange
// no lugar da visão geral. Server Component; quem tem estado é a prancha.
export function FinanceScreen(data: CashFlowData) {
  return (
    <div className={styles.screen}>
      <Topbar />
      <CashFlowBoard {...data} />
    </div>
  );
}
