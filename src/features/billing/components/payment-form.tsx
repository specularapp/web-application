"use client";

import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type { StripeElementStyle } from "@stripe/stripe-js";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FieldShell } from "@/components/ui/field-shell";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import styles from "./checkout.module.css";
import { getStripeBrowser } from "./stripe-browser";
import { cardFontSource, useCardStyle } from "./use-card-style";

export type PaymentMode = "setup" | "payment";

type PaymentFormProps = {
  clientSecret: string;
  mode: PaymentMode;
  submitLabel: string;
  pendingLabel: string;
  /** Roda depois de o Stripe confirmar. Devolve mensagem quando o servidor recusa a conclusão. */
  onConfirmed: () => Promise<string | null>;
  footer?: ReactNode;
  /** Vitrine e prévia: monta os campos de verdade, sem intenção no servidor e sem confirmar nada. */
  preview?: boolean;
};

const NOT_READY = "O formulário de pagamento ainda está carregando. Tente de novo em instantes.";
const REFUSED = "Não foi possível concluir o pagamento. Confira os dados e tente de novo.";
const UNREACHABLE = "O cartão foi aceito, mas não conseguimos falar com o servidor. Tente de novo.";

type CardField = { complete: boolean; error: string | null };

const emptyField: CardField = { complete: false, error: null };

function Loading() {
  return (
    <div className={styles.loading} aria-hidden="true">
      <Skeleton shape="rect" height="3rem" />
      <Skeleton shape="rect" height="3rem" />
      <Skeleton shape="rect" height="3rem" />
    </div>
  );
}

type CardFieldProps = { id: string; label: string; state: CardField; children: ReactNode };

// O rótulo é nosso e a caixa é o `FieldShell` de sempre; dentro dela o Stripe monta só o campo. O
// `htmlFor` aponta para o invólucro do elemento, que é o id que a lib aceita: o clique não atravessa
// o iframe, mas o nome do campo para leitor de tela vem do próprio Stripe, já em pt-BR.
function CardField({ id, label, state, children }: CardFieldProps) {
  return (
    <div className={styles.field}>
      <Label htmlFor={id}>{label}</Label>
      <FieldShell size="lg" invalid={Boolean(state.error)}>
        {children}
      </FieldShell>
      {state.error && (
        <Text variant="footnote" tone="danger" role="alert">
          {state.error}
        </Text>
      )}
    </div>
  );
}

type FieldsProps = Omit<PaymentFormProps, "preview"> & { style: StripeElementStyle; preview: boolean };

function Fields({ clientSecret, mode, submitLabel, pendingLabel, onConfirmed, footer, style, preview }: FieldsProps) {
  const stripe = useStripe();
  const elements = useElements();
  // Dois formulários podem viver na mesma página (a vitrine abre os dois), então o id sai do React.
  const group = useId();
  const [mounted, setMounted] = useState(0);
  const [number, setNumber] = useState(emptyField);
  const [expiry, setExpiry] = useState(emptyField);
  const [cvc, setCvc] = useState(emptyField);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = mounted === 3;
  const complete = number.complete && expiry.complete && cvc.complete;
  const options = { style };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || preview) return;

    const card = elements?.getElement(CardNumberElement);
    if (!stripe || !card) {
      setError(NOT_READY);
      return;
    }

    setPending(true);
    setError(null);

    // Só o número entra na chamada: o Stripe junta validade e código sozinho, porque os três campos
    // vieram do mesmo `Elements`. A autenticação do banco, quando o cartão pede, abre num modal do
    // próprio Stripe e a pessoa continua nesta tela.
    const result =
      mode === "setup"
        ? await stripe.confirmCardSetup(clientSecret, { payment_method: { card } })
        : await stripe.confirmCardPayment(clientSecret, { payment_method: { card } });

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
      <div className={styles.fields}>
        <CardField id={`${group}-numero`} label="Número do cartão" state={number}>
          <CardNumberElement
            id={`${group}-numero`}
            className={styles.element}
            options={{ ...options, showIcon: true, placeholder: "0000 0000 0000 0000" }}
            onReady={() => setMounted((count) => count + 1)}
            onChange={(event) => setNumber({ complete: event.complete, error: event.error?.message ?? null })}
          />
        </CardField>

        <div className={styles.pair}>
          <CardField id={`${group}-validade`} label="Validade" state={expiry}>
            <CardExpiryElement
              id={`${group}-validade`}
              className={styles.element}
              options={options}
              onReady={() => setMounted((count) => count + 1)}
              onChange={(event) => setExpiry({ complete: event.complete, error: event.error?.message ?? null })}
            />
          </CardField>

          <CardField id={`${group}-codigo`} label="Código de segurança" state={cvc}>
            <CardCvcElement
              id={`${group}-codigo`}
              className={styles.element}
              options={{ ...options, placeholder: "123" }}
              onReady={() => setMounted((count) => count + 1)}
              onChange={(event) => setCvc({ complete: event.complete, error: event.error?.message ?? null })}
            />
          </CardField>
        </div>
      </div>

      {error && (
        <Text variant="footnote" tone="danger" role="alert" className={styles.error}>
          {error}
        </Text>
      )}

      <Button type="submit" size="lg" radius="lg" fullWidth loading={pending} disabled={preview || !ready || !complete}>
        {pending ? pendingLabel : submitLabel}
      </Button>

      {preview && (
        <Text variant="caption2" tone="tertiary" align="center">
          Prévia de front: sem sessão e sem intenção no Stripe, então o botão fica desligado. Para
          pagar de verdade, entre na conta e vá até a etapa de plano.
        </Text>
      )}

      {footer}
    </form>
  );
}

export function PaymentForm({ preview = false, ...rest }: PaymentFormProps) {
  const style = useCardStyle();
  const stripe = getStripeBrowser();

  if (!stripe) {
    return (
      <Text variant="footnote" tone="danger" role="alert">
        A cobrança ainda não está configurada neste ambiente.
      </Text>
    );
  }

  if (!style) return <Loading />;

  // Campo de cartão avulso monta sem segredo nenhum: o `clientSecret` só é usado na confirmação. É
  // isso que deixa a prévia mostrar o formulário de verdade, e não um lugar reservado.
  return (
    <Elements stripe={stripe} options={{ locale: "pt-BR", fonts: [{ cssSrc: cardFontSource }] }}>
      <Fields {...rest} style={style} preview={preview} />
    </Elements>
  );
}
