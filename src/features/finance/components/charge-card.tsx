"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { formatMoney } from "@/lib/utils/format";
import { chargeDirections, chargeMethods, chargeStatuses, dueLabel, dueTone, installmentLabel, partyOf, shortDate } from "../labels";
import { chargeSettled, chargeStatusOf, nextInstallment, type Charge } from "../summary";
import { ChargeMenu, type ChargeMenuActions } from "./charge-menu";
import styles from "./charge-card.module.css";

export type ChargeCardProps = ChargeMenuActions & {
  charge: Charge;
  onOpen: () => void;
};

const INTERACTIVE = "button, a, input, label, [role='button'], [role='menuitem']";

// O cartão da cobrança (2026-09-15, nos padrões dos cartões da casa): a situação e o leque em cima; o título
// e o identificador; quem paga, com o rosto; o valor total com as parcelas e a forma; a barra do que já
// entrou; e no pé a próxima parcela com o vencimento em palavras, ou quando fechou. O cartão inteiro abre a
// ficha; o leque tem ação própria.
export function ChargeCard({ charge, onOpen, ...actions }: ChargeCardProps) {
  const status = chargeStatuses[chargeStatusOf(charge)];
  const side = chargeDirections[charge.direction];
  const payer = partyOf(charge);
  const received = chargeSettled(charge);
  const next = nextInstallment(charge);
  const method = chargeMethods[charge.method];
  const paidCount = charge.installments.filter((installment) => installment.paidAt).length;
  const lastPaid = [...charge.installments].filter((installment) => installment.paidAt).sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""))[0];

  const onClick = (event: MouseEvent<HTMLElement>) => {
    const control = (event.target as HTMLElement).closest(INTERACTIVE);
    if (control && control !== event.currentTarget) return;
    onOpen();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <article className={styles.card} data-status={chargeStatusOf(charge)}>
      <div className={styles.inner} role="button" tabIndex={0} aria-label={`Abrir a cobrança ${charge.reference}`} onClick={onClick} onKeyDown={onKeyDown}>
        <header className={styles.head}>
          {/* O lado antes da situação: "em aberto" quer dizer coisas opostas conforme o dinheiro entre ou
              saia, e é o glifo com a cor que resolve isso de relance. */}
          <Badge tone={side.tone} variant="soft" size="sm" icon={<side.icon />}>
            {side.label}
          </Badge>
          <Badge tone={status.tone} size="sm" icon={<status.icon />}>
            {status.label}
          </Badge>
          <ChargeMenu charge={charge} {...actions} />
        </header>

        <div className={styles.copy}>
          <Text as="h3" variant="headline" weight="semibold" className={styles.title}>
            {charge.title}
          </Text>
          <Text as="p" variant="caption1" tone="secondary" numeric>
            {charge.reference}
          </Text>
        </div>

        <div className={styles.client}>
          <Avatar name={payer.name} src={payer.avatarUrl ?? undefined} size="sm" shape="squircle" />
          <span className={styles.clientCopy}>
            <Text as="span" variant="footnote" weight="medium" truncate>
              {payer.company ?? payer.name}
            </Text>
            <Text as="span" variant="caption1" tone="secondary" truncate>
              {payer.company ? payer.name : (payer.email ?? (payer.standalone ? "Cobrança avulsa" : "Sem e-mail"))}
            </Text>
          </span>
        </div>

        <div className={styles.amount}>
          <Text as="span" variant="title3" weight="semibold" numeric>
            {formatMoney(charge.amount)}
          </Text>
          <Text as="span" variant="caption1" tone="secondary" className={styles.terms}>
            <method.icon aria-hidden="true" />
            {charge.installments.length > 1 ? `${charge.installments.length}x de ${formatMoney(charge.installments[0]?.amount ?? 0)}` : "À vista"}, {method.label}
          </Text>
        </div>

        <div className={styles.progress}>
          <Progress value={received} max={charge.amount} size="sm" tone={chargeStatusOf(charge) === "overdue" ? "danger" : "success"} aria-label={`Recebido ${formatMoney(received)} de ${formatMoney(charge.amount)}`} />
          <span className={styles.progressLine}>
            <Text as="span" variant="caption1" tone="secondary">
              {paidCount} de {charge.installments.length} {charge.installments.length === 1 ? "parcela" : "parcelas"}
            </Text>
            <Text as="span" variant="caption1" weight="semibold" numeric>
              {formatMoney(received)}
            </Text>
          </span>
        </div>

        <footer className={styles.foot}>
          {charge.cancelledAt ? (
            <Text as="span" variant="caption1" tone="tertiary">
              Cancelada em {shortDate(charge.cancelledAt.slice(0, 10))}
            </Text>
          ) : next ? (
            <>
              <Text as="span" variant="caption1" tone="secondary" truncate>
                {installmentLabel(next.number, charge.installments.length)}, {shortDate(next.dueDate)}
              </Text>
              <Badge tone={next.reported ? "info" : dueTone(next.dueDate)} size="sm">
                {next.reported ? "Pagamento avisado" : dueLabel(next.dueDate)}
              </Badge>
            </>
          ) : (
            <Text as="span" variant="caption1" tone="secondary">
              Paga por completo{lastPaid?.paidAt ? ` em ${shortDate(lastPaid.paidAt.slice(0, 10))}` : ""}
            </Text>
          )}
        </footer>
      </div>
    </article>
  );
}
