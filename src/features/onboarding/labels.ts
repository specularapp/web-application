import type { MemberRole, OrganizationIndustry } from "@/features/organizations/schemas";

export const roleLabels: Record<MemberRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
};

export const roleHints: Record<MemberRole, string> = {
  owner: "Controle total, inclusive cobrança e exclusão do time",
  admin: "Gerencia pessoas e conteúdo, sem mexer na cobrança",
  member: "Trabalha nos projetos do time",
};

export const industryLabels: Record<OrganizationIndustry, string> = {
  design: "Design",
  development: "Desenvolvimento",
  marketing: "Marketing",
  audiovisual: "Audiovisual",
  architecture: "Arquitetura",
  consulting: "Consultoria",
  other: "Outra área",
};

export const industryOptions = (Object.keys(industryLabels) as OrganizationIndustry[]).map((value) => ({
  value,
  label: industryLabels[value],
}));

export const invitableRoleOptions = (["admin", "member"] as const).map((value) => ({
  value,
  label: roleLabels[value],
}));

export const memberRoleOptions = (["owner", "admin", "member"] as const).map((value) => ({
  value,
  label: roleLabels[value],
}));
