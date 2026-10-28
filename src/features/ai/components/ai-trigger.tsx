"use client";

import { IconButton } from "@/components/ui/icon-button";
import { Tooltip } from "@/components/ui/tooltip";
import { AiMark } from "./ai-mark";
import { useAiPanel } from "./ai-panel-context";

const usageLabel = (used: number, limit: number) => `${used} de ${limit} ações de IA usadas neste ciclo`;

/**
 * O botão que abre e fecha a coluna do SpeculAI, no pé do menu lateral, ao lado do sino (2026-10-27, a pedido:
 * "remova esse header de todas as páginas"). Morava no topo de cada página, com a régua de uso; sem o topo, a
 * marca da casa vai para cá e o uso do ciclo fica na dica e na leitura por voz. Sem a concha em volta não há
 * coluna para abrir, e o botão não aparece.
 */
export function AiTrigger({ size = "sm" }: { size?: "sm" | "md" }) {
  const panel = useAiPanel();
  if (!panel?.data) return null;

  const { used, limit } = panel.data.usage;
  const label = `${panel.open ? "Fechar" : "Abrir"} o SpeculAI. ${usageLabel(used, limit)}`;

  return (
    <Tooltip content={usageLabel(used, limit)}>
      <IconButton label={label} variant="ghost" size={size} aria-pressed={panel.open} onClick={panel.toggle}>
        <AiMark size={size === "md" ? 18 : 16} />
      </IconButton>
    </Tooltip>
  );
}
