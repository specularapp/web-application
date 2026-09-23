import type { Icon } from "@phosphor-icons/react";
import { BankIcon, BarcodeIcon, CheckIcon, ClockIcon, CreditCardIcon, PixLogoIcon, XIcon } from "@phosphor-icons/react/ssr";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { rounded } from "@/lib/corners";
import { formatMoney } from "@/lib/utils/format";
import { chargeDirections, transactionKinds } from "../labels";
import { statusOf, type PaymentMethod, type Transaction, type TransactionKind, type TransactionStatus } from "../summary";
import { TransactionParty } from "./transaction-party";
import styles from "./transaction-receipt.module.css";

export type TransactionReceiptProps = { transaction: Transaction };

const statusMeta: Record<TransactionStatus, { label: string; tone: BadgeTone; icon: Icon }> = {
  confirmed: { label: "Confirmada", tone: "success", icon: CheckIcon },
  pending: { label: "Aguardando", tone: "warning", icon: ClockIcon },
  cancelled: { label: "Cancelada", tone: "danger", icon: XIcon },
};

/* O título do recibo cruza tipo e situação: o que aconteceu, dito em uma linha.

   A previsão fala em "movimentação", e não em recebimento (2026-09-22, na varredura): a lista de parcelas que
   virá aqui mistura as duas pontas, então a parcela de uma despesa também abre este recibo, e dizer
   "Recebimento previsto" no aluguel que a equipe paga afirma o lado errado. Para o recibo poder dizer
   "Pagamento previsto", a `Transaction` precisa carregar a direção da parcela, o que fica em `summary.ts`. */
const titles: Record<TransactionKind, Record<TransactionStatus, string>> = {
  income: { confirmed: "Recebimento confirmado", pending: "Recebimento aguardando", cancelled: "Recebimento cancelado" },
  expense: { confirmed: "Pagamento realizado", pending: "Pagamento agendado", cancelled: "Pagamento cancelado" },
  scheduled: { confirmed: "Movimentação confirmada", pending: "Movimentação prevista", cancelled: "Movimentação cancelada" },
};

/* Quem está do outro lado troca de nome conforme o lado (2026-09-22, na varredura): a mesma foto é cliente no
   que entra e fornecedor no que sai, e o rótulo fixo "Cliente" escrevia "Categoria: Cliente" no recibo de toda
   despesa, inclusive na baixa do aluguel do fornecedor. Na previsão o lado ainda não se sabe, porque a lista de
   parcelas mistura as duas pontas e a `Transaction` não carrega a direção, então ali o texto é neutro. */
const personLabels: Record<TransactionKind, string> = {
  income: chargeDirections.incoming.partyLabel,
  expense: chargeDirections.outgoing.partyLabel,
  scheduled: "Contraparte",
};

function categoryOf(transaction: Transaction) {
  if (!transaction.visual) return "Conta";
  return transaction.visual.type === "person" ? personLabels[transaction.kind] : "Assinatura de serviço";
}

const methodIcons: Record<PaymentMethod["type"], Icon> = {
  pix: PixLogoIcon,
  card: CreditCardIcon,
  boleto: BarcodeIcon,
  transfer: BankIcon,
};

function whenOf(transaction: Transaction) {
  const date = parseISO(transaction.time ? `${transaction.date}T${transaction.time}` : transaction.date);
  const day = format(date, "d MMM. yyyy", { locale: ptBR });
  return transaction.time ? `${day}, ${format(date, "HH:mm")}` : day;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.row}>
      <Text as="dt" variant="footnote" tone="secondary">
        {label}
      </Text>
      <dd className={styles.value}>{children}</dd>
    </div>
  );
}

// O recibo de uma movimentação, na pegada da referência: em cima quem está do outro lado com o selo da
// situação na quina, o que aconteceu em uma linha e do que se trata; depois identificador e data e hora;
// a linha tracejada de recibo; categoria, valor com o sinal de `transactionKinds`, o mesmo da linha que abriu
// o recibo (e portanto neutro na previsão, que pode ser dos dois lados), e situação; e, no fim, a forma de pagamento
// num cartão. É Server Component: quem abre é a linha do bloco, que passa o recibo pronto à janela.
export function TransactionReceipt({ transaction }: TransactionReceiptProps) {
  const status = statusOf(transaction);
  const meta = statusMeta[status];
  const Method = transaction.method ? methodIcons[transaction.method.type] : null;

  return (
    <div className={styles.receipt} data-status={status}>
      <div className={styles.hero}>
        <span className={styles.figure}>
          <TransactionParty transaction={transaction} size="lg" />
          <span className={styles.seal} aria-hidden="true">
            <meta.icon weight="bold" />
          </span>
        </span>
        <Text as="h2" variant="headline" weight="semibold" align="center">
          {titles[transaction.kind][status]}
        </Text>
        <Text variant="footnote" tone="secondary" align="center">
          {transaction.title}
        </Text>
      </div>

      <dl className={styles.rows}>
        <Row label="Identificador">
          <Text as="span" variant="footnote" weight="medium">
            {transaction.reference}
          </Text>
        </Row>
        <Row label="Data e hora">
          <Text as="span" variant="footnote" weight="medium">
            {whenOf(transaction)}
          </Text>
        </Row>
      </dl>

      <hr className={styles.tear} />

      <dl className={styles.rows}>
        <Row label="Categoria">
          <Text as="span" variant="footnote" weight="medium">
            {categoryOf(transaction)}
          </Text>
        </Row>
        <Row label="Descrição">
          <Text as="span" variant="footnote" weight="medium" align="end">
            {transaction.description}
          </Text>
        </Row>
        <Row label="Valor">
          <Text as="span" variant="subheadline" weight="semibold">
            {transactionKinds[transaction.kind].sign}
            {formatMoney(transaction.amount)}
          </Text>
        </Row>
        <Row label="Situação">
          <Badge tone={meta.tone} size="sm" icon={<meta.icon />}>
            {meta.label}
          </Badge>
        </Row>
      </dl>

      {transaction.method && Method && (
        <div className={styles.method} {...rounded("md", { clip: true })}>
          <Text variant="caption1" tone="secondary">
            Forma de pagamento
          </Text>
          <span className={styles.methodLine}>
            <span className={styles.methodIcon} aria-hidden="true">
              <Method weight="bold" />
            </span>
            <Text as="span" variant="footnote" weight="medium">
              {transaction.method.label}
            </Text>
          </span>
        </div>
      )}
    </div>
  );
}
