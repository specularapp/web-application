"use client";

import { BookmarkSimpleIcon, FileDashedIcon } from "@phosphor-icons/react";
import { useState, type CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { emailCategories, emailHues } from "../email-catalog";
import type { EmailSender, EmailTemplate } from "../types";
import { DeviceSwitch, type PreviewDevice } from "./device-switch";
import { EmailPreview } from "./email-preview";
import { categoryIcons } from "./icons";
import styles from "./email-templates.module.css";

export type TemplateGridProps = {
  templates: EmailTemplate[];
  sender: EmailSender;
  /** O que o clique no cartão faz: abrir a prévia, na aba de modelos, ou já começar o e-mail, ao criar. */
  onPick: (template: EmailTemplate) => void;
  /** Mostra o cartão de começar em branco antes dos modelos. */
  onBlank?: () => void;
  pickLabel: (template: EmailTemplate) => string;
};

// A vitrine dos modelos: a miniatura de verdade de cada um (o mesmo desenho da prévia, num degrau menor), a
// marca da categoria, o nome e de onde veio. Os salvos pela equipe vêm primeiro e levam o marcador.
export function TemplateGrid({ templates, sender, onPick, onBlank, pickLabel }: TemplateGridProps) {
  return (
    <ul className={styles.grid}>
      {onBlank && (
        <li>
          <button type="button" className={styles.card} onClick={onBlank}>
            <span className={styles.blank} aria-hidden="true">
              <FileDashedIcon weight="duotone" />
            </span>
            <span className={styles.meta}>
              <span className={styles.mark} style={{ "--hue": "var(--color-label-secondary)" } as CSSProperties} aria-hidden="true">
                <FileDashedIcon weight="duotone" />
              </span>
              <span className={styles.copy}>
                <strong>Começar em branco</strong>
                <small>Só o cabeçalho e o rodapé</small>
              </span>
            </span>
          </button>
        </li>
      )}
      {templates.map((template) => {
        const Glyph = template.custom ? BookmarkSimpleIcon : categoryIcons[template.category];
        return (
          <li key={template.id}>
            <button type="button" className={styles.card} aria-label={pickLabel(template)} onClick={() => onPick(template)}>
              <span className={styles.thumb} aria-hidden="true">
                <EmailPreview subject={template.subject} preheader={template.preheader} fromName={sender.name} fromEmail={sender.email} hue={template.hue} blocks={template.blocks} size="thumb" bare />
              </span>
              <span className={styles.meta}>
                <span className={styles.mark} style={{ "--hue": emailHues[template.hue].value } as CSSProperties} aria-hidden="true">
                  <Glyph weight="duotone" />
                </span>
                <span className={styles.copy}>
                  <strong>{template.name}</strong>
                  <small>{template.custom ? "Salvo pela equipe" : emailCategories[template.category]}</small>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export type TemplatePreviewDialogProps = {
  template: EmailTemplate | null;
  sender: EmailSender;
  onClose: () => void;
  onUse: (template: EmailTemplate) => void;
};

// A prévia de um modelo, no computador ou no celular, com o botão de usar no cabeçalho. No celular o usar e o
// fechar moram na barra flutuante, como em toda janela da casa.
export function TemplatePreviewDialog({ template, sender, onClose, onUse }: TemplatePreviewDialogProps) {
  return (
    <Dialog open={template !== null} onClose={onClose} label={template ? `Prévia de ${template.name}` : "Prévia do modelo"} size="lg" surface="solid">
      {template && <TemplatePreviewBody template={template} sender={sender} onClose={onClose} onUse={onUse} />}
    </Dialog>
  );
}

function TemplatePreviewBody({ template, sender, onClose, onUse }: Omit<TemplatePreviewDialogProps, "template"> & { template: EmailTemplate }) {
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const mobile = useMediaQuery(MOBILE_QUERY);
  useFloatingActionsRegistration(mobile ? { primary: { label: "Usar este modelo", onClick: () => onUse(template) }, cancel: { label: "Fechar", onClick: onClose } } : null);

  return (
    <div className={styles.dialog}>
      <DialogHeader
        title={template.name}
        description={template.description}
        onClose={onClose}
        actions={
          <>
            <span className={styles.wide}>
              <Badge size="sm">{template.custom ? "Salvo pela equipe" : emailCategories[template.category]}</Badge>
            </span>
            <DeviceSwitch value={device} onChange={setDevice} />
            <span className={styles.wide}>
              <Button size="sm" radius="md" onClick={() => onUse(template)}>
                Usar este modelo
              </Button>
            </span>
          </>
        }
      />
      <div className={styles.stage}>
        <EmailPreview subject={template.subject} preheader={template.preheader} fromName={sender.name} fromEmail={sender.email} hue={template.hue} blocks={template.blocks} size={device} />
      </div>
    </div>
  );
}
