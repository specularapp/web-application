/**
 * Como o assistente responde. Dois modos, e não uma lista de modelos: o nome comercial do modelo muda a cada
 * versão que o provedor lança, e quem pergunta quer escolher entre a resposta que vem na hora e a que pensa
 * antes. O provedor entra no lugar do `id` quando a conversa existir de verdade.
 */
export type AiModelId = "fast" | "deep";

export type AiModel = {
  id: AiModelId;
  label: string;
  /** A linha de apoio no menu, dizendo para que serve o modo. */
  hint: string;
};

export const aiModels: readonly AiModel[] = [
  { id: "fast", label: "Rápido", hint: "Responde na hora, para perguntas diretas" },
  { id: "deep", label: "Avançado", hint: "Pensa antes de responder, para análise" },
];

export const defaultAiModel: AiModelId = "fast";

export const aiModel = (id: AiModelId) => aiModels.find((model) => model.id === id) ?? aiModels[0];
