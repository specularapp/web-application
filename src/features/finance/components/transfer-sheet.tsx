import { ArrowsLeftRightIcon, XCircleIcon } from "@phosphor-icons/react";
import { formatMoney } from "@/lib/utils/format";
import { accountDigits, type FinanceAccount } from "../accounts";
import { AccountMark } from "./account-mark";
import { dateBr } from "./money";
import styles from "./transfer-sheet.module.css";

/** O que a folha da transferência mostra. Sem `reference`, é a prévia de uma transferência que ainda vai ser feita. */
export type TransferDraft = {
  reference: string | null;
  date: string;
  amount: number;
  note: string;
  from: FinanceAccount | null;
  to: FinanceAccount | null;
  /** Na prévia: com quanto cada conta fica depois. */
  after?: { from: number; to: number } | null;
  undone?: boolean;
};

/** Uma das pontas no bloco de baixo: a marca, o nome e o número, ou com quanto a conta fica. */
function Side({ label, account, after }: { label: string; account: FinanceAccount | null; after: number | null }) {
  if (!account) {
    return (
      <div className={styles.side}>
        <span>{label}</span>
        <strong>Escolha a conta</strong>
      </div>
    );
  }
  const digits = accountDigits(account);
  return (
    <div className={styles.side}>
      <span>{label}</span>
      <strong>
        <AccountMark account={account} />
        <span className={styles.sideName}>{account.name}</span>
      </strong>
      {after !== null ? <small data-after="">Fica com {formatMoney(after)}</small> : digits && <small>{digits}</small>}
    </div>
  );
}

/**
 * O comprovante da transferência (2026-10-27, da Le Ange, no jeito de um recibo): o selo com as setas, quando e o
 * código, o corte tracejado, o valor em destaque e as duas contas lado a lado. Na prévia, cada conta mostra com
 * quanto fica depois. A mesma folha serve ao comprovante e à prévia.
 */
export function TransferSheet({ draft, flat = false }: { draft: TransferDraft; flat?: boolean }) {
  const Seal = draft.undone ? XCircleIcon : ArrowsLeftRightIcon;
  return (
    <article className={styles.sheet} data-undone={draft.undone || undefined} data-flat={flat || undefined} aria-label={draft.reference ? `Transferência ${draft.reference}` : "Prévia da transferência"}>
      <header className={styles.top}>
        <span className={styles.seal} aria-hidden="true">
          <Seal weight={draft.undone ? "fill" : "bold"} />
        </span>
        <strong>{draft.undone ? "Transferência desfeita" : draft.reference ? "Transferência feita" : "Transferência"}</strong>
        <span>{draft.undone ? "O dinheiro voltou para a conta de onde saiu." : "O dinheiro muda de conta, sem entrar nem sair da empresa."}</span>
      </header>

      <dl className={styles.rows}>
        <div>
          <dt>Transferência</dt>
          <dd>{draft.reference ?? "A gerar"}</dd>
        </div>
        <div>
          <dt>Data</dt>
          <dd>{dateBr(draft.date)}</dd>
        </div>
      </dl>

      {/* O corte do comprovante: a linha tracejada com um recorte de cada lado */}
      <hr className={styles.cut} />

      <dl className={styles.rows}>
        {draft.note.trim() && (
          <div>
            <dt>Motivo</dt>
            <dd>{draft.note.trim()}</dd>
          </div>
        )}
        <div className={styles.total}>
          <dt>Valor transferido</dt>
          <dd>{formatMoney(draft.amount)}</dd>
        </div>
      </dl>

      <div className={styles.sides}>
        <Side label="De" account={draft.from} after={draft.after ? draft.after.from : null} />
        <Side label="Para" account={draft.to} after={draft.after ? draft.after.to : null} />
      </div>
    </article>
  );
}
