import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { Automation } from "../summary";
import { AutomationEditor } from "./automation-editor";
import styles from "./automations-screen.module.css";

export type AutomationEditorScreenProps = {
  automation: Automation;
  ai: AiUsage;
};

// A tela do editor de automação: o topo padrão da aplicação, com o nome trocado, e o quadro tomando o resto.
// Server Component na mesma moldura da lista; quem tem estado é o editor.
export function AutomationEditorScreen({ automation, ai }: AutomationEditorScreenProps) {
  return (
    <div className={styles.screen}>
      <Topbar title="Editor de automação" ai={ai} />
      <AutomationEditor automation={automation} />
    </div>
  );
}
