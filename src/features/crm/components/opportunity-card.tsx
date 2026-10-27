"use client";

import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import { CalendarBlankIcon, HourglassIcon, ThermometerIcon } from "@phosphor-icons/react";
import { memo, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SuccessOverlay } from "@/components/ui/success-mark";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { compactMoney } from "@/lib/utils/format";
import { rounded, roundedAuto } from "@/lib/corners";
import { expectedOf, isStale, temperatureHues, temperatureLabels, touchLabel } from "../labels";
import type { CrmStage } from "../stages";
import type { Opportunity } from "../summary";
import { OpportunityMenu } from "./opportunity-menu";
import styles from "./opportunity-card.module.css";

export type OpportunityCardDrag = {
  /** O nó que o arraste mede, no invólucro do cartão. */
  ref: (node: HTMLElement | null) => void;
  listeners?: DraggableSyntheticListeners;
  attributes?: DraggableAttributes;
  dragging?: boolean;
};

export type OpportunityCardProps = {
  opportunity: Opportunity;
  /** A oportunidade acabou de ser arrastada para ganha: o cartão mostra o check de feito e depois volta. */
  celebrating?: boolean;
  /** Avisa que o check terminou, para o quadro tirar a marca. */
  onCelebrated?: () => void;
  /**
   * Abre a ficha. Recebe a oportunidade em vez de fechar sobre ela (2026-09-17, na rodada de velocidade):
   * assim quem lista passa a mesma função para todos os cartões e o `memo` daqui embaixo tem o que segurar.
   */
  onOpen: (opportunity: Opportunity) => void;
  /** O arraste do quadro: o cartão inteiro é a alça, então quem chama passa o que o `useDraggable` devolveu. */
  drag?: OpportunityCardDrag;
  /** O cartão que flutua sob o ponteiro enquanto se arrasta: é só o desenho, sem alça e sem leque. */
  overlay?: boolean;
  /** As etapas do quadro em que o cartão está, para o "Mover para" do leque. */
  stages?: CrmStage[];
  onMove?: (opportunity: Opportunity, stage: CrmStage) => void;
  /** Pede a exclusão; quem confirma é a janela da casa, com a pergunta e o aviso. */
  onDelete?: (opportunity: Opportunity) => void;
};

/* Controles com ação própria dentro do cartão: clique que nasce neles não abre a ficha. */
const INTERACTIVE = "button, a, input, label, [role='button'], [role='menuitem']";

// O cartão do funil, na mesma arquitetura do cartão de tarefa e com o assunto trocado: lá o que importa é
// quando vence e quanto falta, aqui é quanto vale e qual a chance de fechar.
export const OpportunityCard = memo(function OpportunityCard({
  opportunity,
  onOpen,
  drag,
  overlay = false,
  stages,
  onMove,
  onDelete,
  celebrating = false,
  onCelebrated,
}: OpportunityCardProps) {
  const expected = expectedOf(opportunity);
  /* Quem cuida: sem responsável, o rosto não aparece, em vez de um rosto genérico. */
  const owner = opportunity.owner.id ? opportunity.owner : undefined;
  const stale = isStale(opportunity);

  const onClick = (event: MouseEvent<HTMLElement>) => {
    const control = (event.target as HTMLElement).closest(INTERACTIVE);
    if (control && control !== event.currentTarget) return;
    onOpen(opportunity);
  };

  /* As duas teclas do cartão, e só quando o foco está nele mesmo: **Enter abre** a ficha e **Espaço pega** o
     cartão para mover de etapa, que é do arraste. */
  const dragKeyDown = drag?.listeners?.onKeyDown as ((event: KeyboardEvent<HTMLElement>) => void) | undefined;

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter") {
      event.preventDefault();
      onOpen(opportunity);
      return;
    }
    if (event.key === " ") dragKeyDown?.(event);
  };

  return (
    <li
      ref={drag?.ref}
      className={styles.card}
      data-dragging={drag?.dragging || undefined}
      data-overlay={overlay || undefined}
      data-celebrating={celebrating || undefined}
      {...rounded("xl", { clip: true })}
    >
      <div
        {...drag?.attributes}
        {...drag?.listeners}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={`Ver ${opportunity.title}`}
        className={styles.inner}
        data-grab={drag ? "" : undefined}
        onClick={onClick}
        onKeyDown={onKeyDown}
        {...roundedAuto({ clip: true })}
      >
        {/* O cartão enxuto (2026-10-26, a pedido: "mais discreto e compacto, só informações úteis"): três
            linhas no lugar de sete. Em cima o rosto do cliente, o nome da venda e o leque; embaixo do nome,
            para quem é; no pé, quanto vale, e do outro lado só sinais: a temperatura, o aviso de parada, quando
            deve fechar e quem cuida. Chance, descrição, etiquetas e contagens ficam na ficha. */}
        <div className={styles.head}>
          <Avatar name={opportunity.client.name} src={opportunity.client.avatarUrl ?? undefined} size="sm" shape="rounded" />
          <span className={styles.who}>
            <Text as="h3" variant="footnote" weight="semibold" className={styles.title}>
              {opportunity.title}
            </Text>
            <Text as="span" variant="caption1" tone="secondary" truncate>
              {opportunity.client.company ?? opportunity.client.name}
            </Text>
          </span>
          {!overlay && (
            <span className={styles.menu}>
              <OpportunityMenu
                opportunity={opportunity}
                onOpen={() => onOpen(opportunity)}
                stages={stages}
                onMove={onMove && ((stage) => onMove(opportunity, stage))}
                onDelete={onDelete && (() => onDelete(opportunity))}
              />
            </span>
          )}
        </div>

        <div className={styles.foot}>
          <Text as="span" variant="footnote" weight="semibold" className={styles.value}>
            {compactMoney(opportunity.value)}
          </Text>

          <span className={styles.meta}>
            <span
              className={styles.signal}
              style={{ "--signal": temperatureHues[opportunity.temperature] } as CSSProperties}
              title={temperatureLabels[opportunity.temperature]}
            >
              <ThermometerIcon weight="bold" aria-hidden="true" />
              <VisuallyHidden>Temperatura: {temperatureLabels[opportunity.temperature]}</VisuallyHidden>
            </span>
            {stale && (
              <span className={styles.signal} style={{ "--signal": "var(--color-warning)" } as CSSProperties} title={touchLabel(opportunity)}>
                <HourglassIcon weight="fill" aria-hidden="true" />
                <VisuallyHidden>{touchLabel(opportunity)}</VisuallyHidden>
              </span>
            )}
            {opportunity.expectedAt && (
              <Badge tone={expected.tone} size="sm" icon={<CalendarBlankIcon />}>
                {expected.label}
              </Badge>
            )}
            {owner && (
              <span className={styles.signal} title={`Responsável: ${owner.name}`}>
                <Avatar name={owner.name} src={owner.avatarUrl ?? undefined} size="xs" />
              </span>
            )}
          </span>
        </div>
      </div>
      {/* O ganho, só como efeito (2026-09-23, a pedido): ao soltar o cartão numa etapa de ganho, um véu verde
          cobre o cartão com o anel se fechando no check, e some sozinho. Não muda nada no cartão. */}
      {celebrating && (
        <SuccessOverlay onDone={onCelebrated} />
      )}
    </li>
  );
});
