/** Um mês do resumo, com a chave no formato `yyyy-MM`: quem mostra decide como escrever o nome. */
export type ProjectsMonth = {
  month: string;
  /** Projetos que começaram no mês. */
  started: number;
  /** Projetos entregues no mês. */
  completed: number;
};

export type ProjectsClient = { name: string; avatarUrl: string | null };

/** O que o bloco de projetos do painel mostra: total, clientes atendidos e os últimos meses, do mais antigo ao atual. */
export type ProjectsSummary = {
  total: number;
  clientCount: number;
  /** Os primeiros clientes, para as bolinhas; o total vai em `clientCount`. */
  clients: ProjectsClient[];
  months: ProjectsMonth[];
};
