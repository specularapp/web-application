"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { StageSettingsDialog, Swatch, type StageRow } from "@/components/ui/stage-settings";
import { callAction } from "@/lib/action";
import { configureTaskStagesAction } from "../actions";
import { paletteHueValues } from "../schemas";
import { stageKindLabels, stageKindValues, type TaskStage, type TaskStageKind } from "../stages";
import { randomId } from "@/lib/utils/id";

/**
 * As etapas do quadro de tarefas, na **mesma janela do funil de vendas** (2026-09-22, a pedido: "precisa
 * pegar literalmente o component de etapas do funil"). A tela é o primitivo `StageSettingsDialog`; aqui fica
 * só o que é de tarefa: o rascunho, o que cada coluna significa e a gravação.
 *
 * Uma diferença de regra entre os dois domínios: no funil o desfecho está no id da etapa, e trocá-lo cria um
 * id novo; aqui a etapa é linha de tabela com id próprio, e o que ela significa é uma coluna como as outras.
 */

const hueNames: Record<string, string> = {
  red: "Vermelho",
  orange: "Laranja",
  yellow: "Amarelo",
  green: "Verde",
  mint: "Menta",
  teal: "Turquesa",
  cyan: "Ciano",
  blue: "Azul",
  indigo: "Índigo",
  purple: "Roxo",
  pink: "Rosa",
  brown: "Marrom",
  gray: "Cinza",
};

/** As cores com a amostra ao lado do nome, como no seletor do funil. */
export const stageColorOptions = paletteHueValues.map((value) => ({
  value: value as string,
  label: hueNames[value] ?? value,
  media: <Swatch hue={value} />,
}));

const kindOptions = stageKindValues.map((value) => ({ value: value as string, label: stageKindLabels[value] }));

export type StagesDialogProps = {
  open: boolean;
  /** O nome do quadro cujas etapas estão sendo arrumadas. */
  name: string;
  /** As etapas de hoje, na ordem em que viram colunas. */
  stages: TaskStage[];
  /** O quadro de um projeto: o que ficar na tabela vira coluna dele. Nulo é o catálogo da equipe. */
  projectId?: string | null;
  onClose: () => void;
  onSaved?: () => void;
};

type Draft = { key: string; id?: string; label: string; hue: string; aspect: string };

export function StagesDialog({ open, name, stages, projectId, onClose, onSaved }: StagesDialogProps) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Draft[]>(() =>
    stages.map((stage) => ({ key: stage.id, id: stage.id, label: stage.name, hue: stage.hue, aspect: stage.kind })),
  );
  const [destinations, setDestinations] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  /* As que saíram da tabela: elas ainda existem no banco, e cada uma precisa dizer para onde vão as tarefas
     que estavam nela, que é o que o banco cobra ao apagar. */
  const removed = stages.filter((stage) => !draft.some((entry) => entry.id === stage.id));

  const save = async () => {
    if (saving) return;

    if (draft.some((entry) => !entry.label.trim())) {
      setError("Toda etapa precisa de um nome.");
      return;
    }

    const pending = removed.filter((stage) => !destinations[stage.id]);
    if (pending.length > 0) {
      setError(`Escolha para onde vão as tarefas de ${pending.map((stage) => stage.name).join(", ")}.`);
      return;
    }

    setSaving(true);
    setError(null);

    /* O destino escolhido é a chave da linha na tabela; a que é nova ainda não tem id, então ela não pode
       receber tarefas nesta gravação, e o zod recusaria um destino que não é uuid. */
    const moveTo = (key: string) => draft.find((entry) => entry.key === key)?.id ?? null;

    const result = await callAction(
      configureTaskStagesAction({
        stages: draft.map((entry) => ({ id: entry.id, name: entry.label.trim(), hue: entry.hue, glyph: "circle-dashed", kind: entry.aspect as TaskStageKind })),
        removals: removed.map((stage) => ({ id: stage.id, moveTo: moveTo(destinations[stage.id]) })),
        projectId: projectId ?? null,
      }),
    );

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast({ title: "Etapas salvas", description: `O quadro de ${name} já está com as colunas novas.`, tone: "success" });
    onSaved?.();
    onClose();
  };

  return (
    <StageSettingsDialog
      name={name}
      rows={draft.map((entry): StageRow => ({ key: entry.key, label: entry.label, hue: entry.hue, aspect: entry.aspect }))}
      onRowsChange={(rows: StageRow[]) =>
        setDraft(
          rows.map((row) => {
            const found = draft.find((entry) => entry.key === row.key);
            return { key: row.key, id: found?.id, label: row.label, hue: row.hue, aspect: row.aspect };
          }),
        )
      }
      colorOptions={stageColorOptions}
      aspect={{ label: "Significa", options: kindOptions }}
      itemsLabel="tarefas"
      removals={removed.map((stage) => ({ key: stage.id, label: stage.name }))}
      destinations={destinations}
      onDestinationChange={(key: string, to: string) => setDestinations((current) => ({ ...current, [key]: to }))}
      onAdd={() =>
        setDraft((current) => [...current, { key: `nova-${randomId()}`, label: "", hue: "blue", aspect: "ongoing" }])
      }
      max={60}
      saving={saving}
      error={error}
      onClose={onClose}
      onSave={() => void save()}
    />
  );
}
