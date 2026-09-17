"use client";

import { CheckCircleIcon, CopyIcon, HandCoinsIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { squircle } from "@/lib/corners";
import { formatMoney } from "@/lib/utils/format";
import { reportPaymentAction } from "../actions";
import { chargeMethods, chargeStatuses, dueLabel, dueTone, installmentLabel, installmentStatuses, longDate } from "../labels";
import { chargeOpen, chargeReceived, chargeStatusOf, installmentStatusOf, type Charge } from "../summary";
import styles from "./charge-public-view.module.css";

export type ChargePublicViewProps = {
  charge: Charge;
  issuerName: string;
};

// A página que o cliente abre pelo link do e-mail (2026-09-15): quem cobra e o que é a cobrança em cima; o
// total com o que já foi pago e o que falta; cada parcela com o vencimento, o valor e a situação, e o botão
// para **avisar que pagou**, que marca a parcela e avisa a equipe por e-mail; e como pagar, com as instruções
// para copiar. Só por token, que é a credencial. Sem menu nem nada em volta: é a folha da cobrança.
export function ChargePublicView({ charge: initial, issuerName }: ChargePublicViewProps) {
  const { toast } = useToast();
  const [charge, setCharge] = useState(initial);
  const [reporting, setReporting] = useState<string | null>(null);
  const status = chargeStatuses[chargeStatusOf(charge)];
  const method = chargeMethods[charge.method];
  const received = chargeReceived(charge);
  const open = chargeOpen(charge);

  const report = async (installmentId: string) => {
    setReporting(installmentId);
    const result = await reportPaymentAction({ token: charge.token, installmentId });
    setReporting(null);
    if (!result.ok) {
      toast({ title: "Não deu para avisar", description: result.error, tone: "danger" });
      return;
    }
    setCharge(result.charge);
    toast({ title: "Aviso enviado", description: `${issuerName} vai conferir e confirmar o recebimento.`, tone: "success" });
  };

  const copyInfo = async () => {
    try {
      await navigator.clipboard.writeText(charge.paymentInfo);
      toast({ title: "Copiado", description: "As instruções de pagamento estão na área de transferência.", tone: "success" });
    } catch {
      toast({ title: "Não deu para copiar", description: "Selecione o texto e copie à mão.", tone: "warning" });
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <div className={styles.heading}>
          <Text as="p" variant="caption1" tone="secondary">
            {issuerName}, cobrança {charge.reference}
          </Text>
          <Text as="h1" variant="title3" weight="semibold">
            {charge.title}
          </Text>
          {charge.description && (
            <Text as="p" variant="footnote" tone="secondary">
              {charge.description}
            </Text>
          )}
        </div>
        <div className={styles.client}>
          <Avatar name={charge.client.name} src={charge.client.avatarUrl ?? undefined} size="sm" shape="squircle" />
          <Text as="span" variant="footnote" tone="secondary">
            Para {charge.client.company ?? charge.client.name}
          </Text>
        </div>
      </header>

      <section className={styles.sheet} {...squircle("xl")}>
        <div className={styles.summary}>
          <div className={styles.amount}>
            <Text as="p" variant="caption1" tone="secondary">
              Valor total
            </Text>
            <Text as="p" variant="title1" weight="semibold" numeric>
              {formatMoney(charge.amount)}
            </Text>
            <Badge tone={status.tone} size="sm" icon={<status.icon />}>
              {status.label}
            </Badge>
          </div>
          <dl className={styles.figures}>
            <div>
              <Text as="dt" variant="caption1" tone="secondary">
                Já pago
              </Text>
              <Text as="dd" variant="subheadline" weight="semibold" numeric>
                {formatMoney(received)}
              </Text>
            </div>
            <div>
              <Text as="dt" variant="caption1" tone="secondary">
                Em aberto
              </Text>
              <Text as="dd" variant="subheadline" weight="semibold" numeric>
                {formatMoney(open)}
              </Text>
            </div>
            <div>
              <Text as="dt" variant="caption1" tone="secondary">
                Parcelas
              </Text>
              <Text as="dd" variant="subheadline" weight="semibold" numeric>
                {charge.installments.length}
              </Text>
            </div>
          </dl>
        </div>

        <ul className={styles.installments} aria-label="Parcelas">
          {charge.installments.map((installment) => {
            const state = installmentStatusOf(installment, charge);
            const meta = installmentStatuses[state];
            const canReport = state !== "paid" && state !== "cancelled" && !installment.reported;
            return (
              <li key={installment.id} className={styles.installment} data-status={state} {...squircle("md")}>
                <span className={styles.installmentCopy}>
                  <Text as="span" variant="footnote" weight="semibold">
                    {installmentLabel(installment.number, charge.installments.length)}
                  </Text>
                  <Text as="span" variant="caption1" tone="secondary">
                    {installment.paidAt ? `Paga em ${longDate(installment.paidAt.slice(0, 10))}` : `Vencimento em ${longDate(installment.dueDate)}`}
                  </Text>
                </span>
                <span className={styles.installmentEnd}>
                  <Text as="span" variant="subheadline" weight="semibold" numeric>
                    {formatMoney(installment.amount)}
                  </Text>
                  {installment.paidAt ? (
                    <Badge tone="success" size="sm" icon={<CheckCircleIcon />}>
                      Paga
                    </Badge>
                  ) : installment.reported ? (
                    <Badge tone="info" size="sm">
                      Aviso enviado
                    </Badge>
                  ) : (
                    <Badge tone={state === "cancelled" ? "neutral" : dueTone(installment.dueDate)} size="sm">
                      {state === "cancelled" ? meta.label : dueLabel(installment.dueDate)}
                    </Badge>
                  )}
                </span>
                {canReport && (
                  <Button variant="outline" size="sm" radius="md" iconStart={<HandCoinsIcon />} loading={reporting === installment.id} onClick={() => void report(installment.id)}>
                    Já paguei
                  </Button>
                )}
              </li>
            );
          })}
        </ul>

        {!charge.cancelledAt && open > 0 && (
          <section className={styles.payment} aria-label="Como pagar">
            <span className={styles.paymentHead}>
              <method.icon aria-hidden="true" />
              <Text as="h2" variant="subheadline" weight="semibold">
                Como pagar por {method.label}
              </Text>
              {charge.paymentInfo && (
                <IconButton label="Copiar as instruções" variant="ghost" size="sm" onClick={() => void copyInfo()}>
                  <CopyIcon />
                </IconButton>
              )}
            </span>
            <Text variant="footnote" className={styles.paymentInfo}>
              {charge.paymentInfo || `${issuerName} envia os dados para pagamento por ${method.label}.`}
            </Text>
            <Text variant="caption1" tone="tertiary">
              Depois de pagar, use &quot;Já paguei&quot; na parcela: a equipe confere e confirma o recebimento.
            </Text>
          </section>
        )}
      </section>

      <Text as="p" variant="caption1" tone="tertiary" align="center" className={styles.footnote}>
        Cobrança emitida por {issuerName}. Dúvidas, responda o e-mail que trouxe este link.
      </Text>
    </main>
  );
}
