import type { ReactNode } from "react";
import { getOnboardingBilling } from "@/features/billing/queries";
import type { BillingState } from "@/features/billing/service";
import { planBadges } from "@/features/billing/plans";
import { roleLabels } from "@/features/onboarding/labels";
import { getCurrentTeamState, getTeamOptions } from "@/features/organizations/queries";
import { previewNotifications } from "../notifications/preview";
import { Sidebar } from "../sidebar";
import { pickSuggestion } from "../suggestions";
import styles from "./app-shell.module.css";

/* O mural sorteia uma sugestão por carga. As de plano só entram enquanto há o que vender: teste em
   andamento ou plano gratuito em vigor. */
function selling(billing: BillingState) {
  return billing.status === "trialing" || billing.effectivePlan === "free";
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
        suggestion={pickSuggestion(selling(billing)).id}
      />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
