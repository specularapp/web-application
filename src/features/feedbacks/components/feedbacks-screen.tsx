import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { ClientFeedback, FeedbackProjectOption } from "../summary";
import { FeedbacksBoard } from "./feedbacks-board";
import styles from "./feedbacks.module.css";

export function FeedbacksScreen({ feedbacks, projects, ai }: { feedbacks: ClientFeedback[]; projects: FeedbackProjectOption[]; ai: AiUsage }) {
  return <div className={styles.screen}><Topbar ai={ai} /><FeedbacksBoard initialFeedbacks={feedbacks} projects={projects} /></div>;
}
