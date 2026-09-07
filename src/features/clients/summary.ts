export type Client = {
  id: string;
  name: string;
  email: string | null;
  /** Só dígitos, com DDD, como vai para o banco: quem mostra aplica a máscara. */
  phone: string | null;
  avatarUrl: string | null;
  /** Quando entrou no sistema, no formato `yyyy-MM-dd`. */
  createdAt: string;
};

/** O que o bloco de clientes do painel mostra: o total e os mais novos, do último a entrar para trás. */
export type ClientsSummary = {
  total: number;
  clients: Client[];
};
