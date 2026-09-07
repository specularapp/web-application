import type { Icon } from "@phosphor-icons/react";
import { BankIcon, BarcodeIcon, CheckIcon, ClockIcon, CreditCardIcon, PixLogoIcon, XIcon } from "@phosphor-icons/react/ssr";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { squircle } from "@/lib/corners";
import { formatMoney } from "@/lib/utils/format";
import { statusOf, type PaymentMethod, type Transaction, type TransactionKind, type TransactionStatus } from "../summary";
import { TransactionParty } from "./transaction-party";
import styles from "./transaction-receipt.module.css";

export type TransactionReceiptProps = { transaction: Transaction };

const statusMeta: Record<TransactionStatus, { label: string; tone: BadgeTone; icon: Icon }> = {
  confirmed: { label: "Confirmada", tone: "success", icon: CheckIcon },
  pending: { label: "Aguardando", tone: "warning", icon: ClockIcon },
  cancelled: { label: "Cancelada", tone: "danger", icon: XIcon },
};

/* O título do recibo cruza tipo e situação: o que aconteceu, dito em uma linha. */
const titles: Record<TransactionKind, Record<TransactionStatus, string>> = {
  income: { confirmed: "Recebimento confirmado", pending: "Recebimento aguardando", cancelled: "Recebimento cancelado" },
  expense: { confirmed: "Pagamento realizado", pending: "Pagamento agendado", cancelled: "Pagamento cancelado" },
  scheduled: { confirmed: "Recebimento confirmado", pending: "Recebimento previsto", cancelled: "Recebimento cancelado" },
};

const categories: Record<NonNullable<Transaction["visual"]>["type"] | "none", string> = {
  person: "Cliente",
  brand: "Assinatura de serviço",
  none: "Conta",
};

const methodIcons: Record<PaymentMethod["type"], Icon> = {
  pix: PixLogoIcon,
  card: CreditCardIcon,
  boleto: BarcodeIcon,
  transfer: BankIcon,
};

const signs: Record<TransactionKind, string> = { income: "+", expense: "-", scheduled: "+" };

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
// a linha tracejada de recibo; categoria, valor com sinal (sempre neutro, como na lista) e situação; e, no fim, a forma de pagamento
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
            {categories[transaction.visual?.type ?? "none"]}
          </Text>
        </Row>
        <Row label="Descrição">
          <Text as="span" variant="footnote" weight="medium" align="end">
            {transaction.description}
          </Text>
        </Row>
        <Row label="Valor">
          <Text as="span" variant="subheadline" weight="semibold">
            {signs[transaction.kind]}
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
        <div className={styles.method} {...squircle("md", { clip: true })}>
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
