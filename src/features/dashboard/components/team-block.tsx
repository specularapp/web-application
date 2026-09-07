"use client";

import styled from "@emotion/styled";
import { BriefcaseIcon, CurrencyCircleDollarIcon, type Icon } from "@phosphor-icons/react";
import { useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { fadeIn, focusRing } from "@/components/ui/styles";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import type { TeamMember, TeamMemberMetrics, TeamMemberStatus, TeamSummary } from "@/features/organizations/summary";
import { compactMoney } from "@/lib/utils/format";

export type TeamBlockProps = { summary: TeamSummary };

type Metric = { key: keyof TeamMemberMetrics; label: string; icon: Icon; format: (value: number) => string };

/* As duas medidas do que a pessoa produziu, nas mesmas etiquetas neutras: projetos entregues e o
   faturamento que trouxe, encurtado como o do menu. Na tela é ícone e valor; o nome da medida vai para
   o leitor de tela e para a dica do ponteiro. */
const metrics: Metric[] = [
  { key: "deliveredProjects", label: "Projetos entregues", icon: BriefcaseIcon, format: String },
  { key: "revenue", label: "Faturamento", icon: CurrencyCircleDollarIcon, format: compactMoney },
];

const dots: Record<TeamMemberStatus, string> = { active: "var(--color-success)", pending: "var(--color-warning)" };

/* A foto grande em 100% do avatar: o tamanho sai da altura da fila, não de um número. */
const fillAvatar = { "--avatar-size": "100%" } as CSSProperties;

/* Duas linhas a 12px uma da outra: em cima a fila de fotos, que toma toda a altura que sobra, e embaixo
   a ficha de quem está em foco. As fotos crescem com a fila, então o bloco não tem espaço em branco em
   tela nenhuma; no corpo mínimo de 108px elas ficam no piso de 32px e a conta fecha por um fio. */
const Block = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  height: 100%;
  min-height: 0;
`;

/* A fila rola na horizontal com encaixe por foto e mostra a barra da casa embaixo, com um respiro de 8px
   entre as fotos e a barra. Com o mouse, ela também anda arrastando: o cursor vira mão, e enquanto se
   arrasta o encaixe desliga, para a fila seguir o ponteiro e só encaixar ao soltar. As fotos esticam à
   altura que sobra e ficam quadradas. O respiro de 4px em volta, devolvido pela margem, é para o anel
   da foto em foco não ser cortado pela caixa que rola. Sem máscara nas pontas: numa fila curta ela
   apagava a primeira foto com a fila ainda no início. Posicionada, para o `offsetLeft` das fotos ser
   medido a partir dela. */
const Strip = styled.div`
  position: relative;
  display: flex;
  flex: 1 1 auto;
  gap: var(--space-2);
  align-items: stretch;
  min-width: 0;
  min-height: 0;
  padding: var(--space-1) var(--space-1) var(--space-2);
  margin: calc(var(--space-1) * -1);
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory;
  scroll-padding-inline: var(--space-1);
  cursor: grab;
  user-select: none;

  &[data-dragging] {
    cursor: grabbing;
    scroll-snap-type: none;
  }

  & img {
    pointer-events: none;
  }
`;

/* Cada foto é um botão redondo com a altura da fila e largura igual, entre um piso e um teto, com o
   ponto de situação na quina (verde para quem já está, laranja para convite em aberto). Em foco, anel
   na cor da marca separado da foto por um vão na cor do fundo; as outras ficam um pouco apagadas, para
   a escolhida ler como escolhida. */
const Pick = styled.button`
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  height: 100%;
  min-height: 2rem;
  max-height: 6rem;
  aspect-ratio: 1;
  padding: 0;
  line-height: 0;
  scroll-snap-align: start;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: var(--radius-full);
  transition:
    box-shadow var(--duration-fast) var(--ease-standard),
    opacity var(--duration-fast) var(--ease-standard);
  ${focusRing};

  &:not([aria-pressed="true"]) {
    opacity: 0.72;
  }

  &:hover {
    opacity: 1;
  }

  &[aria-pressed="true"] {
    box-shadow:
      0 0 0 2px var(--color-bg),
      0 0 0 3.5px var(--color-brand);
  }

  &::after {
    content: "";
    position: absolute;
    inset-block-end: 4%;
    inset-inline-end: 4%;
    width: 22%;
    height: 22%;
    background-color: var(--dot);
    border-radius: var(--radius-full);
    box-shadow: 0 0 0 2px var(--color-bg);
  }
`;

/* A ficha de quem está em foco, numa faixa com o preenchimento do botão secundário e o raio de dentro
   do bloco: nome e função à esquerda, encurtando por reticências, e as medidas na outra ponta. A faixa
   fica parada na troca de pessoa; o que entra com um fade curto são só os textos, que remontam por
   `key`, então nada salta. */
const Focused = styled.div`
  display: flex;
  flex-shrink: 0;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  padding: var(--space-2) var(--space-4);
  background-color: var(--color-fill-quaternary);
  border-radius: var(--card-inner);
  corner-shape: squircle;
`;

const Fading = styled.span`
  display: contents;

  & > * {
    animation: ${fadeIn} var(--duration-base) var(--ease-standard) both;
  }

  @media (prefers-reduced-motion: reduce) {
    & > * {
      animation: none;
    }
  }
`;

/* Nome e função colados e em entrelinha justa, para a faixa caber nos 108px do corpo mínimo. */
const Naming = styled.div`
  display: grid;
  flex: 1 1 auto;
  min-width: 0;

  & > * {
    line-height: var(--leading-tight);
  }
`;

/* As duas etiquetas lado a lado. Cada medida é um item de linha de verdade, e o `dd` em volta da
   etiqueta fica sem altura de linha e sem o afastamento padrão do navegador, para a etiqueta medir só o
   que ela mesma mede. */
const Metrics = styled.dl`
  display: flex;
  flex-shrink: 0;
  gap: var(--space-2);
  align-items: center;
  margin: 0;
`;

const Measure = styled.div`
  display: inline-flex;
  align-items: center;

  & dd {
    display: inline-flex;
    margin: 0;
    line-height: 0;
  }
`;

const DRAG_THRESHOLD = 4;

// Todo mundo da equipe numa fila de fotos que rola e cresce com o espaço, e embaixo a ficha de quem
// está em foco com as duas medidas do que produziu. Começa pela primeira pessoa; clicar em outra foto
// troca e a traz para a vista. Com o mouse a fila também anda arrastando, e um arrasto não conta como
// clique na foto onde o ponteiro soltou.
export function TeamBlock({ summary }: TeamBlockProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const swallowClick = useRef(false);
  const [focusedId, setFocusedId] = useState(summary.members[0]?.id);
  const focused = summary.members.find((member) => member.id === focusedId) ?? summary.members[0];

  // Só para o mouse: no toque quem rola é o próprio navegador. Os ouvintes vão para a janela, e não
  // para a fila com captura de ponteiro, porque a captura mudaria o alvo do clique que vem depois.
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const strip = stripRef.current;
    if (!strip || event.pointerType !== "mouse" || event.button !== 0) return;
    drag.current = { x: event.clientX, left: strip.scrollLeft, moved: false };
    strip.dataset.dragging = "";

    const move = (pointer: PointerEvent) => {
      if (!drag.current) return;
      const delta = pointer.clientX - drag.current.x;
      if (Math.abs(delta) > DRAG_THRESHOLD) drag.current.moved = true;
      strip.scrollLeft = drag.current.left - delta;
    };
    // O clique que fecha um arrasto chega logo depois do pointerup; se o ponteiro soltou fora da fila,
    // ele não chega, e a marca é apagada no tique seguinte para não engolir um clique legítimo depois.
    const stop = () => {
      swallowClick.current = drag.current?.moved ?? false;
      window.setTimeout(() => {
        swallowClick.current = false;
      }, 0);
      drag.current = null;
      delete strip.dataset.dragging;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  const swallowDraggedClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const focus = (member: TeamMember, pick: HTMLElement) => {
    setFocusedId(member.id);
    const strip = stripRef.current;
    if (!strip) return;
    const inset = parseFloat(getComputedStyle(strip).paddingInlineStart) || 0;
    strip.scrollTo({ left: pick.offsetLeft - inset, behavior: "smooth" });
  };

  if (!focused) {
    return (
      <Text variant="footnote" tone="secondary">
        Ninguém na equipe ainda
      </Text>
    );
  }

  return (
    <Block>
      <Strip
        ref={stripRef}
        role="group"
        aria-label={`Membros da equipe (${summary.members.length})`}
        onPointerDown={startDrag}
        onClickCapture={swallowDraggedClick}
      >
        {summary.members.map((member) => (
          <Pick
            key={member.id}
            type="button"
            aria-pressed={member.id === focused.id}
            aria-label={member.name}
            style={{ "--dot": dots[member.status] } as CSSProperties}
            onClick={(event) => focus(member, event.currentTarget)}
          >
            <Avatar name={member.name} src={member.avatarUrl ?? undefined} size="lg" style={fillAvatar} aria-hidden="true" />
          </Pick>
        ))}
      </Strip>

      <Focused>
        <Naming>
          <Fading key={`name-${focused.id}`}>
            <Text as="p" variant="subheadline" weight="semibold" truncate>
              {focused.name}
            </Text>
            <Text as="p" variant="caption1" tone="secondary" truncate>
              {focused.status === "pending" ? "Convite pendente" : focused.role}
            </Text>
          </Fading>
        </Naming>
        <Metrics aria-label={`Medidas de ${focused.name}`}>
          {metrics.map(({ key, label, icon: Glyph, format }) => (
            <Measure key={key} title={label}>
              <VisuallyHidden as="dt">{label}</VisuallyHidden>
              <dd>
                <Fading key={`${key}-${focused.id}`}>
                  <Badge tone="neutral" size="sm" icon={<Glyph />}>
                    {format(focused.metrics[key])}
                  </Badge>
                </Fading>
              </dd>
            </Measure>
          ))}
        </Metrics>
      </Focused>
    </Block>
  );
}
