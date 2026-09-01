"use client";

import { useState } from "react";
import { Logo } from "@/components/layout/logo";
import { Text } from "@/components/ui/text";
import type { Team, TeamInvite, TeamMember } from "@/features/organizations/service";
import { MembersStep } from "./members-step";
import styles from "./onboarding.module.css";
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
  const index = steps.findIndex((item) => item.name === step);
  const current = steps[index] ?? steps[0];
  // Na vitrine o fluxo entra dentro de outra página, então nem o main nem o h1 podem se repetir.
  const Frame = demo ? "div" : "main";

  return (
    <Frame className={styles.overlay} data-demo={demo || undefined}>
      <div className={styles.shell}>
        <div className={styles.bars}>
          {steps.map((item, position) => (
            <span
              key={item.name}
              className={styles.bar}
              data-state={position < index ? "done" : position === index ? "current" : "next"}
            />
          ))}
        </div>

        <section className={styles.card}>
          <div className={styles.head}>
            <div className={styles.headText}>
              <Text as={demo ? "h3" : "h1"} variant="title2" weight="medium">
                {current.title}
              </Text>
              <Text variant="subheadline" tone="secondary">
                {current.description}
              </Text>
            </div>
            <Logo variant="icon" height={28} label="" aria-hidden="true" />
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
    </Frame>
  );
}
