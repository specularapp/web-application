import type { Route } from "next";

/**
 * As ações da paleta: criar um registro sem passar pela lista dele. Cada uma aponta a página de criar e o
 * quadro de onde ela sai, e é desse quadro, achado em `nav.ts`, que vêm a seção e o matiz da etiqueta: a cor
 * de uma seção mora onde a seção nasce. Só entra o que tem página própria de criar, porque é o endereço
 * tipado por rota que garante que a ação existe.
 */
export type PaletteCommand = { label: string; href: Route; list: Route };

export const createCommands: PaletteCommand[] = [
  { label: "Novo cliente", href: "/clientes/novo", list: "/clientes" },
  { label: "Novo fornecedor", href: "/fornecedores/novo", list: "/fornecedores" },
  { label: "Novo orçamento", href: "/orcamentos/novo", list: "/orcamentos" },
  { label: "Novo contrato", href: "/contratos/novo", list: "/contratos" },
  { label: "Nova cobrança", href: "/cobrancas/nova", list: "/cobrancas" },
  { label: "Nova despesa", href: "/despesas/nova", list: "/despesas" },
  { label: "Novo projeto", href: "/projetos/novo", list: "/projetos" },
  { label: "Novo produto ou serviço", href: "/catalogo/novo", list: "/catalogo" },
  { label: "Novo formulário", href: "/formularios/novo", list: "/formularios" },
  { label: "Nova automação", href: "/automacoes/nova", list: "/automacoes" },
];
