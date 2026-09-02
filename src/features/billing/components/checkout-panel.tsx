"use client";

import { LockSimpleIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { squircle } from "@/lib/corners";
import { confirmSubscriptionAction } from "../actions";
import { chargeCents, formatMoney, planById, type BillingCycle, type PlanId } from "../plans";
import styles from "./checkout.module.css";
import { PaymentForm } from "./payment-form";

export type CheckoutIntentInfo = {
  mode: "setup" | "payment";
  clientSecret: string;
  plan: PlanId;
  cycle: BillingCycle;
  subscriptionId: string | null;
  setupIntentId: string | null;
  amountCents: number;
  trialDays: number;
};

type CheckoutPanelProps = {
  organizationId: string;
  intent: CheckoutIntentInfo;
  title: string;
  description: string;
  backLabel: string;
  onBack: () => void;
  onDone: () => void | Promise<void>;
  /** Vitrine e prévia: monta os campos de verdade, sem intenção no servidor e sem confirmar nada. */
  preview?: boolean;
};

const cycleLabels: Record<BillingCycle, string> = { monthly: "Mensal", yearly: "Anual" };
const renewalLabels: Record<BillingCycle, string> = { monthly: "por mês", yearly: "por ano" };

export function CheckoutPanel({
  organizationId,
  intent,
  title,
  description,
  backLabel,
  onBack,
  onDone,
  preview = false,
}: CheckoutPanelProps) {
  const [confirming, setConfirming] = useState(false);
  const plan = planById(intent.plan);
  const recurring = chargeCents(intent.plan, intent.cycle);

  // Prazo relativo, não data. A assinatura só nasce depois que o cartão é guardado, e o Stripe conta
  // os dias a partir dali: uma data escrita agora envelheceria se o painel ficasse aberto, e viraria
  // promessa errada na virada do dia. A data exata aparece em /configuracoes/plano, vinda do Stripe.
  const firstCharge = intent.trialDays > 0 ? `em ${intent.trialDays} dias` : null;

  const confirm = async () => {
    setConfirming(true);

    const result = await confirmSubscriptionAction({
      organizationId,
      ...(intent.subscriptionId ? { subscriptionId: intent.subscriptionId } : {}),
      ...(intent.setupIntentId ? { setupIntentId: intent.setupIntentId } : {}),
    });

    if (!result.ok) {
      setConfirming(false);
      return result.error;
    }

    await onDone();
    return null;
  };

  return (
    <section className={styles.panel} aria-label="Pagamento">
      <header className={styles.head}>
        <Text as="h2" variant="title2" weight="semibold">
          {title}
        </Text>
        <Text variant="subheadline" tone="secondary">
          {description}
        </Text>
      </header>

      <div className={styles.columns}>
        <div className={styles.summary} {...squircle("xl")}>
          <div className={styles.summaryHead}>
            <Text as="h3" variant="headline" weight="semibold">
              {plan?.name ?? intent.plan}
            </Text>
            {intent.trialDays > 0 && (
              <Badge tone="success" size="sm">
                {intent.trialDays} dias grátis
              </Badge>
            )}
          </div>

          <dl className={styles.lines}>
            <div className={styles.line}>
              <Text as="dt" variant="footnote" tone="secondary">
                Ciclo
              </Text>
              <Text as="dd" variant="footnote">
                {cycleLabels[intent.cycle]}
              </Text>
            </div>

            <div className={styles.line}>
              <Text as="dt" variant="footnote" tone="secondary">
                Assinatura
              </Text>
              <Text as="dd" variant="footnote" numeric>
                {formatMoney(recurring)} {renewalLabels[intent.cycle]}
              </Text>
            </div>

            {firstCharge && (
              <div className={styles.line}>
                <Text as="dt" variant="footnote" tone="secondary">
                  Primeira cobrança
                </Text>
                <Text as="dd" variant="footnote">
                  {firstCharge}
                </Text>
              </div>
            )}
          </dl>

          <div className={styles.total}>
            <Text variant="subheadline" weight="medium">
              Total hoje
            </Text>
            <span className={styles.amount}>{formatMoney(intent.amountCents)}</span>
          </div>
        </div>

        <PaymentForm
          clientSecret={intent.clientSecret}
          mode={intent.mode}
          preview={preview}
          submitLabel={intent.trialDays > 0 ? `Começar teste de ${intent.trialDays} dias` : "Confirmar pagamento"}
          pendingLabel={confirming ? "Liberando o acesso" : "Confirmando"}
          onConfirmed={confirm}
          footer={
            <div className={styles.footer}>
              <Text variant="caption2" tone="tertiary" className={styles.secure}>
                <LockSimpleIcon weight="fill" aria-hidden="true" />
                Pagamento processado pelo Stripe. Os dados do cartão não passam pelos nossos servidores
              </Text>

              {intent.trialDays > 0 && (
                <Text variant="caption2" tone="tertiary" align="center">
                  Cobramos só depois do teste, e você pode cancelar antes disso
                </Text>
              )}

              <Button type="button" variant="ghost" size="sm" onClick={onBack}>
                {backLabel}
              </Button>
            </div>
          }
        />
      </div>
    </section>
  );
}
