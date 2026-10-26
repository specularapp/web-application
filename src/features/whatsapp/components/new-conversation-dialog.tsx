"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { onlyDigits } from "@/lib/masks";
import type { MessageTemplate, WhatsappConversation } from "../types";
import { categoryLabels, suggestValues, TemplatePreview } from "./template-dialog";
import styles from "./whatsapp-dialogs.module.css";

export type NewConversationInput = { phone: string; name: string; template: MessageTemplate; values: string[] };

export type NewConversationDialogProps = {
  open: boolean;
  templates: MessageTemplate[];
  /** As conversas que já existem: o número que já conversa abre a conversa dele, sem enviar nada. */
  conversations: WhatsappConversation[];
  me: string;
  onClose: () => void;
  onStart: (input: NewConversationInput) => void;
  onOpenExisting: (conversationId: string) => void;
};

/** O número completo, com o código do país, como o WhatsApp guarda. */
const withCountry = (phone: string) => `55${onlyDigits(phone)}`;

/**
 * A nova conversa pelo número: à esquerda o número, o nome, o modelo e as variáveis; à direita a prévia. Quem não falou
 * com a equipe nas últimas 24 horas só recebe modelo aprovado, então a conversa começa por um.
 */
export function NewConversationDialog({ open, ...rest }: NewConversationDialogProps) {
  const [opening, setOpening] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOpening((value) => value + 1);
  }
  return (
    <Dialog open={open} onClose={rest.onClose} label="Nova conversa" size="lg" surface="glass">
      <NewConversationForm key={opening} {...rest} />
    </Dialog>
  );
}

function NewConversationForm({ templates, conversations, me, onClose, onStart, onOpenExisting }: Omit<NewConversationDialogProps, "open">) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [chosenId, setChosenId] = useState(templates[0]?.id ?? "");
  const [edited, setEdited] = useState<Record<number, string>>({});

  const digits = onlyDigits(phone);
  const valid = digits.length >= 10 && digits.length <= 11;
  const existing = valid ? (conversations.find((conversation) => conversation.contact.phone === withCountry(phone)) ?? null) : null;
  const chosen = templates.find((template) => template.id === chosenId) ?? null;
  const suggested = chosen ? suggestValues(chosen, name, me) : [];
  const values = chosen ? chosen.variables.map((_, index) => edited[index] ?? suggested[index] ?? "") : [];
  const missing = values.some((value) => !value.trim());
  const blocked = !valid || (!existing && (!chosen || missing));

  const submit = () => {
    if (existing) return onOpenExisting(existing.id);
    if (!chosen || !valid) return;
    onStart({ phone: withCountry(phone), name: name.trim(), template: chosen, values });
  };

  return (
    <>
      <DialogHeader title="Nova conversa" description="Chame alguém pelo número, começando por um modelo aprovado." onClose={onClose} />
      <div className={styles.split}>
        <div className={styles.form}>
          <section className={styles.part}>
            <Text as="h3" variant="subheadline" weight="semibold">
              Contato
            </Text>
            <Field label="Número do WhatsApp" required>
              <Input mask="phone" value={phone} placeholder="(11) 99999-9999" autoComplete="off" onChange={(event) => setPhone(event.target.value)} />
            </Field>
            <Field label="Nome">
              <Input value={name} maxLength={160} placeholder="Como o contato aparece na lista" autoComplete="off" onChange={(event) => setName(event.target.value)} />
            </Field>
            {existing && (
              <p className={styles.hint} role="status">
                Já existe conversa com {existing.contact.name}. O botão abre essa conversa, sem enviar nada.
              </p>
            )}
          </section>

          {!existing && (
            <section className={styles.part}>
              <Text as="h3" variant="subheadline" weight="semibold">
                Modelo
              </Text>
              <Field label="Modelo aprovado">
                <Select
                  label="Modelo aprovado"
                  value={chosenId}
                  options={templates.map((template) => ({ value: template.id, label: template.name, caption: categoryLabels[template.category] }))}
                  onChange={(id) => {
                    setChosenId(id);
                    setEdited({});
                  }}
                />
              </Field>
              {chosen?.variables.map((label, index) => (
                <Field key={`${chosen.id}-${label}`} label={`${index + 1}. ${label}`} required>
                  <Input value={values[index] ?? ""} maxLength={200} placeholder="Escreva aqui" onChange={(event) => setEdited((current) => ({ ...current, [index]: event.target.value }))} />
                </Field>
              ))}
            </section>
          )}
        </div>

        <div className={styles.preview}>
          <Text as="span" variant="caption1" tone="secondary" weight="medium">
            Como chega no WhatsApp
          </Text>
          {existing ? (
            <p className={styles.hint}>A conversa com {existing.contact.name} já existe. Abra para continuar por lá.</p>
          ) : chosen ? (
            <TemplatePreview template={chosen} values={values} />
          ) : (
            <p className={styles.hint}>Escolha o modelo para ver a mensagem.</p>
          )}
        </div>
      </div>
      <DialogFooter mobile="always">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={blocked} onClick={submit}>
          {existing ? "Abrir conversa" : "Enviar e abrir conversa"}
        </Button>
      </DialogFooter>
    </>
  );
}
