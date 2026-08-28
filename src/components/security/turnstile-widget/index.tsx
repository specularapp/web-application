"use client";

import Script from "next/script";
import { useEffect, useId, useRef } from "react";

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
        },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const TURNSTILE_FIELD_NAME = "turnstileToken";

export function TurnstileWidget({ siteKey }: { siteKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const widgetIdRef = useRef<string>(undefined);
  const fieldId = useId();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    const setToken = (token: string) => {
      if (inputRef.current) inputRef.current.value = token;
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
      <div ref={containerRef} id={fieldId} />
      <input ref={inputRef} type="hidden" name={TURNSTILE_FIELD_NAME} defaultValue="" />
    </>
  );
}
