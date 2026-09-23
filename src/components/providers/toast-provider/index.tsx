"use client";

import styled from "@emotion/styled";
import {
  ArchiveIcon,
  CheckCircleIcon,
  CopyIcon,
  CurrencyCircleDollarIcon,
  PaperPlaneTiltIcon,
  PencilSimpleIcon,
  PlusCircleIcon,
  SealCheckIcon,
  TrashIcon,
  UserPlusIcon,
  type Icon,
} from "@phosphor-icons/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";
import { MOBILE_QUERY } from "@/hooks/use-media-query";
import { useCelebration, type CelebrationOptions } from "@/components/providers/celebration-provider";
import { Toast, type ToastAction, type ToastTone } from "@/components/ui/toast";

export type ToastFeedback = Partial<Omit<CelebrationOptions, "title" | "description">> & {
  title?: string;
  description?: string;
};

export type ToastOptions = {
  title: string;
  description: string;
  tone?: ToastTone;
  action?: ToastAction;
  duration?: number;
  /** Ajusta o retorno visual de uma ação bem sucedida. `false` preserva o recibo discreto no canto. */
  feedback?: false | ToastFeedback;
};

type ToastEntry = ToastOptions & { id: string; open: boolean };

type ToastContextValue = {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
};

const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 3000;
const LEAVE_DURATION = 240;

const ToastContext = createContext<ToastContextValue | null>(null);

const Viewport = styled.div`
  position: fixed;
  inset-block-start: var(--space-4);
  inset-inline-end: var(--space-4);
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: min(26rem, calc(100vw - var(--space-8)));
  pointer-events: none;

  @media ${MOBILE_QUERY} {
    inset-inline: var(--space-3);
    inset-block-start: calc(var(--space-3) + env(safe-area-inset-top));
    width: auto;
  }
`;

// Três segundos para todo tom, erro incluído (decisão de 2026-09-04; antes o erro ficava até agir). Quem
// precisar de mais passa `duration`.
function durationOf(entry: ToastEntry) {
  return entry.duration ?? DEFAULT_DURATION;
}

type FeedbackPreset = { icon: Icon; hue: string; confetti: boolean };

function feedbackPreset(title: string): FeedbackPreset {
  const value = title.toLocaleLowerCase("pt-BR");
  if (/(pagamento|paga|pago|recebid|cobrança|despesa|financeir|dinheiro)/.test(value)) {
    return { icon: CurrencyCircleDollarIcon, hue: "var(--sys-green)", confetti: /recebid|pago|quitad/.test(value) };
  }
  if (/(enviad|publicad|compartilhad)/.test(value)) {
    return { icon: PaperPlaneTiltIcon, hue: "var(--sys-blue)", confetti: true };
  }
  if (/(assinad|aprovaid|concluíd|finalizad|ganh)/.test(value)) {
    return { icon: SealCheckIcon, hue: "var(--sys-green)", confetti: true };
  }
  if (/(copiad|duplicad)/.test(value)) {
    return { icon: CopyIcon, hue: "var(--sys-indigo)", confetti: false };
  }
  if (/(excluíd|removid|apagado)/.test(value)) {
    return { icon: TrashIcon, hue: "var(--sys-red)", confetti: false };
  }
  if (/(arquivad)/.test(value)) {
    return { icon: ArchiveIcon, hue: "var(--sys-gray)", confetti: false };
  }
  if (/(convid|membro|pessoa adicionad)/.test(value)) {
    return { icon: UserPlusIcon, hue: "var(--sys-purple)", confetti: true };
  }
  if (/(criad|cadastrad|adicionad|nova |novo )/.test(value)) {
    return { icon: PlusCircleIcon, hue: "var(--sys-blue)", confetti: true };
  }
  if (/(salv|atualiz|alterad|editad|renomead)/.test(value)) {
    return { icon: PencilSimpleIcon, hue: "var(--sys-blue)", confetti: false };
  }
  return { icon: CheckCircleIcon, hue: "var(--sys-green)", confetti: false };
}

function isCompletedAction(title: string) {
  return /(excluíd|removid|apagado|arquivad|cancelad|reabert|restaurad|desconectad|encerrad)/.test(
    title.toLocaleLowerCase("pt-BR"),
  );
}

function ToastItem({ entry, onDismiss }: { entry: ToastEntry; onDismiss: (id: string) => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(durationOf(entry));

  useEffect(() => {
    if (paused || !entry.open || remaining.current <= 0) return;
    const started = Date.now();
    const timer = window.setTimeout(() => onDismiss(entry.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [paused, entry.open, entry.id, onDismiss]);

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
  };

  return (
    <Toast
      title={entry.title}
      description={entry.description}
      tone={entry.tone}
      action={entry.action}
      state={entry.open ? "open" : "closed"}
      onDismiss={() => onDismiss(entry.id)}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={onBlur}
    />
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { celebrate } = useCelebration();
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, open: false } : entry)));
    window.setTimeout(() => {
      setEntries((current) => current.filter((entry) => entry.id !== id));
    }, LEAVE_DURATION);
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    counter.current += 1;
    const id = `toast-${counter.current}`;
    if ((options.tone === "success" || (options.tone === "neutral" && isCompletedAction(options.title))) && options.feedback !== false) {
      const feedback = options.feedback ?? {};
      const preset = feedbackPreset(options.title);
      celebrate({
        title: feedback.title ?? options.title,
        description: feedback.description ?? options.description,
        icon: feedback.icon ?? preset.icon,
        hue: feedback.hue ?? preset.hue,
        confetti: feedback.confetti ?? preset.confetti,
        figure: feedback.figure,
        visual: feedback.visual,
        action: feedback.action,
        closeLabel: feedback.closeLabel,
        children: feedback.children,
      });
      return id;
    }
    setEntries((current) => [...current, { ...options, id, open: true }]);
    return id;
  }, [celebrate]);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);
  const visible = entries.slice(0, MAX_VISIBLE);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Viewport>
        {visible.map((entry) => (
          <ToastItem key={entry.id} entry={entry} onDismiss={dismiss} />
        ))}
      </Viewport>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast precisa estar dentro de ToastProvider");
  return context;
}
