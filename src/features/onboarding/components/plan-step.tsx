"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Logo } from "@/components/layout/logo";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { startSubscriptionAction } from "@/features/billing/actions";
import { CheckoutPanel, type CheckoutIntentInfo } from "@/features/billing/components/checkout-panel";
import { CycleToggle } from "@/features/billing/components/cycle-toggle";
import {
  chargeCents,
  formatPrice,
  plans,
  type BillingCycle,
  type Plan,
  type PlanId,
} from "@/features/billing/plans";
import type { BillingState } from "@/features/billing/service";
import { finishOnboardingAction } from "@/features/organizations/actions";
import type { Team } from "@/features/organizations/service";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { squircle } from "@/lib/corners";
import styles from "./plan.module.css";

type PlanStepProps = {
  team: Team;
  billing: BillingState;
  demo?: boolean;
  /** Chamado quando a configuração fecha, para o fluxo abrir a despedida. */
  onFinished: () => void;
};

const COUNT_DURATION_MS = 380;

// Assentamento do carrossel: espera a rolagem sossegar e desliza devagar, para a correção ser sentida
// como acomodação e não como puxão.
const SETTLE_DELAY_MS = 180;
const SETTLE_DURATION_MS = 520;

// Só passa a ser arraste depois disso. Abaixo, é clique com a mão tremendo, e clique tem que chegar ao
// botão do cartão.
const DRAG_THRESHOLD_PX = 8;

// Na prévia o Stripe não monta, porque o iframe dele exige um segredo válido, mas a etapa de pagamento
// precisa ser alcançável para ajuste visual: o `CheckoutPanel` reserva o espaço do formulário.
function previewIntent(plan: PlanId, cycle: BillingCycle, trialDays: number): CheckoutIntentInfo {
  return {
    mode: trialDays > 0 ? "setup" : "payment",
    clientSecret: "seti_preview_secret_preview",
    plan,
    cycle,
    subscriptionId: null,
    setupIntentId: "seti_preview",
    amountCents: trialDays > 0 ? 0 : chargeCents(plan, cycle),
    trialDays,
  };
}

// O número corre do valor antigo para o novo ao trocar o ciclo, sempre em reais fechados para não
// pingar centavo no meio do caminho. Escreve direto no texto do nó em vez de estado: re-render por
// quadro só para animar um dígito não se justifica. Com movimento reduzido, troca seca.
function AnimatedAmount({ cents, className }: { cents: number; className?: string }) {
  const node = useRef<HTMLSpanElement>(null);
  const shown = useRef(cents);

  useLayoutEffect(() => {
    const element = node.current;
    const from = shown.current;
    if (!element || from === cents) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shown.current = cents;
      return;
    }

    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - start) / COUNT_DURATION_MS);
      const eased = 1 - (1 - progress) ** 3;
      const current = Math.round((from + (cents - from) * eased) / 100) * 100;
      shown.current = current;
      element.textContent = `R$${formatPrice(current)}`;
      if (progress < 1) frame = requestAnimationFrame(tick);
    });

    element.textContent = `R$${formatPrice(from)}`;
    return () => cancelAnimationFrame(frame);
  }, [cents]);

  return (
    <span ref={node} className={className ?? styles.amount}>
      R${formatPrice(cents)}
    </span>
  );
}

function Price({ plan, cycle }: { plan: Plan; cycle: BillingCycle }) {
  return (
    <p className={styles.price}>
      <AnimatedAmount cents={plan.price[cycle]} />
      <span className={styles.period}>/mês</span>
    </p>
  );
}

export function PlanStep({ team, billing, demo = false, onFinished }: PlanStepProps) {
  const { toast } = useToast();
  const compact = useMediaQuery(MOBILE_QUERY);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [working, setWorking] = useState<PlanId | null>(null);
  const [checkout, setCheckout] = useState<CheckoutIntentInfo | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const settling = useRef(false);
  const settle = useRef(() => {});

  // Arrastar com o ponteiro. O dedo já rola nativo, com inércia do próprio navegador, então isto é só
  // para o mouse, onde não existe arraste em container rolável. O estado fica em ref e num atributo
  // escrito direto no nó: mexer no estado do React a cada quadro de arraste não se justifica.
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: false });

  // A pista rola livre, sem encaixe do navegador: `scroll-snap` prende de cartão em cartão e o arraste
  // fica em degraus. Quem alinha é este efeito, que espera a rolagem parar e desliza o cartão mais
  // próximo para o lugar num tween nosso, com duração e curva controladas. O ponto aceso sai da mesma
  // leitura. Começa em zero, que é onde a pista nasce, então não há leitura inicial a fazer aqui.
  useEffect(() => {
    const node = track.current;
    if (!node || !compact) return;

    let idle: number | undefined;

    const nearest = () => {
      const cards = [...node.children] as HTMLElement[];
      const middle = node.scrollLeft + node.clientWidth / 2;
      let closest = 0;
      let shortest = Number.POSITIVE_INFINITY;

      cards.forEach((card, index) => {
        const distance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - middle);
        if (distance < shortest) {
          shortest = distance;
          closest = index;
        }
      });

      return { index: closest, card: cards[closest] };
    };

    const glide = (target: number) => {
      const limit = Math.max(0, node.scrollWidth - node.clientWidth);
      const to = Math.max(0, Math.min(target, limit));
      const from = node.scrollLeft;
      const distance = to - from;
      if (Math.abs(distance) < 1) return;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        node.scrollLeft = to;
        return;
      }

      settling.current = true;
      const started = performance.now();

      const step = (now: number) => {
        const progress = Math.min(1, (now - started) / SETTLE_DURATION_MS);
        node.scrollLeft = from + distance * (1 - (1 - progress) ** 3);
        if (progress < 1) requestAnimationFrame(step);
        else settling.current = false;
      };

      requestAnimationFrame(step);
    };

    settle.current = () => {
      const { card } = nearest();
      if (card) glide(card.offsetLeft);
    };

    const update = () => {
      setActive(nearest().index);
      if (drag.current.active || settling.current) return;

      window.clearTimeout(idle);
      idle = window.setTimeout(() => settle.current(), SETTLE_DELAY_MS);
    };

    node.addEventListener("scroll", update, { passive: true });
    return () => {
      window.clearTimeout(idle);
      node.removeEventListener("scroll", update);
    };
  }, [compact]);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    drag.current.moved = false;

    const node = track.current;
    if (!node || event.pointerType !== "mouse" || event.button !== 0) return;
    if (node.scrollWidth <= node.clientWidth) return;

    drag.current = { active: true, startX: event.clientX, startLeft: node.scrollLeft, moved: false };
  };

  /**
   * A captura do ponteiro só entra depois do limite, e não no `pointerdown`. Com a captura na pista, o
   * `click` é entregue a ela e não ao elemento embaixo do cursor, então o botão do cartão nunca recebia o
   * clique e não dava para escolher plano nenhum. Enquanto o movimento é menor que o limite, isto aqui
   * não faz nada: é um clique, não um arraste.
   */
  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const node = track.current;
    if (!node || !drag.current.active) return;

    const travelled = event.clientX - drag.current.startX;
    if (!drag.current.moved) {
      if (Math.abs(travelled) < DRAG_THRESHOLD_PX) return;

      drag.current.moved = true;
      node.dataset.dragging = "true";
      node.setPointerCapture(event.pointerId);
    }

    node.scrollLeft = drag.current.startLeft - travelled;
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const node = track.current;
    if (!node || !drag.current.active) return;

    drag.current.active = false;
    if (!drag.current.moved) return;

    delete node.dataset.dragging;
    if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);

    // Mouse não tem inércia: soltando, o alinhamento já pode começar. No dedo, a rolagem segue chegando
    // e é o silêncio dela que dispara o assentamento.
    settle.current();
  };

  // Soltar depois de arrastar não pode virar clique no botão do cartão que estava embaixo do cursor.
  const swallowClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!drag.current.moved) return;
    drag.current.moved = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const current = billing.effectivePlan;
  const trialDaysOf = (planId: PlanId) => {
    const offer = billing.offers.find((item) => item.id === planId);
    return offer?.trialAvailable ? offer.trialDays : 0;
  };

  const finish = async () => {
    const result = await finishOnboardingAction({ organizationId: team.id });
    if (!result.ok) {
      toast({ title: "Não foi possível concluir", description: result.error, tone: "danger" });
      return;
    }

    onFinished();
  };

  const choose = async (planId: PlanId) => {
    if (working) return;
    setWorking(planId);

    try {
      if (demo) {
        if (planId === "free" || planId === current) {
          onFinished();
          return;
        }

        setCheckout(previewIntent(planId, cycle, trialDaysOf(planId)));
        return;
      }

      // Já está no plano escolhido: não há nada a contratar, e o clique é o "continuar" da etapa. Sem
      // isso, quem voltasse ao fluxo com assinatura em vigor ficava sem saída, porque o botão do plano
      // que já tem não faz pedido nenhum.
      if (planId === current) {
        await finish();
        return;
      }

      const result = await startSubscriptionAction({ organizationId: team.id, plan: planId, cycle });

      if (!result.ok) {
        toast({ title: "Não foi possível continuar", description: result.error, tone: "danger" });
        return;
      }

      if (result.data.kind === "payment") {
        setCheckout(result.data);
        return;
      }

      await finish();
    } catch {
      toast({
        title: "Não foi possível continuar",
        description: "Não foi possível falar com o servidor. Confira a conexão e tente de novo.",
        tone: "danger",
      });
    } finally {
      setWorking(null);
    }
  };

  const actionLabel = (planId: PlanId) => {
    if (planId === current) return "Continuar com esse plano";
    const trial = trialDaysOf(planId);
    if (trial > 0) return `Testar ${trial} dias grátis`;
    if (planId === "free") return "Voltar para o gratuito";
    return "Contratar esse plano";
  };

  if (checkout) {
    return (
      <div className={styles.step}>
        <div className={styles.glow} aria-hidden="true" />

        <CheckoutPanel
          organizationId={team.id}
          intent={checkout}
          title={checkout.trialDays > 0 ? "Guarde um cartão para começar" : "Falta só o pagamento"}
          description={
            checkout.trialDays > 0
              ? "Nada é cobrado agora. Guardamos o cartão para a assinatura seguir sozinha quando o teste terminar."
              : "Confirme o pagamento para liberar o plano na hora."
          }
          backLabel="Escolher outro plano"
          preview={demo}
          onBack={() => setCheckout(null)}
          onDone={demo ? () => setCheckout(null) : finish}
        />
      </div>
    );
  }

  return (
    <div className={styles.step}>
      <div className={styles.glow} aria-hidden="true" />

      {/* Um cabeçalho só nas duas larguras: logo, título e subtítulo. No mobile o CSS encolhe os três e
          o alternador passa a ocupar a linha toda; nada de árvore paralela. */}
      <header className={styles.header}>
        <Logo variant="logotipo" height={compact ? 30 : 34} />

        <Text as="h2" variant="largeTitle" weight="bold" align="center" className={styles.title}>
          Desbloqueie todos os benefícios
        </Text>

        <Text variant="callout" tone="secondary" align="center" className={styles.subtitle}>
          Diferentes opções, mas todas pensando em te entregar sempre o melhor e mais completo
        </Text>

        <CycleToggle value={cycle} onChange={setCycle} className={styles.cycles} />
      </header>

      {/* Ponto por plano, só no mobile, acima do carrossel. É indicador, não controle: quem navega é o
          arraste, e a região rolável já entrega os cartões ao teclado e ao leitor de tela. */}
      <div className={styles.dots} aria-hidden="true">
        {plans.map((plan, index) => (
          <span key={plan.id} className={styles.dot} data-active={index === active || undefined} />
        ))}
      </div>

      {/* Mesmos cartões nas duas larguras. No mobile a fileira vira carrossel: cada cartão ocupa 88% da
          pista, então sobra a borda do próximo à vista, que é o que conta que há mais para o lado. */}
      <div
        ref={track}
        className={styles.grid}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={swallowClick}
        {...(compact ? { role: "region", "aria-label": "Planos", tabIndex: 0 } : {})}
      >
        {plans.map((plan) => (
          <article
            key={plan.id}
            className={styles.card}
            data-boxed={plan.id !== current || undefined}
            {...squircle("xl")}
          >
            <div className={styles.cardHead}>
              <Text as="h3" variant="headline" weight="semibold">
                {plan.name}
              </Text>
              {/* O teste gratuito toma o lugar do "Popular": informação vale mais que rótulo, e são
                  a mesma etiqueta no mesmo canto, então não competem por espaço. */}
              {trialDaysOf(plan.id) > 0 ? (
                <Badge tone="neutral" size="sm">
                  {trialDaysOf(plan.id)} dias grátis
                </Badge>
              ) : (
                plan.popular && (
                  <Badge tone="neutral" size="sm">
                    Popular
                  </Badge>
                )
              )}
            </div>

            <Text variant="footnote" tone="secondary" className={styles.cardDescription}>
              {plan.description}
            </Text>

            <Price plan={plan} cycle={cycle} />

            <Button
              variant={plan.id === current ? "secondary" : "primary"}
              fullWidth
              radius="md"
              loading={working === plan.id}
              onClick={() => void choose(plan.id)}
            >
              {actionLabel(plan.id)}
            </Button>

            <ul className={styles.features}>
              {plan.features.map((feature) => (
                <li key={feature.label}>
                  <CheckIcon weight="bold" aria-hidden="true" />
                  {/* A nota entra dentro do mesmo texto, e não como irmão no flex da linha: como
                      irmão ela virava a linha inteira sozinha quando o item não cabia. */}
                  <Text as="span" variant="footnote">
                    {feature.label}
                    {feature.note && <span className={styles.note}>{feature.note}</span>}
                  </Text>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}