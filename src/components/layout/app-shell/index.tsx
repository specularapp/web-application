import type { ReactNode } from "react";
import { SCROLL_CONTAINER } from "@/lib/scroll";
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
      {/* Quem rola na aplicação é esta coluna, e não o documento: a concha tem a altura do visor. O
          atributo é o que as camadas procuram para travar a rolagem certa ao abrir. */}
      <main className={styles.content} {...{ [SCROLL_CONTAINER]: "" }}>
        {children}
      </main>
    </div>
  );
}
