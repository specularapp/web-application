import { SealCheckIcon, XCircleIcon } from "@phosphor-icons/react";
import { formatMoney } from "@/lib/utils/format";
import { accountDigits, type FinanceAccount } from "../accounts";
import { chargeMethods } from "../labels";
import type { ChargeDirection, ChargeMethod } from "../summary";
import { AccountMark } from "./account-mark";
import { dateBr } from "./money";
import styles from "./payment-sheet.module.css";

export type PaymentDraft = {
  direction: ChargeDirection;
  party: string;
  description: string;
  /** O número da cobrança ou da despesa ("COB-2026-0001"), quando a baixa veio de uma. */
  reference?: string;
  /** A linha "Parcela", na baixa de cobrança; o lançamento avulso não tem. */
  installment?: string;
  amount: number;
  /** Nula no lançamento sem forma definida. */
  method: ChargeMethod | null;
  date: string;
  account: FinanceAccount | null;
  /** Estornada: o selo vermelho e o aviso de que não vale mais. */
  reversed?: boolean;
};

/* As palavras de cada lado: o recibo de quem pagou, ou o comprovante da conta paga. */
const wording = {
  incoming: { title: "Pagamento recebido", party: "Recebido de", account: "Conta de entrada", reference: "Cobrança" },
  outgoing: { title: "Conta paga", party: "Pago a", account: "Conta de saída", reference: "Despesa" },
};

/**
 * O recibo da baixa como um ticket (2026-10-27, a pedido: "faça a prévia da direita parecer um ticket bonitinho"):
 * papel claro nos dois temas, a faixa de cima no tom do lado (verde no que entra, laranja no que sai, vermelho no
 * estornado) com o selo, o valor e o dia, o picote com os recortes nas laterais, os dados embaixo e a borda
 * serrilhada no pé. Quem monta põe o ticket num palco (`ticketStage`), que é o fundo que os recortes mostram.
 */
export function PaymentSheet({ draft }: { draft: PaymentDraft }) {
  const words = wording[draft.direction];
  const method = draft.method ? chargeMethods[draft.method] : null;
  const digits = draft.account ? accountDigits(draft.account) : "";
  const tone = draft.reversed ? "reversed" : draft.direction === "outgoing" ? "out" : "in";
  return (
    <article className={styles.ticket} data-scheme="light" data-tone={tone} aria-label="Recibo">
      <header className={styles.top}>
        <span className={styles.seal} aria-hidden="true">
          {draft.reversed ? <XCircleIcon weight="fill" /> : <SealCheckIcon weight="fill" />}
        </span>
        <span className={styles.title}>{draft.reversed ? "Movimentação estornada" : words.title}</span>
        <strong className={styles.amount}>{formatMoney(draft.amount)}</strong>
        <span className={styles.date}>{draft.reversed ? "Este recibo não vale mais" : dateBr(draft.date)}</span>
      </header>

      <div className={styles.body}>
        <dl className={styles.rows}>
          <div>
            <dt>{words.party}</dt>
            <dd>{draft.party}</dd>
          </div>
          <div>
            <dt>Referente a</dt>
            <dd>{draft.description}</dd>
          </div>
          {draft.reference && (
            <div>
              <dt>{words.reference}</dt>
              <dd className={styles.code}>{draft.reference}</dd>
            </div>
          )}
          {draft.installment && (
            <div>
              <dt>Parcela</dt>
              <dd>{draft.installment}</dd>
            </div>
          )}
        </dl>

        <div className={styles.how}>
          <div>
            <span>Forma</span>
            <strong>
              {method && <method.icon aria-hidden="true" />}
              <span className={styles.ellipsis}>{method?.label ?? "Não informada"}</span>
            </strong>
          </div>
          <div>
            <span>{words.account}</span>
            {draft.account ? (
              <strong>
                <AccountMark account={draft.account} />
                <span className={styles.ellipsis}>{draft.account.name}</span>
              </strong>
            ) : (
              <strong>Escolha a conta</strong>
            )}
            {digits && <small>{digits}</small>}
          </div>
        </div>
      </div>
    </article>
  );
}
