"use client";

import { PlusIcon, XIcon } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { BrandIcon } from "@/components/ui/brand-icon";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { aiRemaining, aiShare, type AiUsage } from "../summary";
import styles from "./ai-usage-dialog.module.css";

export type AiUsageDialogProps = {
  usage: AiUsage;
  open: boolean;
  onClose: () => void;
};

const numberFormat = new Intl.NumberFormat("pt-BR");
const shortDate = (iso: string) => format(parseISO(iso), "d 'de' MMM.", { locale: ptBR });

/* A cor acompanha o quanto já foi: azul enquanto sobra, laranja passando de 70% e vermelho de 90%, para a
   pessoa ver o aperto antes de bater no teto. */
function toneOf(share: number): BadgeTone & ("accent" | "warning" | "danger") {
  if (share >= 0.9) return "danger";
  if (share >= 0.7) return "warning";
  return "accent";
}

// O resumo do uso da IA, aberto pelo widget do topo: a janela da casa, pequena e de vidro, centrada no
// desktop e bandeja no celular. Em cima quem responde e quando o ciclo vira; no meio o número grande do
// que já foi, a barra em dez degraus (a mesma régua do widget, só maior) e os fatos que sobram; embaixo o
// caminho para comprar mais, que leva ao plano. O uso chega por prop, então a janela não sabe de onde vem.
export function AiUsageDialog({ usage, open, onClose }: AiUsageDialogProps) {
  const share = aiShare(usage);
  const percent = Math.round(share * 100);
  const remaining = aiRemaining(usage);
  const tone = toneOf(share);

  return (
    <Dialog open={open} onClose={onClose} label="Uso da IA neste ciclo" size="sm" surface="glass" focusOnOpen={false}>
      <div className={styles.dialog}>
        <header className={styles.head}>
          <span className={styles.mark} aria-hidden="true">
            <BrandIcon name="openai" />
          </span>
          <div className={styles.heading}>
            <Text as="h2" variant="headline" weight="semibold">
              Uso da IA
            </Text>
            <Text variant="caption1" tone="secondary">
              Ciclo atual, renova em {shortDate(usage.renewsAt)}
            </Text>
          </div>
          <IconButton label="Fechar" variant="ghost" size="sm" onClick={onClose}>
            <XIcon />
          </IconButton>
        </header>

        <div className={styles.body}>
          <div className={styles.summary}>
            <Text as="p" variant="largeTitle" weight="bold" numeric className={styles.used}>
              {numberFormat.format(usage.used)}
            </Text>
            <Text as="p" variant="subheadline" tone="secondary" className={styles.of}>
              de {numberFormat.format(usage.limit)} ações usadas
            </Text>
            <Badge tone={tone} size="md" className={styles.share}>
              {percent}%
            </Badge>
          </div>

          <Progress value={usage.used} max={usage.limit} tone={tone} size="md" segments={10} aria-label={`${usage.used} de ${usage.limit} ações de IA usadas neste ciclo`} />

          <dl className={styles.facts}>
            <div className={styles.fact}>
              <Text as="dt" variant="caption1" tone="secondary">
                Restantes
              </Text>
              <Text as="dd" variant="headline" weight="semibold" numeric className={styles.value}>
                {numberFormat.format(remaining)}
              </Text>
            </div>
            <div className={styles.fact}>
              <Text as="dt" variant="caption1" tone="secondary">
                Renova em
              </Text>
              <Text as="dd" variant="headline" weight="semibold" className={styles.value}>
                {shortDate(usage.renewsAt)}
              </Text>
            </div>
          </dl>

          <Text variant="footnote" tone="secondary">
            Créditos extras entram na hora e valem até o fim do ciclo.
          </Text>
        </div>

        <footer className={styles.foot}>
          <Button href="/configuracoes/plano" size="md" radius="md" fullWidth iconStart={<PlusIcon />}>
            Adicionar créditos
          </Button>
        </footer>
      </div>
    </Dialog>
  );
}
