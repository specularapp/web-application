import type { ReactNode } from "react";
import { getOnboardingBilling } from "@/features/billing/queries";
import { planBadges } from "@/features/billing/plans";
import { roleLabels } from "@/features/onboarding/labels";
import { getCurrentTeamState, getTeamOptions } from "@/features/organizations/queries";
import { previewNotifications } from "../notifications/preview";
import { Sidebar } from "../sidebar";
import { pickAlert, previewAlerts } from "../alerts";
import styles from "./app-shell.module.css";

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
    <AppFrame
      sidebar={
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
          alert={pickAlert(previewAlerts)}
        />
      }
    >
      {children}
    </AppFrame>
  );
}

/** A moldura sem dado nenhum: trilha do menu e coluna que rola. O `AppShell` a preenche com o banco;
 *  a prévia do painel, com dados de exemplo. */
export function AppFrame({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.shell}>
      {sidebar}
      <main className={styles.content}>{children}</main>
    </div>
  );
}
