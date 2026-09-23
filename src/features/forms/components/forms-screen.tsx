import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { IntakeFormClient, IntakeFormListItem, IntakeFormProject } from "../summary";
import { FormsBoard } from "./forms-board";
import styles from "./forms-screen.module.css";

export function FormsScreen({ forms, projects, clients, ai }: { forms: IntakeFormListItem[]; projects: IntakeFormProject[]; clients: IntakeFormClient[]; ai: AiUsage }) {
  return <div className={styles.screen}><Topbar ai={ai} /><FormsBoard forms={forms} projects={projects} clients={clients} /></div>;
}
