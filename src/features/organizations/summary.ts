/** No time de verdade ou com convite ainda em aberto: é o que decide a cor do ponto na foto. */
export type TeamMemberStatus = "active" | "pending";

/** Os dois números que dizem o que a pessoa produziu no sistema. */
export type TeamMemberMetrics = {
  deliveredProjects: number;
  /** Faturamento que a pessoa trouxe, em centavos. */
  revenue: number;
};

export type TeamMember = {
  id: string;
  name: string;
  /** Função na equipe, como "Designer" ou "Desenvolvedora", e não o papel de acesso. */
  role: string;
  avatarUrl: string | null;
  status: TeamMemberStatus;
  metrics: TeamMemberMetrics;
};

/** O que o bloco de equipe do painel mostra: todo mundo, na ordem de entrada. */
export type TeamSummary = {
  members: TeamMember[];
};
