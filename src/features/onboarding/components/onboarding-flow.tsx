"use client";

import { useId, useState } from "react";
import { Text } from "@/components/ui/text";
import type { Team, TeamInvite, TeamMember } from "@/features/organizations/service";
import { MembersStep } from "./members-step";
import styles from "./onboarding.module.css";
import { StepRing } from "./step-ring";
import { TeamStep } from "./team-step";

type OnboardingFlowProps = {
  team: Team | null;
  members: TeamMember[];
  invites: TeamInvite[];
  currentUser: TeamMember;
  demo?: boolean;
};

type StepName = "time" | "membros" | "plano";

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

export function OnboardingFlow({ team, members, invites, currentUser, demo = false }: OnboardingFlowProps) {
  const [saved, setSaved] = useState(team);
  const [step, setStep] = useState<StepName>(team ? "membros" : "time");
  const titleId = useId();
  const index = steps.findIndex((item) => item.name === step);
  const current = steps[index] ?? steps[0];

  return (
    <div
      className={styles.overlay}
      data-demo={demo || undefined}
      role="dialog"
      aria-modal={demo ? undefined : true}
      aria-labelledby={titleId}
    >
      <div className={styles.shell}>
        <section className={styles.card}>
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

          {step === "time" || !saved ? (
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
            />
          )}
        </section>
      </div>
    </div>
  );
}
