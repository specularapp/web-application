"use client";

import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import {
  CalendarBlankIcon,
  ClockCounterClockwiseIcon,
  FunnelSimpleIcon,
  HourglassIcon,
  PaperclipIcon,
  ThermometerIcon,
} from "@phosphor-icons/react";
import type { KeyboardEvent, MouseEvent } from "react";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { compactMoney } from "@/lib/utils/format";
import { squircle, squircleAuto } from "@/lib/corners";
import { expectedOf, isStale, sourceLabels, temperatureLabels, temperatureTones, touchLabel } from "../labels";
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
  onOpen: () => void;
  /** O arraste do quadro: o cartão inteiro é a alça, então quem chama passa o que o `useDraggable` devolveu. */
  drag?: OpportunityCardDrag;
  /** O cartão que flutua sob o ponteiro enquanto se arrasta: é só o desenho, sem alça e sem leque. */
  overlay?: boolean;
  /** As etapas do quadro em que o cartão está, para o "Mover para" do leque. */
  stages?: CrmStage[];
  onMove?: (stage: CrmStage) => void;
  /** Pede a exclusão; quem confirma é a janela da casa, com a pergunta e o aviso. */
  onDelete?: () => void;
};

/** Quantos rostos a fila mostra antes de resumir o resto em "+N". */
const SHOWN_FACES = 3;

/** Quantas etiquetas cabem numa coluna de 19rem antes de virarem contagem. */
const SHOWN_TAGS = 2;

/* Controles com ação própria dentro do cartão: clique que nasce neles não abre a ficha. */
const INTERACTIVE = "button, a, input, label, [role='button'], [role='menuitem']";

const nameList = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" });

// O cartão do funil, na mesma arquitetura do cartão de tarefa e com o assunto trocado: lá o que importa é
// quando vence e quanto falta, aqui é quanto vale e qual a chance de fechar.
//
// A ordem é a de quem varre a coluna com o olho: o quanto está quente, o aviso de venda parada, o nome do
// que se está vendendo, para quem, o que é, como está classificada, quanto vale e qual a chance, e por fim
// quem cuida e quando deve fechar. Etiquetas e as contagens do pé só aparecem quando existem, então venda
// nova tem cartão curto e venda madura tem cartão cheio.
export function OpportunityCard({ opportunity, onOpen, drag, overlay = false, stages, onMove, onDelete }: OpportunityCardProps) {
  const expected = expectedOf(opportunity);
  const faces = opportunity.people.slice(0, SHOWN_FACES);
  const restFaces = opportunity.people.length - faces.length;
  const tags = opportunity.tags.slice(0, SHOWN_TAGS);
  const restTags = opportunity.tags.length - tags.length;
  const stale = isStale(opportunity);

  const onClick = (event: MouseEvent<HTMLElement>) => {
    const control = (event.target as HTMLElement).closest(INTERACTIVE);
    if (control && control !== event.currentTarget) return;
    onOpen();
  };

  /* As duas teclas do cartão, e só quando o foco está nele mesmo: **Enter abre** a ficha e **Espaço pega** o
     cartão para mover de etapa, que é do arraste. */
  const dragKeyDown = drag?.listeners?.onKeyDown as ((event: KeyboardEvent<HTMLElement>) => void) | undefined;

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter") {
      event.preventDefault();
      onOpen();
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
      {...squircle("xl", { clip: true })}
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
        {...squircleAuto({ clip: true })}
      >
        {/* O topo: a temperatura, o aviso de venda parada, e o leque na outra ponta. O aviso é só glifo,
            porque o "há quantos dias" mora na dica e na ficha; aqui ele avisa que existe. */}
        <div className={styles.head}>
          <Badge tone={temperatureTones[opportunity.temperature]} size="sm" icon={<ThermometerIcon />}>
            {temperatureLabels[opportunity.temperature]}
          </Badge>
          {stale && <Badge tone="warning" size="sm" icon={<HourglassIcon weight="fill" />} label={touchLabel(opportunity)} />}
          {!overlay && (
            <span className={styles.menu}>
              <OpportunityMenu opportunity={opportunity} onOpen={onOpen} stages={stages} onMove={onMove} onDelete={onDelete} />
            </span>
          )}
        </div>

        {/* Para quem é a venda **abre o cartão**, acima do nome dela (a pedido, 2026-09-15): numa coluna de
            funil a pessoa varre procurando o cliente, e não o título que se deu à obra. É o bloco de cliente
            da casa, o mesmo do cartão de projeto: o rosto em azulejo e duas linhas empilhadas, em cima quem
            assina e embaixo com quem se fala, ou de onde o lead veio quando não há empresa. Uma linha só com
            bolinha separando saiu: a casa não separa dado com ponto, ela empilha. */}
        <div className={styles.client}>
          <Avatar name={opportunity.client.name} src={opportunity.client.avatarUrl ?? undefined} size="sm" shape="squircle" />
          <span className={styles.who}>
            <Text as="span" variant="footnote" weight="semibold" truncate>
              {opportunity.client.company ?? opportunity.client.name}
            </Text>
            <Text as="span" variant="caption1" tone="secondary" truncate>
              {opportunity.client.company ? opportunity.client.name : sourceLabels[opportunity.source]}
            </Text>
          </span>
        </div>

        <Text as="h3" variant="subheadline" weight="semibold" className={styles.title}>
          {opportunity.title}
        </Text>

        <Text variant="footnote" tone="secondary" className={styles.description}>
          {opportunity.description}
        </Text>

        {tags.length > 0 && (
          <div className={styles.tags}>
            {tags.map((tag) => (
              <Badge key={tag} size="sm" className={styles.tag}>
                {tag}
              </Badge>
            ))}
            {restTags > 0 && (
              <Badge size="sm" variant="outline" title={opportunity.tags.slice(SHOWN_TAGS).join(", ")}>
                +{restTags}
              </Badge>
            )}
          </div>
        )}

        {/* Quanto vale e qual a chance: o valor forte, porque é o número que se procura no cartão, e a barra
            da probabilidade embaixo dele. A barra é a mesma peça do progresso das subtarefas, no tom da
            temperatura: a leitura aqui é "o quanto disto é provável", e não "o quanto já foi feito". */}
        <div className={styles.deal}>
          <Text as="span" variant="callout" weight="semibold" className={styles.value}>
            {compactMoney(opportunity.value)}
          </Text>
          <span className={styles.chance}>
            <Progress
              value={opportunity.probability}
              max={100}
              size="xs"
              tone={opportunity.temperature === "hot" ? "success" : "accent"}
              className={styles.probability}
              aria-label={`Chance de fechar: ${opportunity.probability}%`}
            />
            <Text as="span" variant="caption1" tone="secondary" className={styles.percent}>
              {opportunity.probability}%
            </Text>
          </span>
        </div>

        {/* O pé: quem cuida de um lado, o que há para ler e quando deve fechar do outro. O primeiro rosto é
            sempre quem responde pela venda, e os nomes inteiros seguem na leitura por voz. */}
        <div className={styles.foot}>
          <span className={styles.people}>
            <AvatarGroup className={styles.faces}>
              {faces.map((person) => (
                <Avatar key={person.name} name={person.name} src={person.avatarUrl ?? undefined} size="xs" />
              ))}
            </AvatarGroup>
            {restFaces > 0 && (
              <Text as="span" variant="caption1" tone="secondary" className={styles.more}>
                +{restFaces}
              </Text>
            )}
            <VisuallyHidden>
              Responsável: {opportunity.owner.name}. Envolvidos: {nameList.format(opportunity.people.map((person) => person.name))}
            </VisuallyHidden>
          </span>

          <span className={styles.meta}>
            {opportunity.funnel && (
              <span className={styles.count} title={opportunity.funnel.name}>
                <FunnelSimpleIcon aria-hidden="true" />
                <VisuallyHidden>Funil: {opportunity.funnel.name}</VisuallyHidden>
              </span>
            )}
            {opportunity.attachments > 0 && (
              <span className={styles.count}>
                <PaperclipIcon aria-hidden="true" />
                <Text as="span" variant="caption1" tone="inherit">
                  {opportunity.attachments}
                </Text>
                <VisuallyHidden>anexos</VisuallyHidden>
              </span>
            )}
            {opportunity.activity > 0 && (
              <span className={styles.count}>
                <ClockCounterClockwiseIcon aria-hidden="true" />
                <Text as="span" variant="caption1" tone="inherit">
                  {opportunity.activity}
                </Text>
                <VisuallyHidden>registros de histórico</VisuallyHidden>
              </span>
            )}
            <Badge tone={expected.tone} size="sm" icon={<CalendarBlankIcon />}>
              {expected.label}
            </Badge>
          </span>
        </div>
      </div>
    </li>
  );
}
