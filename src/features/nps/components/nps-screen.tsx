import type { ReactNode } from "react";
import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import styles from "./nps.module.css";

/** A moldura de toda tela do NPS: o topo da casa com o nome da página e a prancha embaixo. */
export function NpsScreen({ title, ai, children }: { title: string; ai: AiUsage; children: ReactNode }) {
  return (
    <div className={styles.screen}>
      <Topbar title={title} ai={ai} />
      {children}
    </div>
  );
}
