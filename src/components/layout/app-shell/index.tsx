import type { ReactNode } from "react";
import { SCROLL_CONTAINER } from "@/lib/scroll";
import { AiPanel } from "@/features/ai/components/ai-panel";
import { AiPanelProvider, type AiPanelData } from "@/features/ai/components/ai-panel-context";
import { PlanGateProvider } from "@/features/billing/components/plan-gate";
import type { PlanId } from "@/features/billing/plans";
import { getShellData } from "@/features/organizations/shell-data";
import { getTimeTrackerData } from "@/features/time-tracking/queries";
import { TimeTrackerProvider } from "@/features/time-tracking/components/time-tracker-provider";
import { DEFAULT_TIMER_POSITION, type TimeEntry, type TimerPosition } from "@/features/time-tracking/summary";
import { Sidebar } from "../sidebar";
import styles from "./app-shell.module.css";

/**
 * A concha da área autenticada. Ela é desenhada em **toda navegação**, então tudo o que precisa sai de uma
 * leitura só, guardada em Redis por dois minutos e derrubada por tag em qualquer escrita que a mude
 * (`features/organizations/shell-data.ts`).
 *
 * O que ficou de fora de propósito: as conversas do assistente, que são conteúdo longo e só importam quando
 * a coluna abre. Elas chegam por action na primeira abertura.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const [shell, tracker] = await Promise.all([getShellData(), getTimeTrackerData()]);

  return (
    <AppFrame activeTime={tracker.active} timerPosition={tracker.position} ai={{ usage: shell.ai, viewer: shell.user.name }} plan={shell.effectivePlan} sidebar={
        <Sidebar
          team={shell.team}
          user={shell.user}
          teams={shell.teams}
          currentTeamId={shell.currentTeamId}
          notifications={shell.notifications}
          alert={shell.alert}
          tasks={shell.tasks}
          funnels={shell.funnels}
        />
      }
    >
      {children}
    </AppFrame>
  );
}

export type AppFrameProps = {
  sidebar: ReactNode;
  children: ReactNode;
  ai?: AiPanelData;
  /** O plano em vigor, para o portão que toda ação bloqueada consulta. */
  plan?: PlanId;
  activeTime?: TimeEntry | null;
  /** Onde a ilha do cronômetro ficou da última vez que a pessoa a arrastou. */
  timerPosition?: TimerPosition;
};

/** A moldura: trilha do menu, coluna que rola e a coluna do assistente. */
export function AppFrame({ sidebar, children, ai, plan = "free", activeTime = null, timerPosition = DEFAULT_TIMER_POSITION }: AppFrameProps) {
  return (
    /* O portão de plano abraça tudo: qualquer ação da aplicação pode esbarrar num bloqueio, e o modal
       central precisa abrir por cima da tela em que a pessoa está, e não em outra. */
    <PlanGateProvider plan={plan}>
      <TimeTrackerProvider initialEntry={activeTime} initialPosition={timerPosition}>
        {/* Quem abre o assistente é o widget do topo, lá dentro da página, e quem aparece é uma coluna irmã
            do conteúdo: os dois só se encontram aqui em cima. */}
        <AiPanelProvider data={ai}>
          <div className={styles.shell}>
            {sidebar}
            {/* Quem rola na aplicação é esta coluna, e não o documento: a concha tem a altura do visor. O
                atributo é o que as camadas procuram para travar a rolagem certa ao abrir. */}
            <main className={styles.content} {...{ [SCROLL_CONTAINER]: "" }}>
              {children}
            </main>
            <AiPanel />
          </div>
        </AiPanelProvider>
      </TimeTrackerProvider>
    </PlanGateProvider>
  );
}
