"use client";

import styled from "@emotion/styled";
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
import { Toast, type ToastAction, type ToastTone } from "@/components/ui/toast";

export type ToastOptions = {
  title: string;
  description: string;
  tone?: ToastTone;
  action?: ToastAction;
  duration?: number;
};

type ToastEntry = ToastOptions & { id: string; open: boolean };

type ToastContextValue = {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
};

const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 5000;
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

function durationOf(entry: ToastEntry) {
  if (entry.duration !== undefined) return entry.duration;
  return entry.tone === "danger" ? 0 : DEFAULT_DURATION;
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
    setEntries((current) => [...current, { ...options, id, open: true }]);
    return id;
  }, []);

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
