import type { ReactNode } from "react";
import { getOnboardingBilling } from "@/features/billing/queries";
import type { BillingState } from "@/features/billing/service";
import { planBadges } from "@/features/billing/plans";
import { roleLabels } from "@/features/onboarding/labels";
import { getCurrentTeamState, getTeamOptions } from "@/features/organizations/queries";
import { previewNotifications } from "../notifications/preview";
import { Sidebar, type SidebarPromo } from "../sidebar";
import styles from "./app-shell.module.css";

const PLAN_PITCH = "Assine o Pro e mantenha orçamento, contrato e cobrança sem limite.";

/* O convite só existe enquanto há o que vender: teste em andamento ou plano gratuito em vigor. */
function promoFor(billing: BillingState): SidebarPromo | undefined {
  if (billing.status === "trialing") {
    return {
      eyebrow: "Specular",
      title: "Pro em teste",
      description: PLAN_PITCH,
      action: "Assinar o Pro",
      href: "/configuracoes/plano",
    };
  }

  if (billing.effectivePlan === "free") {
    return {
      eyebrow: "Specular",
      title: "Plano gratuito",
      description: PLAN_PITCH,
      action: "Conhecer o Pro",
      href: "/configuracoes/plano",
    };
  }

  return undefined;
}

export async function AppShell({ children }: { children: ReactNode }) {
  const [state, teams] = await Promise.all([getCurrentTeamState(), getTeamOptions()]);
  const billing = await getOnboardingBilling(state.team?.id ?? null);

  const team = {
    name: state.team?.name ?? "Seu time",
    logoUrl: state.team?.logoUrl ?? null,
    plan: planBadges[billing.effectivePlan],
  };

  const user = {
    name: state.viewer.name ?? state.viewer.email ?? "Você",
    email: state.viewer.email,
    role: roleLabels[state.viewer.role],
    avatarUrl: state.viewer.avatarUrl,
  };

  return (
    <div className={styles.shell}>
      <Sidebar
        team={team}
        user={user}
        teams={teams.map((option) => ({
          id: option.id,
          name: option.name,
          logoUrl: option.logoUrl,
          plan: planBadges[option.plan],
        }))}
        currentTeamId={state.team?.id ?? null}
        notifications={previewNotifications}
        promo={promoFor(billing)}
      />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
