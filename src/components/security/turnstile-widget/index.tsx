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
  className?: string;
};

export function TurnstileWidget({ siteKey, onVerify, onExpire, className }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const widgetIdRef = useRef<string>(undefined);
  const callbacks = useRef({ onVerify, onExpire });
  const fieldId = useId();

  useEffect(() => {
    callbacks.current = { onVerify, onExpire };
  }, [onVerify, onExpire]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    const setToken = (token: string) => {
      if (inputRef.current) inputRef.current.value = token;
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

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      const widgetId = widgetIdRef.current;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
      widgetIdRef.current = undefined;
    };
  }, [siteKey]);

  return (
    <>
      <Script src={SCRIPT_URL} strategy="afterInteractive" />
      <div ref={containerRef} id={fieldId} className={className} />
      <input ref={inputRef} type="hidden" name={TURNSTILE_FIELD_NAME} defaultValue="" />
    </>
  );
}
