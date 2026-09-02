"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import styles from "./checkout.module.css";
import { getStripeBrowser } from "./stripe-browser";
import { useStripeAppearance } from "./use-stripe-appearance";

export type PaymentMode = "setup" | "payment";

type PaymentFormProps = {
  clientSecret: string;
  mode: PaymentMode;
  submitLabel: string;
  pendingLabel: string;
  /** Roda depois de o Stripe confirmar. Devolve mensagem quando o servidor recusa a conclusão. */
  onConfirmed: () => Promise<string | null>;
  footer?: ReactNode;
};

const NOT_READY = "O formulário de pagamento ainda está carregando. Tente de novo em instantes.";
const REFUSED = "Não foi possível concluir o pagamento. Confira os dados e tente de novo.";
const UNREACHABLE = "O cartão foi aceito, mas não conseguimos falar com o servidor. Tente de novo.";

function Fields({ mode, submitLabel, pendingLabel, onConfirmed, footer }: Omit<PaymentFormProps, "clientSecret">) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    if (!stripe || !elements) {
      setError(NOT_READY);
      return;
    }

    setPending(true);
    setError(null);

    // `redirect: "if_required"` mantém a pessoa aqui: cartão confirma na própria tela e a
    // autenticação de dois fatores do banco abre num modal do Stripe, sem sair do fluxo.
    const result =
      mode === "setup"
        ? await stripe.confirmSetup({ elements, redirect: "if_required" })
        : await stripe.confirmPayment({ elements, redirect: "if_required" });

    if (result.error) {
      setError(result.error.message ?? REFUSED);
      setPending(false);
      return;
    }

    // O cartão já foi confirmado no Stripe. Se a conclusão no servidor cair, o botão precisa voltar
    // para o normal com a mensagem, senão fica travado em loading e a pessoa não tem como tentar de
    // novo. Confirmar duas vezes é seguro: a chave de idempotência devolve a mesma assinatura.
    try {
      const failure = await onConfirmed();
      if (failure) {
        setError(failure);
        setPending(false);
      }
    } catch {
      setError(UNREACHABLE);
      setPending(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {!ready && (
        <div className={styles.loading} aria-hidden="true">
          <Skeleton shape="rect" height="3rem" />
          <Skeleton shape="rect" height="3rem" />
          <Skeleton shape="rect" height="3rem" />
        </div>
      )}

      <PaymentElement options={{ layout: "tabs" }} onReady={() => setReady(true)} />

      {error && (
        <Text variant="footnote" tone="danger" role="alert" className={styles.error}>
          {error}
        </Text>
      )}

      <Button type="submit" size="lg" radius="lg" fullWidth loading={pending} disabled={!ready}>
        {pending ? pendingLabel : submitLabel}
      </Button>

      {footer}
    </form>
  );
}

export function PaymentForm({ clientSecret, ...rest }: PaymentFormProps) {
  const appearance = useStripeAppearance();
  const stripe = getStripeBrowser();

  if (!stripe) {
    return (
      <Text variant="footnote" tone="danger" role="alert">
        A cobrança ainda não está configurada neste ambiente.
      </Text>
    );
  }

  if (!appearance) {
    return (
      <div className={styles.loading} aria-hidden="true">
        <Skeleton shape="rect" height="3rem" />
        <Skeleton shape="rect" height="3rem" />
        <Skeleton shape="rect" height="3rem" />
      </div>
    );
  }

  // A chave é o segredo: o Elements não aceita troca de `clientSecret` depois de montado, então cada
  // intenção nova monta um provider novo em vez de tentar atualizar o mesmo.
  return (
    <Elements key={clientSecret} stripe={stripe} options={{ clientSecret, appearance, locale: "pt-BR" }}>
      <Fields {...rest} />
    </Elements>
  );
}
