export type AuthHero = {
  colors: string[];
  eyebrow: string;
  title: string;
  description: string;
};

export const authHero: AuthHero = {
  colors: ["var(--color-bg)", "var(--sys-gray-2)", "var(--color-label)"],
  eyebrow: "Specular",
  title: "Sua empresa inteira, do primeiro contato ao recebimento.",
  description: "CRM, orçamentos, contratos, cobrança, projetos e portfólio em um só lugar, para freelancers e agências.",
};
