"use client";

import { ArrowRightIcon, CheckIcon, FlowArrowIcon, XIcon } from "@phosphor-icons/react";
import { useId, useRef, useState, type RefObject } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { callAction } from "@/lib/action";
import { rounded } from "@/lib/corners";
import { createAutomationAction } from "../actions";
import { nodeCatalog } from "../catalog";
import { automationTemplates } from "../templates";
import { triggerOf } from "../templates";
import { FlowStrip } from "./flow-strip";
import styles from "./new-automation-dialog.module.css";

export type NewAutomationDialogProps = {
  open: boolean;
  /** Os modelos que já viraram automação na conta, para o cartão dizer "instalado" (pode instalar de novo). */
  installed: string[];
  onClose: () => void;
  /** A automação nasceu: quem monta leva a pessoa para o editor dela. */
  onCreated: (id: string) => void;
};

// A janela de nova automação (2026-09-15, com as peças da casa, no espírito da galeria de modelos do
// contrato): "Do zero" em destaque, que abre o quadro vazio, e embaixo os modelos da casa em cartões com a
// trilha do fluxo, o gatilho, o nome e a descrição. Escolher cria na hora e abre o editor. No celular é a
// bandeja da casa. Tem endereço (`/automacoes/nova`).
export function NewAutomationDialog({ open, installed, onClose, onCreated }: NewAutomationDialogProps) {
  /* Escape e o clique fora chamam o mesmo onClose do Dialog: sem essa trava, fechar durante a criação
     deixa a promessa correndo, e quando ela volta a pessoa é levada para o editor de uma automação que
     achava ter cancelado (padrão de `new-contract-dialog.tsx`). */
  const workingRef = useRef(false);
  const close = () => {
    if (!workingRef.current) onClose();
  };

  return (
    <Dialog open={open} onClose={close} label="Nova automação" size="lg" focusOnOpen={false}>
      <Chooser installed={installed} onClose={onClose} onCreated={onCreated} workingRef={workingRef} />
    </Dialog>
  );
}

function Chooser({
  installed,
  onClose,
  onCreated,
  workingRef,
}: Omit<NewAutomationDialogProps, "open"> & { workingRef: RefObject<boolean> }) {
  const { toast } = useToast();
  const titleId = useId();
  const [busy, setBusy] = useState<string | null>(null);

  const close = () => {
    if (!workingRef.current) onClose();
  };

  useFloatingActionsRegistration({ cancel: { label: "Fechar", onClick: close } });

  const create = async (templateId: string | null) => {
    if (workingRef.current) return;
    workingRef.current = true;
    setBusy(templateId ?? "blank");
    const result = await callAction(createAutomationAction({ templateId }));
    workingRef.current = false;
    setBusy(null);
    if (!result.ok) {
      toast({ title: "Não deu para criar", description: result.error, tone: "danger" });
      return;
    }
    onCreated(result.id);
  };

  return (
    <div className={styles.dialog} aria-labelledby={titleId}>
      <header className={styles.head}>
        <div className={styles.heading}>
          <Text as="h2" id={titleId} variant="headline" weight="semibold">
            Nova automação
          </Text>
          <Text variant="footnote" tone="secondary">
            Comece por um modelo da casa e mude o que quiser, ou monte o fluxo do zero.
          </Text>
        </div>
        <IconButton label="Fechar" variant="ghost" size="sm" disabled={busy !== null} onClick={close}>
          <XIcon />
        </IconButton>
      </header>

      <div className={styles.body}>
        <button type="button" className={styles.blank} disabled={busy !== null} aria-busy={busy === "blank" || undefined} onClick={() => void create(null)} {...rounded("lg")}>
          <span className={styles.blankGlyph} aria-hidden="true" {...rounded("md")}>
            {busy === "blank" ? <Spinner size="sm" label="" /> : <FlowArrowIcon weight="duotone" />}
          </span>
          <span className={styles.blankCopy}>
            <Text as="span" variant="subheadline" weight="semibold">
              Do zero
            </Text>
            <Text as="span" variant="footnote" tone="secondary">
              O quadro vazio: escolha o gatilho, ligue os passos e escreva os e-mails.
            </Text>
          </span>
          <ArrowRightIcon className={styles.arrow} weight="bold" aria-hidden="true" />
        </button>

        <Text as="h3" variant="caption1" weight="semibold" tone="secondary" className={styles.groupTitle}>
          Modelos da casa
        </Text>
        <ul className={styles.gallery}>
          {automationTemplates.map((template) => {
            const trigger = triggerOf(template.nodes);
            const has = installed.includes(template.id);
            const creating = busy === template.id;
            return (
              <li key={template.id}>
                <button type="button" className={styles.template} disabled={busy !== null} aria-busy={creating || undefined} aria-label={`Usar o modelo ${template.name}`} onClick={() => void create(template.id)} {...rounded("lg")}>
                  <span className={styles.templateHead}>
                    <FlowStrip nodes={template.nodes} edges={template.edges} limit={4} />
                    {creating ? (
                      <Spinner size="sm" label="Criando" />
                    ) : has ? (
                      <Badge tone="neutral" variant="soft" size="sm" icon={<CheckIcon />}>
                        Instalado
                      </Badge>
                    ) : null}
                  </span>
                  <Text as="span" variant="subheadline" weight="semibold">
                    {template.name}
                  </Text>
                  <Text as="span" variant="footnote" tone="secondary" className={styles.summary}>
                    {template.description}
                  </Text>
                  {trigger && (
                    <Text as="span" variant="caption1" tone="tertiary" className={styles.trigger}>
                      Começa em: {nodeCatalog[trigger.kind].label}
                    </Text>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
