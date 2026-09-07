/** No time de verdade ou com convite ainda em aberto: é o que decide a cor do ponto na foto. */
export type TeamMemberStatus = "active" | "pending";

/** O papel de acesso no time, o mesmo de `organization_members`. */
export type TeamMemberAccess = "owner" | "admin" | "member";

/** Os números que dizem o que a pessoa produziu no sistema. */
export type TeamMemberMetrics = {
  deliveredProjects: number;
  /** Faturamento que a pessoa trouxe, em centavos. */
  revenue: number;
  activeProjects: number;
  openTasks: number;
};

export type TeamMemberProjectStatus = "ongoing" | "done" | "paused";

/** Um projeto em que a pessoa está, como aparece no perfil dela. */
export type TeamMemberProject = {
  id: string;
  reference: string;
  name: string;
  status: TeamMemberProjectStatus;
  /** De 0 a 100. */
  progress: number;
};

export type TeamMemberEvent = {
  id: string;
  /** O que a pessoa fez, sem o nome: "entregou o site da Bravo". */
  action: string;
  /** Quando, em ISO com hora: `yyyy-MM-dd'T'HH:mm`. */
  at: string;
};

export type TeamMember = {
  id: string;
  name: string;
  /** Função na equipe, como "Designer" ou "Desenvolvedora", e não o papel de acesso. */
  role: string;
  avatarUrl: string | null;
  status: TeamMemberStatus;
  access: TeamMemberAccess;
  email: string;
  /** Só dígitos, com DDD, como vai para o banco: quem mostra aplica a máscara. */
  phone: string | null;
  city?: string;
  /** Quando entrou no time, no formato `yyyy-MM-dd`. */
  joinedAt: string;
  /** Como a pessoa se apresenta, em texto corrido. */
  bio?: string;
  /** Pontos de gamificação acumulados. */
  points: number;
  skills: string[];
  metrics: TeamMemberMetrics;
  projects: TeamMemberProject[];
  /** Da mais recente para a mais antiga. */
  activity: TeamMemberEvent[];
};

/** O que o bloco de equipe do painel mostra: todo mundo, na ordem de entrada. */
export type TeamSummary = {
  members: TeamMember[];
};
