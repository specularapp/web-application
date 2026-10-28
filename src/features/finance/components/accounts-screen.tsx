import { Topbar } from "@/components/layout/topbar";
import type { AccountsScreenData, TransfersScreenData } from "../accounts";
import type { InstallmentsScreenData } from "../installments";
import type { MovementsScreenData } from "../movements";
import { AccountsBoard } from "./accounts-board";
import { InstallmentsBoard } from "./installments-board";
import { MovementsBoard } from "./movements-board";
import { TransfersBoard } from "./transfers-board";
import styles from "./finance-screen.module.css";

// As telas de contas bancárias, transferências e contas a receber e a pagar (2026-10-27): o topo escondido com o `h1` e a prancha, na
// moldura das outras telas do financeiro. Server Components; quem tem estado são as pranchas.
export function AccountsScreen(data: AccountsScreenData) {
  return (
    <div className={styles.screen}>
      <Topbar />
      <AccountsBoard {...data} />
    </div>
  );
}

export function TransfersScreen(data: TransfersScreenData) {
  return (
    <div className={styles.screen}>
      <Topbar />
      <TransfersBoard {...data} />
    </div>
  );
}

export function InstallmentsScreen(data: InstallmentsScreenData) {
  return (
    <div className={styles.screen}>
      <Topbar />
      <InstallmentsBoard {...data} />
    </div>
  );
}

export function MovementsScreen(data: MovementsScreenData) {
  return (
    <div className={styles.screen}>
      <Topbar />
      <MovementsBoard {...data} />
    </div>
  );
}
