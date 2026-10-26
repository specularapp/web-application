import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { Flow } from "../types";
import { FlowEditor } from "./flow-editor";
import styles from "./marketing-screen.module.css";

export type FlowEditorScreenProps = { flow: Flow; flows: { id: string; name: string }[]; ai: AiUsage };

// A tela do construtor de fluxo: o topo padrão da aplicação, com o nome trocado, e o quadro tomando o resto.
// Server Component na mesma moldura da lista; quem tem estado é o construtor.
export function FlowEditorScreen({ flow, flows, ai }: FlowEditorScreenProps) {
  return (
    <div className={styles.screen}>
      <Topbar title="Construtor de fluxo" ai={ai} />
      <FlowEditor key={flow.id} flow={flow} flows={flows} />
    </div>
  );
}
