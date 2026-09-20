"use client";

import { XIcon } from "@phosphor-icons/react";
import { useId, useState, type FormEvent } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "../button";
import { Dialog } from "../dialog";
import { Field } from "../field";
import { IconButton } from "../icon-button";
import { Input } from "../input";
import { Text } from "../text";
import styles from "./name-dialog.module.css";

export type NameDialogProps = {
  open: boolean;
  onClose: () => void;
  /** A pergunta: "Nova pasta", "Renomear funil". */
  title: string;
  /** Uma linha sob o título, quando o nome precisa de contexto: "Dentro de Clientes". */
  description?: string;
  /** O rótulo do campo; o padrão é "Nome". */
  label?: string;
  placeholder?: string;
  /** O nome que já existe, ao renomear; vazio ao criar. */
  initialValue?: string;
  maxLength?: number;
  confirmLabel?: string;
  pendingLabel?: string;
  /** Devolve o erro a mostrar no campo, ou nada quando deu certo e a janela pode fechar. */
  onSubmit: (name: string) => Promise<string | undefined>;
};

/**
 * A janela de um nome só, uma para toda a aplicação: criar uma pasta, renomear um funil, batizar um quadro.
 *
 * Nasceu em 2026-09-17, quando o menu lateral ganhou o leque de pasta e projeto e três telas iam desenhar a
 * mesma caixinha com um campo. É o par da `ConfirmDialog`: aquela pergunta "tem certeza?", esta pergunta
 * "como se chama?". Quem chama decide o que fazer com o nome e devolve o erro do servidor, que acende no
 * próprio campo em vez de virar um aviso solto.
 */
export function NameDialog({ open, onClose, ...rest }: NameDialogProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);

  return (
    <Dialog open={open} onClose={onClose} label={rest.title} size="sm" surface="glass" scrim={mobile} focusOnOpen={!mobile}>
      <NameForm onClose={onClose} {...rest} />
    </Dialog>
  );
}

function NameForm({
  onClose,
  title,
  description,
  label = "Nome",
  placeholder,
  initialValue = "",
  maxLength = 60,
  confirmLabel,
  pendingLabel = "Salvando",
  onSubmit,
}: Omit<NameDialogProps, "open">) {
  const titleId = useId();
  const [name, setName] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filled = name.trim().length > 0 && name.trim() !== initialValue.trim();
  const action = confirmLabel ?? (initialValue ? "Renomear" : "Criar");

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (saving || !filled) return;
    setSaving(true);
    setError(null);
    const problem = await onSubmit(name.trim());
    setSaving(false);
    if (problem) {
      setError(problem);
      return;
    }
    onClose();
  };

  useFloatingActionsRegistration({
    primary: { label: saving ? pendingLabel : action, loading: saving, disabled: !filled, onClick: () => void submit() },
    cancel: { label: "Cancelar", onClick: onClose },
  });

  return (
    <form className={styles.dialog} aria-labelledby={titleId} onSubmit={(event) => void submit(event)}>
      <header className={styles.head}>
        <div className={styles.heading}>
          <Text as="h2" id={titleId} variant="headline" weight="semibold">
            {title}
          </Text>
          {description && (
            <Text variant="footnote" tone="secondary">
              {description}
            </Text>
          )}
        </div>
        <IconButton label="Fechar" variant="ghost" size="sm" disabled={saving} onClick={onClose}>
          <XIcon />
        </IconButton>
      </header>

      <div className={styles.body}>
        <Field label={label} error={error ?? undefined} required>
          <Input
            type="text"
            value={name}
            maxLength={maxLength}
            placeholder={placeholder}
            disabled={saving}
            invalid={Boolean(error)}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
      </div>

      <footer className={styles.foot}>
        <Button type="button" variant="ghost" size="sm" radius="md" disabled={saving} onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" radius="md" loading={saving} disabled={!filled}>
          {saving ? pendingLabel : action}
        </Button>
      </footer>
    </form>
  );
}
