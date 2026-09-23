import type { ApprovalDecisionType, ApprovalStatus } from "./summary";

export const approvalStatuses: Record<ApprovalStatus, { label: string; tone: "neutral" | "warning" | "success" | "danger" | "info" }> = {
  draft: { label: "Rascunho", tone: "neutral" },
  pending: { label: "Aguardando", tone: "warning" },
  approved: { label: "Aprovado", tone: "success" },
  changes_requested: { label: "Alterações solicitadas", tone: "info" },
  rejected: { label: "Rejeitado", tone: "danger" },
  closed: { label: "Encerrado", tone: "neutral" },
};

export const approvalDecisions: Record<ApprovalDecisionType, string> = {
  approved: "Aprovado",
  changes_requested: "Alterações solicitadas",
  rejected: "Rejeitado",
};
