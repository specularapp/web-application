"use client";

import { useRef, useState } from "react";
import { StageSettingsDialog, type StageRow } from "@/components/ui/stage-settings";
import { callAction } from "@/lib/action";
import { configureFunnelStagesAction } from "../actions";
import {
  crmStageValues,
  defaultCrmStages,
  defaultStageDefinition,
  stageKind,
  type CrmHue,
  type CrmStageDefinition,
  type CrmStageKind,
} from "../stages";
import { crmColorOptions } from "./crm-appearance-dialog";

type Props = {
  id: string;
  name: string;
  stages: string[];
  definitions?: CrmStageDefinition[];
  onClose: () => void;
  onSaved?: () => void;
};
type Draft = CrmStageDefinition & { originalId?: string };
const kindOptions: { value: CrmStageKind; label: string }[] = [
  { value: "open", label: "Em aberto" },
  { value: "won", label: "Venda ganha" },
  { value: "lost", label: "Venda perdida" },
];

export function FunnelStagesDialog(props: Props) {
  const busyRef = useRef(false);
  const close = () => {
    if (!busyRef.current) props.onClose();
  };
  return <StageForm {...props} onClose={close} busyRef={busyRef} />;
}

function StageForm({
  id,
  name,
  stages,
  definitions = [],
  onClose,
  onSaved,
  busyRef,
}: Props & { busyRef: React.RefObject<boolean> }) {
  const definitionOf = (key: string) =>
    definitions.find((entry) => entry.id === key) ??
    defaultStageDefinition(key);
  const [draft, setDraft] = useState<Draft[]>(() =>
    stages.map((key) => ({ ...definitionOf(key), originalId: key })),
  );
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const removed = stages.filter(
    (key) =>
      !draft.some((entry) => entry.originalId === key || entry.id === key),
  );
  const save = async () => {
    if (busyRef.current) return;
    const destinations = { ...replacements };
    for (const entry of draft)
      if (entry.originalId && entry.originalId !== entry.id)
        destinations[entry.originalId] = entry.id;
    if (
      removed.some(
        (key) => !draft.some((entry) => entry.id === destinations[key]),
      )
    ) {
      setError("Escolha para onde vão as oportunidades de cada etapa removida");
      return;
    }
    busyRef.current = true;
    setSaving(true);
    setError(undefined);
    const result = await callAction(
      configureFunnelStagesAction({
        id,
        stages: draft.map(({ id: key, label, hue }) => ({
          id: key,
          label,
          hue,
        })),
        replacements: destinations,
      }),
    );
    busyRef.current = false;
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved?.();
    onClose();
  };
  /* A tela é o primitivo `StageSettingsDialog` (2026-09-22): a mesma janela serve o funil e o quadro de
     tarefas, e o que era desenho saiu daqui. O que fica é o que só o funil sabe: o id da etapa carrega o
     desfecho dela, então mudar de "em aberto" para "ganha" é trocar o id, e é isso que o `onRowsChange` faz ao remontar cada linha. */
  return (
    <StageSettingsDialog
      name={name}
      rows={draft.map((entry): StageRow => ({ key: entry.originalId ?? entry.id, label: entry.label, hue: entry.hue, aspect: stageKind(entry.id) }))}
      onRowsChange={(rows: StageRow[]) =>
        setDraft(
          rows.map((row): CrmStageDefinition & { originalId?: string } => {
            const found = draft.find((entry) => (entry.originalId ?? entry.id) === row.key);
            if (!found) return draft[0];
            const kind = row.aspect as CrmStageKind;
            const changedKind = kind !== stageKind(found.id);
            const customId = crmStageValues.some((key) => key === found.id) || changedKind;
            return {
              ...found,
              label: row.label,
              hue: row.hue as CrmHue,
              id: customId ? `${kind}_${crypto.randomUUID()}` : found.id,
            };
          }),
        )
      }
      colorOptions={crmColorOptions}
      aspect={{ label: "Resultado", options: kindOptions }}
      itemsLabel="oportunidades"
      removals={removed.map((key) => ({ key, label: definitionOf(key).label }))}
      destinations={replacements}
      onDestinationChange={(key: string, to: string) => setReplacements((current) => ({ ...current, [key]: to }))}
      onAdd={() => setDraft((current) => [...current, { id: `open_${crypto.randomUUID()}`, label: "", hue: "blue" }])}
      onReset={() =>
        setDraft(defaultCrmStages.map((key) => ({ ...defaultStageDefinition(key), originalId: stages.includes(key) ? key : undefined })))
      }
      saving={saving}
      error={error}
      onClose={onClose}
      onSave={() => void save()}
    />
  );
}
