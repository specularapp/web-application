import type { AiUsage } from "./summary";

/**
 * Uso de exemplo enquanto o domínio não existe no banco. Quem montar a contagem troca só a origem: o
 * widget recebe o uso por prop e não sabe de onde ele vem.
 */
export const previewAiUsage: AiUsage = { used: 128, limit: 500 };
