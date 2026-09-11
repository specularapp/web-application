import type { ReactNode } from "react";
import { SCROLL_CONTAINER } from "@/lib/scroll";
import { getOnboardingBilling } from "@/features/billing/queries";
import { planBadges } from "@/features/billing/plans";
import { roleLabels } from "@/features/onboarding/labels";
import { getCurrentTeamState, getTeamOptions } from "@/features/organizations/queries";
import { previewTasks } from "@/features/tasks/list-preview";
import { buildTaskTree } from "@/features/tasks/tree";
import { previewTaskTree } from "@/features/tasks/tree-preview";
import { FloatingActionsProvider } from "../floating-actions";
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
          /* A arquitetura das tarefas com as contagens resolvidas aqui, no servidor, como o aviso: o menu
             recebe pronta e não conhece o domínio. Vem de prévia enquanto pastas e projetos não existem no
             banco, e troca só esta linha quando existirem. */
          tasks={buildTaskTree(previewTaskTree, previewTasks)}
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
    <FloatingActionsProvider>
      <div className={styles.shell}>
        {sidebar}
        {/* Quem rola na aplicação é esta coluna, e não o documento: a concha tem a altura do visor. O
            atributo é o que as camadas procuram para travar a rolagem certa ao abrir. */}
        <main className={styles.content} {...{ [SCROLL_CONTAINER]: "" }}>
          {children}
        </main>
      </div>
    </FloatingActionsProvider>
  );
}
