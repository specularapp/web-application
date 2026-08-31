"use client";

import Script from "next/script";
import { useEffect, useId, useRef } from "react";
import { TURNSTILE_FIELD_NAME } from "@/lib/security/turnstile-field";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
          theme: "auto";
          language: "pt-BR";
          size: "flexible";
          appearance: "interaction-only";
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export { TURNSTILE_FIELD_NAME };

type TurnstileWidgetProps = {
  siteKey: string;
  onVerify?: (token: string) => void;
  onExpire?: () => void;
  onUnavailable?: () => void;
  resetOn?: unknown;
  className?: string;
};

const LOAD_TIMEOUT_MS = 10000;

export function TurnstileWidget({
  siteKey,
  onVerify,
  onExpire,
  onUnavailable,
  resetOn,
  className,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string>(undefined);
  const callbacks = useRef({ onVerify, onExpire, onUnavailable });
  const fieldId = useId();

  useEffect(() => {
    callbacks.current = { onVerify, onExpire, onUnavailable };
  }, [onVerify, onExpire, onUnavailable]);

  const lastReset = useRef(resetOn);

  useEffect(() => {
    if (Object.is(lastReset.current, resetOn)) return;
    lastReset.current = resetOn;
    const widgetId = widgetIdRef.current;
    if (!widgetId || !window.turnstile) return;
    callbacks.current.onExpire?.();
    window.turnstile.reset(widgetId);
  }, [resetOn]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    const setToken = (token: string) => {
      if (token) callbacks.current.onVerify?.(token);
      else callbacks.current.onExpire?.();
    };

    const render = () => {
      if (cancelled || widgetIdRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(container, {
        sitekey: siteKey,
        callback: setToken,
        "expired-callback": () => setToken(""),
        "error-callback": () => setToken(""),
        theme: "auto",
        language: "pt-BR",
        size: "flexible",
        appearance: "interaction-only",
      });
    };

    render();
    const interval = window.setInterval(render, 200);
    // Bloqueador de anúncio ou rede corporativa derruba o script: sem este aviso o botão
    // de enviar fica desabilitado para sempre, sem explicação nenhuma na tela.
    const timeout = window.setTimeout(() => {
      if (!widgetIdRef.current) callbacks.current.onUnavailable?.();
    }, LOAD_TIMEOUT_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.clearTimeout(timeout);
      const widgetId = widgetIdRef.current;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
      widgetIdRef.current = undefined;
    };
  }, [siteKey]);

  return (
    <>
      <Script src={SCRIPT_URL} strategy="afterInteractive" />
      <div ref={containerRef} id={fieldId} className={className} />
    </>
  );
}
