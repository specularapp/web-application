"use client";

import { useRouter } from "next/navigation";
import { useCallback, useId, useState } from "react";
import { Text } from "@/components/ui/text";
import type { BillingState } from "@/features/billing/service";
import type { Team, TeamInvite, TeamMember } from "@/features/organizations/service";
import { MembersStep } from "./members-step";
import styles from "./onboarding.module.css";
import { PlanStep } from "./plan-step";
import { StepRing } from "./step-ring";
import { TeamStep } from "./team-step";
import { WelcomeStep } from "./welcome-step";

export type StepName = "time" | "membros" | "plano" | "boas-vindas";

type OnboardingFlowProps = {
  team: Team | null;
  members: TeamMember[];
  invites: TeamInvite[];
  currentUser: TeamMember;
  billing: BillingState;
  /** Não toca o servidor: as etapas trocam de verdade, nada é gravado. */
  demo?: boolean;
  /** Caixa dentro da página em vez de camada sobre a tela. É o formato da vitrine. */
  boxed?: boolean;
  /** Abre direto numa etapa, para a prévia de front alcançar qualquer uma sem preencher as anteriores. */
  initialStep?: StepName;
};

const steps: { name: StepName; title: string; description: string }[] = [
  {
    name: "time",
    title: "Seu time",
    description: "Comece pelo básico, você ajusta tudo isso depois nas configurações.",
  },
  {
    name: "membros",
    title: "Membros",
    description: "Convide colaboradores para trabalhar junto com você.",
  },
  { name: "plano", title: "Plano", description: "Escolha como quer usar o Specular." },
];

export function OnboardingFlow({
  team,
  members,
  invites,
  currentUser,
  billing,
  demo = false,
  boxed = false,
  initialStep,
}: OnboardingFlowProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(team);
  const [step, setStep] = useState<StepName>(initialStep ?? (team ? "membros" : "time"));
  const titleId = useId();
  const index = steps.findIndex((item) => item.name === step);
  const current = steps[index] ?? steps[0];

  // Plano e despedida não estão no array de etapas: o anel conta três, e as duas trazem cabeçalho próprio.
  const framed = step !== "plano" && step !== "boas-vindas";

  // A configuração já foi marcada no banco pela action; recarregar a rota é o que tira a camada da
  // frente, porque o painel deixa de pedir configuração. Na prévia, volta para a etapa do plano.
  const close = useCallback(() => {
    if (demo) setStep("plano");
    else router.refresh();
  }, [demo, router]);

  return (
    <div
      className={styles.overlay}
      data-boxed={boxed || undefined}
      role="dialog"
      aria-modal={boxed ? undefined : true}
      aria-labelledby={framed ? titleId : undefined}
      aria-label={framed ? undefined : "Configuração inicial"}
    >
      <div className={styles.shell} data-step={step}>
        <section className={styles.card} data-step={step}>
          {framed && (
            <div className={styles.head}>
              <div className={styles.headText}>
                <Text as="h2" id={titleId} variant="title2" weight="medium">
                  {current.title}
                </Text>
                <Text variant="subheadline" tone="secondary">
                  {current.description}
                </Text>
              </div>
              <StepRing total={steps.length} current={index + 1} />
            </div>
          )}

          {step === "boas-vindas" && saved ? (
            <WelcomeStep key="boas-vindas" teamName={saved.name} onClose={close} />
          ) : step === "plano" && saved ? (
            <PlanStep
              key="plano"
              team={saved}
              billing={billing}
              demo={demo}
              onFinished={() => setStep("boas-vindas")}
            />
          ) : step === "time" || !saved ? (
            <TeamStep
              key="time"
              team={saved}
              demo={demo}
              onDone={(next) => {
                setSaved(next);
                setStep("membros");
              }}
            />
          ) : (
            <MembersStep
              key="membros"
              team={saved}
              members={members}
              invites={invites}
              currentUser={currentUser}
              demo={demo}
              onBack={() => setStep("time")}
              onNext={() => setStep("plano")}
            />
          )}
        </section>
      </div>
    </div>
  );
}
