import type { TeamSummary } from "./summary";

/**
 * Equipe de exemplo para o bloco do painel enquanto as métricas não existem no banco. Os membros de
 * verdade já moram em `organization_members`; o que falta são os números por pessoa, que nascem com
 * projetos e cobranças. Ninguém tem foto, para o rosto gerado pelo `Avatar` aparecer; o faturamento vai em
 * centavos, como todo dinheiro do produto.
 */
export const previewTeamSummary: TeamSummary = {
  members: [
    { id: "m1", name: "Aleph Ramos", role: "Desenvolvedor full stack", avatarUrl: null, status: "active", metrics: { deliveredProjects: 9, revenue: 12_480_000 } },
    { id: "m2", name: "Adam Pires", role: "Redator", avatarUrl: null, status: "active", metrics: { deliveredProjects: 4, revenue: 3_150_000 } },
    { id: "m3", name: "Arthur Gomes", role: "Líder de design", avatarUrl: null, status: "active", metrics: { deliveredProjects: 7, revenue: 8_920_000 } },
    { id: "m4", name: "Ana Freitas", role: "Front-end", avatarUrl: null, status: "active", metrics: { deliveredProjects: 5, revenue: 4_600_000 } },
    { id: "m5", name: "Bruno Sales", role: "Comercial", avatarUrl: null, status: "active", metrics: { deliveredProjects: 2, revenue: 15_300_000 } },
    { id: "m6", name: "Carla Mendes", role: "Gestora de projetos", avatarUrl: null, status: "active", metrics: { deliveredProjects: 12, revenue: 11_750_000 } },
    { id: "m7", name: "Diego Rocha", role: "Motion designer", avatarUrl: null, status: "pending", metrics: { deliveredProjects: 0, revenue: 0 } },
    { id: "m8", name: "Elisa Martins", role: "UX writer", avatarUrl: null, status: "active", metrics: { deliveredProjects: 3, revenue: 2_280_000 } },
  ],
};
