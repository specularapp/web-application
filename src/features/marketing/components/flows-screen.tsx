import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { Flow } from "../types";
import { FlowsBoard } from "./flows-board";
import styles from "./marketing-screen.module.css";

export type FlowsScreenProps = { flows: Flow[]; author: string; ai: AiUsage };

// A tela dos fluxos de conversa: o topo padrão com o `h1` e a prancha embaixo. Server Component; quem tem
// estado é a prancha.
export function FlowsScreen({ flows, author, ai }: FlowsScreenProps) {
  return (
    <div className={styles.screen}>
      <Topbar title="Fluxos" ai={ai} />
      <FlowsBoard flows={flows} author={author} />
    </div>
  );
}
