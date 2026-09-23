"use client";

import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cookieString } from "@/lib/cookies";
import { TIMER_POSITION_COOKIE, formatClock, timerPositionValue, type TimerPosition } from "../summary";
import { TimeIslandCard } from "./time-island-card";
import { useTimeTracker, useTimerSeconds, type TimerOrigin } from "./time-tracker-provider";

/**
 * O cronômetro em andamento, numa ilha que flutua por cima de tudo (2026-09-22, a pedido, sobre a referência
 * da ilha dinâmica de um aparelho): recolhida é uma pílula com o anel e o tempo; aberta, o tempo grande, de
 * onde ele vem e os dois botões redondos, pausar e encerrar.
 *
 * **Vai para onde a pessoa quiser**: segurar e arrastar leva a ilha a qualquer ponto da tela, e o lugar
 * fica guardado em cookie, em fração do espaço livre, para ela voltar ali em outra tela e em outro tamanho de
 * janela. É preferência de interface, e Web Storage é proibido.
 *
 * Sempre no escuro, nos dois temas: é a leitura da referência, e o `color-scheme` resolve os tokens da casa
 * para o lado escuro sem nenhuma cor escrita à mão.
 */

/** Quanto o ponteiro anda antes de o toque virar arraste: menos que isso ainda é clique. */
const DRAG_START = 5;
/** O respiro mínimo entre a ilha e a borda da janela. */
const EDGE = 12;
/** A curva e a duração da troca de forma, as mesmas das camadas da casa (`--ease-settle`). */
const MORPH = { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };
/** A subida do botão tocado até o lugar da ilha, ao ligar. */
const LAUNCH = { duration: 720, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };
/** Quanto o véu de foco fica na tela ao ligar. */
const FOCUS_MS = 1500;

type Size = { width: number; height: number };
type Point = { left: number; top: number };

const subscribeToMount = () => () => undefined;

const contentIn = keyframes`
  from {
    opacity: 0;
    filter: blur(4px);
    transform: scale(0.96);
  }
`;

const sweep = keyframes`
  from {
    stroke-dashoffset: 100;
  }
  to {
    stroke-dashoffset: 0;
  }
`;

const focusVeil = keyframes`
  0% {
    opacity: 0;
  }
  18%,
  72% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
`;

/* O véu de foco ao ligar: escurece e desfoca a tela por baixo da ilha, sem pegar o toque, e some sozinho. */
const Veil = styled.div`
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-popover) - 1);
  pointer-events: none;
  background-color: var(--color-scrim);
  -webkit-backdrop-filter: var(--glass-scrim-blur);
  backdrop-filter: var(--glass-scrim-blur);
  animation: ${focusVeil} ${FOCUS_MS}ms var(--ease-standard) both;
`;

const Island = styled.div`
  position: fixed;
  z-index: var(--z-popover);
  color-scheme: dark;
  color: var(--color-label);
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  touch-action: none;
  user-select: none;
  cursor: grab;
  transition: box-shadow var(--duration-base) var(--ease-settle);

  &[data-state="compact"] {
    border-radius: var(--radius-full);
  }

  &[data-state="expanded"] {
    width: min(21rem, calc(100vw - ${EDGE * 2}px));
    border-radius: var(--radius-3xl);
  }

  &[data-dragging] {
    cursor: grabbing;
    box-shadow: 0 20px 48px rgb(0 0 0 / 0.45);
  }

  /* O conteúdo entra um instante depois de a caixa começar a mudar de forma: primeiro a ilha cresce, depois
     o que mora nela aparece, e a troca lê como uma peça só em vez de duas coladas. */
  & > * {
    animation: ${contentIn} 280ms var(--ease-settle) 70ms both;
  }

  /* O anel corre sozinho, no compositor: uma volta por minuto, e o atraso negativo que vem do TS põe o traço
     no segundo em que o cronômetro está. Pausado, ele para onde estava. */
  & [data-sweep] {
    stroke-dasharray: 100 100;
    animation: ${sweep} 60s linear infinite;
  }

  &[data-paused] [data-sweep] {
    animation-play-state: paused;
    opacity: 0.5;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    & > * {
      animation: none;
    }

    & [data-sweep] {
      animation: none;
      stroke-dashoffset: var(--sweep-still, 100);
    }
  }
`;

const Pill = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  min-width: 10rem;
  min-height: var(--touch-target);
  padding: 0 var(--space-4) 0 var(--space-2);
  color: inherit;
  font: inherit;
  background: none;
  border: 0;
  border-radius: var(--radius-full);
  cursor: inherit;

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
`;

const MiniRing = styled.svg`
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  rotate: -90deg;

  & circle {
    fill: none;
    stroke-width: 3;
  }
`;

const RingTrack = "var(--color-fill-secondary)";
const Lit = "var(--sys-orange)";

const Digits = styled.strong`
  font-size: var(--text-title-1);
  font-weight: var(--weight-bold);
  line-height: 1;
  letter-spacing: var(--tracking-tight);
  font-variant-numeric: tabular-nums;

  &[data-size="sm"] {
    font-size: var(--text-callout);
    font-weight: var(--weight-semibold);
    color: var(--sys-orange);
  }

  [data-paused] & {
    color: var(--color-label-secondary);
  }
`;

const clamp = (value: number, max: number) => Math.min(Math.max(EDGE, value), Math.max(EDGE, max));

/** Onde a ilha cai para uma posição guardada e um tamanho: a fração vale sobre o espaço que sobra na tela. */
const placeOf = (position: TimerPosition, size: Size | null, viewport: Size): Point => ({
  left: EDGE + position.x * Math.max(0, viewport.width - (size?.width ?? 0) - EDGE * 2),
  top: EDGE + position.y * Math.max(0, viewport.height - (size?.height ?? 0) - EDGE * 2),
});

/**
 * O traço aceso do anel. A fase é lida **uma vez**, ao montar, e vira um atraso negativo da animação: dali em
 * diante quem anda é o compositor, liso, em vez de um salto por segundo vindo do React. Cada trecho monta um
 * traço novo (a chave é o apontamento), então retomar depois de uma pausa já nasce no segundo certo.
 */
function Sweep({ startedAt, carried }: { startedAt: string | null; carried: number }) {
  const ref = useRef<SVGCircleElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const at = carried + (startedAt ? (Date.now() - new Date(startedAt).getTime()) / 1000 : 0);
    const phase = at % 60;
    node.style.animationDelay = `-${phase}s`;
    node.style.setProperty("--sweep-still", String(100 - (phase / 60) * 100));
  }, [startedAt, carried]);

  return <circle ref={ref} data-sweep="" cx="14" cy="14" r="11" pathLength={100} stroke={Lit} strokeLinecap="round" />;
}

/** Sem botão de origem (a barra do celular), a ilha nasce do pé da tela, que é onde a barra mora. */
const fallbackOrigin = (viewport: Size): TimerOrigin => ({ left: viewport.width / 2 - 22, top: viewport.height - 64, width: 44, height: 44 });

export function TimeIsland({ initialPosition }: { initialPosition: TimerPosition }) {
  const { active, session } = useTimeTracker();
  const seconds = useTimerSeconds();
  const mounted = useSyncExternalStore(subscribeToMount, () => true, () => false);
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState(initialPosition);
  const [size, setSize] = useState<Size | null>(null);
  const [viewport, setViewport] = useState<Size>(() =>
    typeof window === "undefined" ? { width: 0, height: 0 } : { width: window.innerWidth, height: window.innerHeight },
  );
  const [dragged, setDragged] = useState<Point | null>(null);
  const gesture = useRef<{ id: number; x: number; y: number; from: Point; moved: boolean } | null>(null);
  /* O retrato da ilha antes de trocar de forma, e se a troca ainda está andando: enquanto ela anda, o
     observador de tamanho fica quieto, senão cada quadro da animação reposicionaria a ilha. */
  const before = useRef<{ rect: DOMRect; radius: string } | null>(null);
  const morphing = useRef(false);
  const layout = useRef({ position, viewport });

  /* Cada início acende o véu e faz a ilha subir do botão tocado. O véu é ajustado durante o render, ao ver
     um lançamento novo, que é como o React pede para reagir a prop nova, e se apaga no fim da animação. */
  const launch = session?.launch;
  const [seenLaunch, setSeenLaunch] = useState<number | undefined>(undefined);
  const [focusing, setFocusing] = useState(false);
  const flown = useRef<number | undefined>(undefined);
  if (launch && launch.id !== seenLaunch) {
    setSeenLaunch(launch.id);
    setFocusing(true);
    setExpanded(false);
  }

  useLayoutEffect(() => {
    layout.current = { position, viewport };
  });

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      if (!morphing.current) setSize({ width: node.offsetWidth, height: node.offsetHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [mounted]);

  /* A subida: a ilha nasce no tamanho e no lugar do botão tocado e vai até o lugar dela, crescendo no
     caminho. Espera a primeira medida, porque antes disso ela nem está posta na tela. */
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !launch || !size || flown.current === launch.id) return;
    flown.current = launch.id;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const origin = launch.origin ?? fallbackOrigin(layout.current.viewport);
    const rect = node.getBoundingClientRect();
    const dx = origin.left + origin.width / 2 - (rect.left + rect.width / 2);
    const dy = origin.top + origin.height / 2 - (rect.top + rect.height / 2);
    const scale = Math.max(0.2, Math.min(1, origin.height / rect.height));
    node.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0 },
        { opacity: 1, offset: 0.25 },
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
      ],
      LAUNCH,
    );
  }, [launch, size]);

  /* A troca de forma: a caixa sai do tamanho, do lugar e do canto de antes e chega nos de agora, como uma
     peça só que cresce ou encolhe. O tamanho novo é medido e gravado antes da pintura, para a posição final
     já sair certa, e a animação cobre a diferença. */
  useLayoutEffect(() => {
    const node = ref.current;
    const first = before.current;
    before.current = null;
    if (!node || !first) return;

    const next = { width: node.offsetWidth, height: node.offsetHeight };
    setSize(next);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const last = placeOf(layout.current.position, next, layout.current.viewport);
    morphing.current = true;
    const animation = node.animate(
      [
        {
          width: `${first.rect.width}px`,
          height: `${first.rect.height}px`,
          translate: `${first.rect.left - last.left}px ${first.rect.top - last.top}px`,
          borderRadius: first.radius,
        },
        { width: `${next.width}px`, height: `${next.height}px`, translate: "0 0", borderRadius: getComputedStyle(node).borderRadius },
      ],
      MORPH,
    );
    const settle = () => {
      morphing.current = false;
    };
    animation.onfinish = settle;
    animation.oncancel = settle;
  }, [expanded]);

  if (!mounted || !session) return null;

  const room = { width: viewport.width - (size?.width ?? 0) - EDGE * 2, height: viewport.height - (size?.height ?? 0) - EDGE * 2 };
  const placed: Point = dragged ?? placeOf(position, size, viewport);
  const paused = session.paused;
  const clock = formatClock(seconds);
  const segment = active?.id ?? "pausado";


  const toggle = (next: boolean) => {
    const node = ref.current;
    if (node) before.current = { rect: node.getBoundingClientRect(), radius: getComputedStyle(node).borderRadius };
    setExpanded(next);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, from: placed, moved: false };
  };

  const pointOf = (event: ReactPointerEvent<HTMLDivElement>, from: Point, start: { x: number; y: number }): Point => ({
    left: clamp(from.left + event.clientX - start.x, viewport.width - (size?.width ?? 0) - EDGE),
    top: clamp(from.top + event.clientY - start.y, viewport.height - (size?.height ?? 0) - EDGE),
  });

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    if (!current.moved) {
      if (Math.hypot(event.clientX - current.x, event.clientY - current.y) < DRAG_START) return;
      /* A captura entra só quando o gesto já é arraste: com ela desde o toque, o clique num botão da ilha
         iria para a ilha, e nenhum botão responderia. Depois do arraste é justamente isso que se quer. */
      current.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setDragged(pointOf(event, current.from, current));
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    gesture.current = null;
    if (!current?.moved) return;
    const point = pointOf(event, current.from, current);
    const next = {
      x: room.width > 0 ? (point.left - EDGE) / room.width : 0.5,
      y: room.height > 0 ? (point.top - EDGE) / room.height : 0,
    };
    setPosition(next);
    setDragged(null);
    document.cookie = cookieString(TIMER_POSITION_COOKIE, timerPositionValue(next));
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && expanded) {
      event.stopPropagation();
      toggle(false);
    }
  };

  return (
    <>
      {focusing && <Veil aria-hidden="true" onAnimationEnd={() => setFocusing(false)} />}
      <Island
        ref={ref}
        role="region"
        aria-label={`Cronômetro de ${session.title}`}
        data-state={expanded ? "expanded" : "compact"}
        data-dragging={dragged ? "" : undefined}
        data-paused={paused || undefined}
        style={{ left: placed.left, top: placed.top, visibility: size ? undefined : "hidden" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
      >
        {expanded ? (
          <TimeIslandCard key="expanded" onCollapse={() => toggle(false)} />
        ) : (
          <Pill key="compact" type="button" aria-label={`${session.title}: ${clock}${paused ? ", pausado" : ""}. Abrir o cronômetro`} onClick={() => toggle(true)}>
            <MiniRing viewBox="0 0 28 28" aria-hidden="true">
              <circle cx="14" cy="14" r="11" stroke={RingTrack} />
              <Sweep key={segment} startedAt={active?.startedAt ?? null} carried={session.carried} />
            </MiniRing>
            <Digits data-size="sm">{clock}</Digits>
          </Pill>
        )}
      </Island>
    </>
  );
}
