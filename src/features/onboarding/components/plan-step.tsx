"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/layout/logo";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { formatPrice, plans, YEARLY_DISCOUNT, type BillingCycle, type Plan, type PlanId } from "@/features/billing/plans";
import { finishOnboardingAction } from "@/features/organizations/actions";
import type { Team } from "@/features/organizations/service";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { squircle } from "@/lib/corners";
import styles from "./plan.module.css";

type PlanStepProps = {
  team: Team;
  demo?: boolean;
};

const cycles: { value: BillingCycle; label: string }[] = [
  { value: "monthly", label: "Mensal" },
  { value: "yearly", label: "Anual" },
];

const CURRENT_PLAN: PlanId = "free";

function Price({ plan, cycle }: { plan: Plan; cycle: BillingCycle }) {
  return (
    <p className={styles.price}>
      <span className={styles.amount}>R${formatPrice(plan.price[cycle])}</span>
      <span className={styles.period}>/mês</span>
    </p>
  );
}

export function PlanStep({ team, demo = false }: PlanStepProps) {
  const { toast } = useToast();
  const router = useRouter();
  const compact = useMediaQuery(MOBILE_QUERY);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [selected, setSelected] = useState<PlanId>(CURRENT_PLAN);
  const [working, setWorking] = useState<PlanId | null>(null);

  const choose = async (planId: PlanId) => {
    if (working) return;
    setWorking(planId);

    if (planId !== CURRENT_PLAN) {
      toast({
        title: "Plano escolhido",
        description: "O pagamento entra na próxima etapa, sua conta já está pronta para usar",
        tone: "info",
      });
    }

    if (demo) {
      setWorking(null);
      return;
    }

    const result = await finishOnboardingAction({ organizationId: team.id });
    if (!result.ok) {
      toast({ title: "Não foi possível concluir", description: result.error, tone: "danger" });
      setWorking(null);
      return;
    }

    router.push("/dashboard");
  };

  const actionLabel = (planId: PlanId) => (planId === CURRENT_PLAN ? "Você está aqui" : "Contratar esse plano");

  return (
    <div className={styles.step}>
      <div className={styles.glow} aria-hidden="true" />

      <header className={styles.header}>
        <Logo variant="logotipo" height={34} />

        <Text as="h2" variant="largeTitle" weight="bold" align="center" className={styles.title}>
          Desbloqueie todos os benefícios
        </Text>

        <Text variant="callout" tone="secondary" align="center" className={styles.subtitle}>
          Diferentes opções, mas todas pensando em te entregar sempre o melhor e mais completo
        </Text>

        <div className={styles.cycles} role="radiogroup" aria-label="Ciclo de cobrança" {...squircle("md")}>
          {cycles.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={cycle === option.value}
              className={styles.cycle}
              data-active={cycle === option.value || undefined}
              onClick={() => setCycle(option.value)}
              {...squircle("sm")}
            >
              {option.label}
              {option.value === "yearly" && (
                <Badge tone="neutral" size="sm" className={styles.off}>
                  {YEARLY_DISCOUNT}% OFF
                </Badge>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.grid} role={compact ? "radiogroup" : undefined} aria-label={compact ? "Planos" : undefined}>
        {plans.map((plan) =>
          compact ? (
            <button
              key={plan.id}
              type="button"
              role="radio"
              aria-checked={selected === plan.id}
              className={styles.row}
              data-selected={selected === plan.id || undefined}
              onClick={() => setSelected(plan.id)}
              {...squircle("xl")}
            >
              <span className={styles.rowText}>
                <span className={styles.rowName}>
                  <Text as="span" variant="subheadline" weight="semibold">
                    {plan.name}
                  </Text>
                  {plan.popular && (
                    <Badge tone="neutral" size="sm">
                      Popular
                    </Badge>
                  )}
                </span>
                <Text as="span" variant="footnote" tone="secondary" className={styles.rowDescription}>
                  {plan.description}
                </Text>
              </span>
              <Price plan={plan} cycle={cycle} />
            </button>
          ) : (
            <article
              key={plan.id}
              className={styles.card}
              data-boxed={plan.id !== CURRENT_PLAN || undefined}
              {...squircle("xl")}
            >
              <div className={styles.cardHead}>
                <Text as="h3" variant="headline" weight="semibold">
                  {plan.name}
                </Text>
                {plan.popular && (
                  <Badge tone="neutral" size="sm">
                    Popular
                  </Badge>
                )}
              </div>

              <Text variant="footnote" tone="secondary" className={styles.cardDescription}>
                {plan.description}
              </Text>

              <Price plan={plan} cycle={cycle} />

              <Button
                variant={plan.id === CURRENT_PLAN ? "secondary" : "primary"}
                fullWidth
                radius="md"
                loading={working === plan.id}
                onClick={() => void choose(plan.id)}
              >
                {actionLabel(plan.id)}
              </Button>

              <ul className={styles.features}>
                {plan.features.map((feature) => (
                  <li key={feature.label}>
                    <CheckIcon weight="bold" aria-hidden="true" />
                    <Text as="span" variant="footnote">
                      {feature.label}
                    </Text>
                    {feature.note && (
                      <Text as="span" variant="caption2" tone="tertiary" className={styles.note}>
                        ({feature.note})
                      </Text>
                    )}
                  </li>
                ))}
              </ul>
            </article>
          ),
        )}
      </div>

      {compact && (
        <Button
          size="lg"
          fullWidth
          radius="md"
          loading={working !== null}
          onClick={() => void choose(selected)}
        >
          {actionLabel(selected)}
        </Button>
      )}
    </div>
  );
}
