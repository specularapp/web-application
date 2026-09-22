import type { Icon } from "@phosphor-icons/react";
import {
  ChatCircleTextIcon,
  HandshakeIcon,
  ProhibitIcon,
  ReceiptIcon,
  SealCheckIcon,
  TrophyIcon,
  UserPlusIcon,
} from "@phosphor-icons/react/ssr";

export const crmStageValues = ["lead", "contact", "qualified", "proposal", "negotiation", "won", "lost"] as const;

export type CrmStage = string;

/**
 * Em que pé a oportunidade está. Diferente das tarefas, aqui o fim tem **dois lados**: fechar vendendo e
 * fechar perdendo são os dois desfechos do funil, e tratar os dois como "concluído" faria a contagem do menu
 * e a taxa de conversão mentirem.
 */
export type CrmStageKind = "open" | "won" | "lost";

/** Uma etapa como a coluna a desenha: o nome, o glifo do cabeçalho, o matiz da etiqueta e o desfecho. */
export type CrmStageMeta = {
  id: CrmStage;
  label: string;
  icon: Icon;
  /** Token de cor, como no `NavGroup`: a coluna o passa por variável e a etiqueta se tinge sozinha. */
  hue: string;
  kind: CrmStageKind;
};

/* O matiz esquenta conforme a venda anda: cinza em quem acabou de chegar, azul no primeiro contato, ciano em
   quem já se sabe que serve, laranja com a proposta na mão do cliente, índigo na conversa de preço e prazo,
   verde no ganho e vermelho no perdido. É a mesma leitura de cor das etiquetas da casa. */
export const crmStageMeta: Record<CrmStage, CrmStageMeta> = {
  lead: { id: "lead", label: "Novo lead", icon: UserPlusIcon, hue: "var(--sys-gray)", kind: "open" },
  contact: { id: "contact", label: "Em contato", icon: ChatCircleTextIcon, hue: "var(--sys-blue)", kind: "open" },
  qualified: { id: "qualified", label: "Qualificado", icon: SealCheckIcon, hue: "var(--sys-cyan)", kind: "open" },
  proposal: { id: "proposal", label: "Proposta enviada", icon: ReceiptIcon, hue: "var(--sys-orange)", kind: "open" },
  negotiation: { id: "negotiation", label: "Negociação", icon: HandshakeIcon, hue: "var(--sys-indigo)", kind: "open" },
  won: { id: "won", label: "Ganho", icon: TrophyIcon, hue: "var(--sys-green)", kind: "won" },
  lost: { id: "lost", label: "Perdido", icon: ProhibitIcon, hue: "var(--sys-red)", kind: "lost" },
};

/** O catálogo inteiro na ordem do caminho, que é a ordem em que as colunas aparecem quando não há funil. */
export const crmStages: CrmStageMeta[] = crmStageValues.map((id) => crmStageMeta[id]);

/**
 * As etapas de um funil que não diz outra coisa: as seis de sempre, sem a qualificação, que é de quem
 * precisa filtrar quem chega antes de investir tempo escrevendo proposta.
 */
export const defaultCrmStages: CrmStage[] = ["lead", "contact", "proposal", "negotiation", "won", "lost"];

export const crmHues = ["red", "orange", "yellow", "green", "mint", "teal", "cyan", "blue", "indigo", "purple", "pink", "brown", "gray"] as const;
export type CrmHue = (typeof crmHues)[number];
export type CrmStageDefinition = { id: string; label: string; hue: CrmHue };
export const stageKind = (id: string): CrmStageKind => id === "won" || id.startsWith("won_") ? "won" : id === "lost" || id.startsWith("lost_") ? "lost" : "open";
export const defaultStageDefinition = (id: string): CrmStageDefinition => ({ id, label: crmStageMeta[id]?.label ?? "Etapa", hue: (crmStageMeta[id]?.hue.match(/--sys-([a-z]+)/)?.[1] as CrmHue) ?? "blue" });
export function stageMetadata(definitions: CrmStageDefinition[]): Record<string, CrmStageMeta> {
  return { ...crmStageMeta, ...Object.fromEntries(definitions.map((stage) => [stage.id, { ...stage, kind: stageKind(stage.id), hue: `var(--sys-${stage.hue})`, icon: crmStageMeta[stage.id]?.icon ?? (stageKind(stage.id) === "won" ? TrophyIcon : stageKind(stage.id) === "lost" ? ProhibitIcon : ChatCircleTextIcon) }])) };
}
