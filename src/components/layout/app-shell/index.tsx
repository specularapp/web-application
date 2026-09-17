import type { ReactNode } from "react";
import { SCROLL_CONTAINER } from "@/lib/scroll";
import { AiPanel } from "@/features/ai/components/ai-panel";
import { AiPanelProvider, type AiPanelData } from "@/features/ai/components/ai-panel-context";
import { getShellData } from "@/features/organizations/shell-data";
import { FloatingActionsProvider } from "../floating-actions";
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
  const shell = await getShellData();

  return (
    <AppFrame
      ai={{ usage: shell.ai, viewer: shell.user.name }}
      sidebar={
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

/** A moldura: trilha do menu, coluna que rola e a coluna do assistente. */
export function AppFrame({ sidebar, children, ai }: { sidebar: ReactNode; children: ReactNode; ai?: AiPanelData }) {
  return (
    <FloatingActionsProvider>
      {/* Quem abre o assistente é o widget do topo, lá dentro da página, e quem aparece é uma coluna irmã do
          conteúdo: os dois só se encontram aqui em cima. */}
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
    </FloatingActionsProvider>
  );
}
