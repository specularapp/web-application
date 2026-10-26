"use client";

import type { CSSProperties } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { flowChannels, flowGroupLabels, flowSteps, type FlowStepGroup } from "../flow-catalog";
import type { FlowChannel, FlowStepKind } from "../types";
import { channelIcons, stepIcons } from "./icons";
import styles from "./flow-editor.module.css";

export type FlowStepChoice = { kind: FlowStepKind; channel?: FlowChannel };

const choices: (FlowStepChoice & { group: FlowStepGroup; label: string; description: string; hue: string })[] = [
  ...(["instagram", "whatsapp", "email"] as FlowChannel[]).map((channel) => ({
    kind: "message" as const,
    channel,
    group: "content" as const,
    label: `Mensagem no ${flowChannels[channel].label}`,
    description: channel === "email" ? "Assunto e texto, sem botões." : "Balões, botões e espera de resposta.",
    hue: flowChannels[channel].hue,
  })),
  ...(["input", "ai", "actions", "condition", "randomizer", "delay", "jump"] as FlowStepKind[]).map((kind) => ({ kind, group: flowSteps[kind].group, label: flowSteps[kind].label, description: flowSteps[kind].description, hue: flowSteps[kind].hue })),
];

const groups: FlowStepGroup[] = ["content", "ai", "logic"];

export type FlowStepPickerProps = {
  open: boolean;
  /** Quando vem de uma saída, o passo novo já nasce ligado a ela. */
  linked: boolean;
  onPick: (choice: FlowStepChoice) => void;
  onClose: () => void;
};

// O "escolha o próximo passo" do ManyChat, na janela da casa: os tipos em grupos (Conteúdo, IA e Lógica), cada
// um com o glifo no tom dele e a frase do que faz. Abre ao soltar uma ligação no vazio ou pelo dock.
export function FlowStepPicker({ open, linked, onPick, onClose }: FlowStepPickerProps) {
  return (
    <Dialog open={open} onClose={onClose} label={linked ? "Escolha o próximo passo" : "Adicionar passo"} size="sm" surface="solid">
      {open && <PickerBody linked={linked} onPick={onPick} onClose={onClose} />}
    </Dialog>
  );
}

function PickerBody({ linked, onPick, onClose }: Omit<FlowStepPickerProps, "open">) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  useFloatingActionsRegistration(mobile ? { cancel: { label: "Fechar", onClick: onClose } } : null);

  return (
    <div className={styles.picker}>
      <DialogHeader title={linked ? "Escolha o próximo passo" : "Adicionar passo"} description={linked ? "Ele já nasce ligado à saída de onde você veio" : "Ele aparece no meio do quadro"} onClose={onClose} />
      <div className={styles.pickerBody}>
        {groups.map((group) => (
          <section key={group} className={styles.pickerGroup} aria-label={flowGroupLabels[group]}>
            <h3 className={styles.pickerTitle}>{flowGroupLabels[group]}</h3>
            <ul className={styles.pickerList}>
              {choices
                .filter((choice) => choice.group === group)
                .map((choice) => {
                  const Glyph = choice.channel ? channelIcons[choice.channel] : stepIcons[choice.kind];
                  return (
                    <li key={`${choice.kind}-${choice.channel ?? ""}`}>
                      <button type="button" className={styles.pickerOption} style={{ "--hue": choice.hue } as CSSProperties} onClick={() => onPick({ kind: choice.kind, channel: choice.channel })}>
                        <span className={styles.nodeIcon} aria-hidden="true">
                          <Glyph weight="fill" />
                        </span>
                        <span className={styles.pickerCopy}>
                          <strong>{choice.label}</strong>
                          <small>{choice.description}</small>
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
