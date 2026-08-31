"use client";

import { useState } from "react";
import { TURNSTILE_FIELD_NAME, TurnstileWidget } from "@/components/security/turnstile-widget";
import styles from "./auth-form.module.css";

export const TURNSTILE_UNAVAILABLE =
  "Não conseguimos carregar a verificação de segurança. Desative bloqueadores para este site e recarregue a página.";

export function useTurnstile(siteKey: string | undefined, resetOn: unknown) {
  const [token, setToken] = useState("");
  const [unavailable, setUnavailable] = useState(false);

  const field = siteKey ? (
    <>
      <TurnstileWidget
        siteKey={siteKey}
        onVerify={(value) => {
          setToken(value);
          setUnavailable(false);
        }}
        onExpire={() => setToken("")}
        onUnavailable={() => setUnavailable(true)}
        resetOn={resetOn}
        className={styles.turnstile}
      />
      <input type="hidden" name={TURNSTILE_FIELD_NAME} value={token} readOnly />
    </>
  ) : null;

  return { verified: !siteKey || token !== "", unavailable, field };
}
