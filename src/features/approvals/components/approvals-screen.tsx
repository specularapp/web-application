import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { ApprovalListItem, ApprovalProjectOption } from "../summary";
import { ApprovalsBoard } from "./approvals-board";
import styles from "./approvals.module.css";

export function ApprovalsScreen({ approvals, projects, ai }: { approvals: ApprovalListItem[]; projects: ApprovalProjectOption[]; ai: AiUsage }) {
  return <div className={styles.screen}><Topbar ai={ai} /><ApprovalsBoard approvals={approvals} projects={projects} /></div>;
}
