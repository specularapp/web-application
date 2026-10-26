"use client";

import { ArrowBendUpLeftIcon, ChatTextIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { WhatsappText } from "../format";
import { fillTemplate, firstName } from "../inbox";
import type { MessageTemplate } from "../types";
import styles from "./whatsapp-dialogs.module.css";

export const categoryLabels: Record<MessageTemplate["category"], string> = { MARKETING: "Marketing", UTILITY: "Utilidade" };

/** O que já se sabe das variáveis: o nome do contato e quem atende. O resto a pessoa escreve. */
export function suggestValues(template: MessageTemplate, contactName: string, me: string) {
  return template.variables.map((label) => {
    if (label === "primeiro nome") return firstName(contactName);
    if (label === "nome completo") return contactName.trim();
    if (label === "atendente") return firstName(me);
    return "";
  });
}

/** A mensagem como chega no WhatsApp do contato: o cabeçalho, o corpo formatado, o rodapé e os botões. */
export function TemplatePreview({ template, values }: { template: MessageTemplate; values: string[] }) {
  const examples = template.variables.map((label, index) => values[index]?.trim() || `[${label}]`);
  return (
    <div className={styles.previewStage}>
      <div className={styles.previewStack}>
        <div className={styles.previewBubble}>
          {template.header && <strong className={styles.previewHeader}>{template.header}</strong>}
          <p>
            <WhatsappText text={fillTemplate(template.body, examples)} />
          </p>
          {template.footer && <small>{template.footer}</small>}
        </div>
        {template.buttons?.map((text) => (
          <span key={text} className={styles.previewButton}>
            <ArrowBendUpLeftIcon aria-hidden="true" /> {text}
          </span>
        ))}
      </div>
    </div>
  );
}

export type TemplateDialogProps = {
  open: boolean;
  templates: MessageTemplate[];
  contactName: string;
  me: string;
  onClose: () => void;
  onSend: (template: MessageTemplate, values: string[]) => void;
};

/**
 * A escolha do modelo aprovado: à esquerda os modelos e as variáveis, à direita a prévia de como chega ao contato. É o
 * único jeito de falar com quem está fora da janela de 24 horas.
 */
export function TemplateDialog({ open, ...rest }: TemplateDialogProps) {
  // A janela nasce de novo a cada abertura: modelo e variáveis recomeçam
  const [opening, setOpening] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOpening((value) => value + 1);
  }
  return (
    <Dialog open={open} onClose={rest.onClose} label="Enviar modelo aprovado" size="lg" surface="glass">
      <TemplateForm key={opening} {...rest} />
    </Dialog>
  );
}

function TemplateForm({ templates, contactName, me, onClose, onSend }: Omit<TemplateDialogProps, "open">) {
  const [chosenId, setChosenId] = useState(templates[0]?.id ?? null);
  const [edited, setEdited] = useState<Record<number, string>>({});
  const chosen = templates.find((template) => template.id === chosenId) ?? null;
  const suggested = chosen ? suggestValues(chosen, contactName, me) : [];
  const values = chosen ? chosen.variables.map((_, index) => edited[index] ?? suggested[index] ?? "") : [];
  const missing = values.some((value) => !value.trim());

  return (
    <>
      <DialogHeader title="Enviar modelo aprovado" description={`Para ${contactName}. Fora da janela de 24 horas, só modelo aprovado pela Meta.`} onClose={onClose} />
      {templates.length === 0 ? (
        <div className={styles.body}>
          <EmptyState icon={ChatTextIcon} size="sm" title="Nenhum modelo aprovado" description="Os modelos aprovados pela Meta aparecem aqui quando a conta do WhatsApp estiver conectada." />
        </div>
      ) : (
        <div className={styles.split}>
          <div className={styles.form}>
            <fieldset className={styles.choices}>
              <legend>Modelo</legend>
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={styles.choice}
                  aria-pressed={template.id === chosenId}
                  onClick={() => {
                    setChosenId(template.id);
                    setEdited({});
                  }}
                >
                  <span className={styles.choiceHead}>
                    <strong>{template.name}</strong>
                    <Badge size="sm" tone={template.category === "MARKETING" ? "purple" : "blue"}>
                      {categoryLabels[template.category]}
                    </Badge>
                  </span>
                  <span className={styles.choiceBody}>{template.body}</span>
                </button>
              ))}
            </fieldset>
            {chosen && chosen.variables.length > 0 && (
              <div className={styles.variables}>
                <Text as="h3" variant="subheadline" weight="semibold">
                  Variáveis
                </Text>
                {chosen.variables.map((label, index) => (
                  <Field key={`${chosen.id}-${label}`} label={`${index + 1}. ${label}`} required>
                    <Input value={values[index] ?? ""} maxLength={200} placeholder="Escreva aqui" onChange={(event) => setEdited((current) => ({ ...current, [index]: event.target.value }))} />
                  </Field>
                ))}
              </div>
            )}
          </div>
          <div className={styles.preview}>
            <Text as="span" variant="caption1" tone="secondary" weight="medium">
              Como chega no WhatsApp
            </Text>
            {chosen && <TemplatePreview template={chosen} values={values} />}
          </div>
        </div>
      )}
      <DialogFooter mobile="always">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={!chosen || missing} onClick={() => chosen && onSend(chosen, values)}>
          Enviar modelo
        </Button>
      </DialogFooter>
    </>
  );
}
