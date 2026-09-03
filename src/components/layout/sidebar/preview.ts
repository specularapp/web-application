import type { SidebarProps } from "./index";

/** Dados de exemplo do menu, para a prévia de front e para a vitrine mostrarem o mesmo estado. */
export const previewSidebar: SidebarProps = {
  team: { name: "Estúdio Aurora", logoUrl: null, plan: "Pro" },
  user: { name: "Aleph Ramos", role: "Desenvolvedor full stack", avatarUrl: null },
  promo: {
    eyebrow: "Specular",
    title: "Pro em teste",
    description: "Assine o Pro e mantenha orçamento, contrato e cobrança sem limite.",
    action: "Assinar o Pro",
    href: "/configuracoes/plano",
  },
};
