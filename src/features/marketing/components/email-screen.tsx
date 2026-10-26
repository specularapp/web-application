import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { EmailData } from "../types";
import { EmailBoard } from "./email-board";
import styles from "./marketing-screen.module.css";

export type EmailScreenProps = { data: EmailData; ai: AiUsage };

// A tela do e-mail marketing: o topo padrão com o `h1` e a prancha embaixo. Server Component, na mesma
// moldura das outras listas: quem tem estado é a prancha.
export function EmailScreen({ data, ai }: EmailScreenProps) {
  return (
    <div className={styles.screen}>
      <Topbar title="E-mail marketing" ai={ai} />
      <EmailBoard data={data} />
    </div>
  );
}
