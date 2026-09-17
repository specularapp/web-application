"use client";

import { useToast } from "@/components/providers/toast-provider";
import { PlanChooser } from "@/features/billing/components/plan-chooser";
import type { BillingState } from "@/features/billing/service";
import { finishOnboardingAction } from "@/features/organizations/actions";
import type { Team } from "@/features/organizations/service";
import { callAction } from "@/lib/action";

type PlanStepProps = {
  team: Team;
  billing: BillingState;
  demo?: boolean;
  /** Chamado quando a configuração fecha, para o fluxo abrir a despedida. */
  onFinished: () => void;
};

/**
 * A etapa de plano dos primeiros passos. O mapa de planos em si é o `PlanChooser`, em cobrança: ele nasceu
 * aqui e virou peça quando o modal central de plano passou a mostrar a mesma escolha.
 *
 * O que sobra desta etapa é o único pedaço que é do onboarding: escolher um plano aqui também **encerra a
 * configuração**, e é essa chamada que o resto da aplicação não faz.
 */
export function PlanStep({ team, billing, demo = false, onFinished }: PlanStepProps) {
  const { toast } = useToast();

  const finish = async () => {
    if (demo) {
      onFinished();
      return;
    }

    const result = await callAction(finishOnboardingAction({ organizationId: team.id }));
    if (!result.ok) {
      toast({ title: "Não foi possível concluir", description: result.error, tone: "danger" });
      return;
    }

    onFinished();
  };

  return <PlanChooser organizationId={team.id} billing={billing} demo={demo} onDone={() => void finish()} />;
}
