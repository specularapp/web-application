import { previewTasks } from "@/features/tasks/list-preview";
import { buildTaskTree } from "@/features/tasks/tree";
import { previewTaskTree } from "@/features/tasks/tree-preview";
import { pickAlert, previewAlerts } from "../alerts";
import { previewNotifications } from "../notifications/preview";
import type { SidebarProps } from "./index";

/** Dados de exemplo do menu, para a prévia de front e para a vitrine mostrarem o mesmo estado. */
export const previewSidebar: SidebarProps = {
  team: { name: "Estúdio Aurora", logoUrl: null, plan: "Pro" },
  user: { name: "Aleph Ramos", email: "aleph@specular.app", role: "Desenvolvedor full stack", avatarUrl: null },
  teams: [
    { id: "aurora", name: "Estúdio Aurora", logoUrl: null, plan: "Pro" },
    { id: "quadrante", name: "Quadrante Digital", logoUrl: null, plan: "Grátis" },
    { id: "oficina", name: "Oficina de Marcas", logoUrl: null, plan: "Alliance" },
  ],
  currentTeamId: "aurora",
  notifications: previewNotifications,
  alert: pickAlert(previewAlerts),
  tasks: buildTaskTree(previewTaskTree, previewTasks),
};
