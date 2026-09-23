import type { IntakeFormStatus, IntakeProfileField, IntakeQuestionType } from "./summary";

export const formStatusLabels: Record<IntakeFormStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
  closed: "Encerrado",
};

export const questionTypeLabels: Record<IntakeQuestionType, string> = {
  short_text: "Resposta curta",
  long_text: "Resposta longa",
  email: "E-mail",
  phone: "Telefone",
  single_choice: "Uma opção",
  multiple_choice: "Várias opções",
  date: "Data",
};

export const questionTypeOptions = Object.entries(questionTypeLabels).map(([value, label]) => ({
  value: value as IntakeQuestionType,
  label,
}));

export const profileFieldLabels: Record<IntakeProfileField, string> = {
  name: "Nome do cliente",
  email: "E-mail do cliente",
  phone: "Telefone do cliente",
  company: "Empresa",
  role: "Cargo",
  city: "Cidade",
  website: "Site",
  about: "Sobre o cliente",
};

export const profileFieldOptions = [
  { value: "none", label: "Não atualizar cadastro" },
  ...Object.entries(profileFieldLabels).map(([value, label]) => ({ value: value as IntakeProfileField, label })),
];
