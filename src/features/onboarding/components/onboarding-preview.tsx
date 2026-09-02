"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Text } from "@/components/ui/text";
import type { BillingState } from "@/features/billing/service";
import type { Team, TeamInvite, TeamMember } from "@/features/organizations/service";
import { squircle } from "@/lib/corners";
import { OnboardingFlow, type StepName } from "./onboarding-flow";
import styles from "./onboarding-preview.module.css";

const tabs: { step: StepName; label: string }[] = [
  { step: "time", label: "Etapa 1, time" },
  { step: "membros", label: "Etapa 2, membros" },
  { step: "plano", label: "Etapa 3, plano" },
];

// Time de mentira para as etapas 2 e 3 abrirem sem passar pela 1. O id não existe no banco, e nada
// nesta tela grava, então ele só serve para o fluxo ter um time em mãos.
const team: Team = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Estúdio Aurora",
  slug: "estudio-aurora",
  industry: "design_and_development",
  website: "https://estudioaurora.com.br",
  logoUrl: null,
  bannerUrl: null,
  completed: false,
};

const viewer: TeamMember = {
  userId: "00000000-0000-4000-8000-000000000002",
  name: "Aleph Ramos",
  email: "aleph@specular.com.br",
  avatarUrl: null,
  role: "owner",
};

const members: TeamMember[] = [
  viewer,
  {
    userId: "00000000-0000-4000-8000-000000000003",
    name: "Marina Cardoso",
    email: "marina@specular.com.br",
    avatarUrl: null,
    role: "admin",
  },
];

const invites: TeamInvite[] = [
  {
    id: "00000000-0000-4000-8000-000000000004",
    name: "Rafael Lima",
    email: "rafael@exemplo.com.br",
    role: "member",
  },
];

/**
 * Prévia de front dos primeiros passos, no formato real: camada em tela cheia, não caixa como na
 * vitrine. A barra de cima pula direto para qualquer etapa, e nada sai para o servidor.
 */
export function OnboardingPreview({ billing, step: initial }: { billing: BillingState; step: StepName }) {
  const router = useRouter();
  const [step, setStep] = useState<StepName>(initial);

  // A etapa vai para a URL, então recarregar volta na mesma tela em que o ajuste está sendo feito.
  const choose = (next: StepName) => {
    setStep(next);
    router.replace(`/previa/primeiros-passos?etapa=${next}`, { scroll: false });
  };

  return (
    <>
      <div className={styles.bar}>
        <div className={styles.tabs} role="tablist" aria-label="Etapa em prévia" {...squircle("md")}>
          {tabs.map((tab) => (
            <button
              key={tab.step}
              type="button"
              role="tab"
              aria-selected={step === tab.step}
              className={styles.tab}
              data-active={step === tab.step || undefined}
              onClick={() => choose(tab.step)}
              {...squircle("sm")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Text variant="caption1" tone="tertiary" className={styles.hint}>
          Prévia só de front: nada vai para o banco. Na etapa do plano, escolher um plano pago abre a
          etapa de pagamento com o espaço do formulário do Stripe reservado.
        </Text>
      </div>

      {/* `key` por etapa remonta o fluxo, senão o estado interno dele ignoraria a troca de aba. */}
      <OnboardingFlow
        key={step}
        demo
        initialStep={step}
        team={step === "time" ? null : team}
        members={members}
        invites={invites}
        currentUser={viewer}
        billing={billing}
      />
    </>
  );
}
