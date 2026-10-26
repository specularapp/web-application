"use client";

import { ChatCircleDotsIcon, ClockCounterClockwiseIcon, FileDashedIcon, BrowserIcon, InstagramLogoIcon, StarIcon, WhatsappLogoIcon, type Icon } from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { flowStarters } from "../flow-catalog";
import type { FlowStarterId } from "../types";
import styles from "./new-flow-dialog.module.css";

const starterLooks: Record<FlowStarterId, { icon: Icon; hue: string }> = {
  "ig-comment": { icon: InstagramLogoIcon, hue: "var(--sys-pink)" },
  "ig-dm": { icon: ChatCircleDotsIcon, hue: "var(--sys-purple)" },
  "ig-story": { icon: StarIcon, hue: "var(--sys-orange)" },
  "wa-keyword": { icon: WhatsappLogoIcon, hue: "var(--color-whatsapp)" },
  "site-form": { icon: BrowserIcon, hue: "var(--sys-blue)" },
  reactivation: { icon: ClockCounterClockwiseIcon, hue: "var(--sys-teal)" },
  blank: { icon: FileDashedIcon, hue: "var(--color-label-secondary)" },
};

const order: FlowStarterId[] = ["ig-comment", "ig-dm", "ig-story", "wa-keyword", "site-form", "reactivation", "blank"];

export type NewFlowDialogProps = { open: boolean; onClose: () => void };

// O começo de um fluxo: os modelos prontos (comentário que vira direct, palavra-chave, story, WhatsApp,
// formulário do site, reativação) e o começar do zero. Escolher abre o construtor com o gatilho e a primeira
// mensagem já ligados.
export function NewFlowDialog({ open, onClose }: NewFlowDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} label="Novo fluxo" size="md" surface="solid">
      {open && <Body onClose={onClose} />}
    </Dialog>
  );
}

function Body({ onClose }: { onClose: () => void }) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  useFloatingActionsRegistration(mobile ? { cancel: { label: "Fechar", onClick: onClose } } : null);

  return (
    <div className={styles.dialog}>
      <DialogHeader title="Novo fluxo" description="Comece por um modelo e ajuste tudo no construtor" onClose={onClose} />
      <ul className={styles.list}>
        {order.map((id) => {
          const starter = flowStarters[id];
          const look = starterLooks[id];
          return (
            <li key={id}>
              <Link href={`/marketing/fluxos/novo?modelo=${id}` as Route} className={styles.option} style={{ "--hue": look.hue } as CSSProperties} data-blank={id === "blank" || undefined}>
                <span className={styles.glyph} aria-hidden="true">
                  <look.icon weight="duotone" />
                </span>
                <span className={styles.copy}>
                  <strong>{starter.label}</strong>
                  <small>{starter.description}</small>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
