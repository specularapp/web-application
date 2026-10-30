"use client";

import { CheckIcon, CopySimpleIcon, KeyIcon } from "@phosphor-icons/react";
import { formatDistanceStrict, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useState, type ReactNode } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import styles from "./integrations.module.css";

export const ago = (iso: string) => formatDistanceStrict(parseISO(iso), new Date(), { locale: ptBR, addSuffix: true });

export const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

export const normalize = (text: string) => text.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{Diacritic}/gu, "");

export function useCopy() {
  const { toast } = useToast();
  return async (text: string, title = "Copiado") => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title, description: text.length > 80 ? `${text.slice(0, 80)}…` : text, tone: "success" });
    } catch {
      toast({ title: "Não deu para copiar", description: text, tone: "warning" });
    }
  };
}

export type SecretReveal = { title: string; description: string; secret: string; example?: { label: string; code: string } };

/**
 * O segredo aparece uma vez só (2026-10-29, como na Le Ange): ao criar e ao renovar. A janela diz isso antes do
 * valor, deixa copiar com um toque e só fecha pelo "Já copiei", que é o que a pessoa precisa ter feito.
 */
export function SecretDialog({ reveal, onClose }: { reveal: SecretReveal | null; onClose: () => void }) {
  const copy = useCopy();
  const [copied, setCopied] = useState(false);

  const close = () => {
    setCopied(false);
    onClose();
  };

  return (
    <Dialog open={reveal !== null} onClose={close} label={reveal?.title ?? "Segredo"} size="md" surface="solid" focusOnOpen={false}>
      {reveal && (
        <>
          <DialogHeader
            title={reveal.title}
            description={reveal.description}
            before={
              <span className={styles.dialogMark} aria-hidden="true">
                <KeyIcon />
              </span>
            }
            onClose={close}
          />
          <div className={styles.dialogBody}>
            <Text variant="footnote" className={styles.warning}>
              Copie agora. Por segurança o valor não fica guardado e não aparece de novo; se perder, renove.
            </Text>
            <div className={styles.secret}>
              <code>{reveal.secret}</code>
              <Button
                variant="outline"
                size="sm"
                radius="md"
                iconStart={copied ? <CheckIcon /> : <CopySimpleIcon />}
                onClick={() => void copy(reveal.secret).then(() => setCopied(true))}
              >
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
            {reveal.example && (
              <div className={styles.docBlock}>
                <div className={styles.codeHead}>
                  <Text as="h3" variant="subheadline" weight="semibold">
                    {reveal.example.label}
                  </Text>
                  <Button variant="ghost" size="sm" radius="md" iconStart={<CopySimpleIcon />} onClick={() => void copy(reveal.example?.code ?? "")}>
                    Copiar exemplo
                  </Button>
                </div>
                <pre className={styles.code}>{reveal.example.code}</pre>
              </div>
            )}
          </div>
          <DialogFooter mobile="always">
            <Button size="sm" radius="md" onClick={close}>
              Já copiei
            </Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  );
}

export type Choice = { id: string; label: string; description: string };

/** Um grupo de caixas de marcar com atalhos na ponta: os eventos de um webhook, as permissões de uma chave. */
export function Choices({
  legend,
  options,
  value,
  onChange,
  shortcuts,
  error,
  disabled,
}: {
  legend: string;
  options: readonly Choice[];
  value: string[];
  onChange: (next: string[]) => void;
  shortcuts: { label: string; ids: string[] }[];
  error?: string;
  disabled?: boolean;
}) {
  const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((item) => item !== id));

  return (
    <fieldset className={styles.choices} disabled={disabled} aria-describedby={error ? "choices-error" : undefined}>
      <div className={styles.choicesHead}>
        <legend>{legend}</legend>
        <span className={styles.choicesShortcuts}>
          {shortcuts.map((shortcut) => (
            <Button key={shortcut.label} type="button" variant="ghost" size="sm" radius="md" onClick={() => onChange(shortcut.ids)}>
              {shortcut.label}
            </Button>
          ))}
        </span>
      </div>
      <div className={styles.choiceGrid}>
        {options.map((option) => {
          const checked = value.includes(option.id);
          return (
            <div key={option.id} className={styles.choice} data-checked={checked || undefined}>
              <Checkbox checked={checked} onChange={(event) => toggle(option.id, event.target.checked)}>
                <span className={styles.choiceCopy}>
                  <Text as="span" variant="footnote" weight="medium">
                    {option.label}
                  </Text>
                  <Text as="span" variant="caption1" tone="secondary">
                    {option.description}
                  </Text>
                  <code>{option.id}</code>
                </span>
              </Checkbox>
            </div>
          );
        })}
      </div>
      {error && (
        <p id="choices-error" role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** Um bloco de código com o título e o copiar na ponta. */
export function CodeBlock({ title, code, copyLabel = "Copiar", children }: { title: string; code: string; copyLabel?: string; children?: ReactNode }) {
  const copy = useCopy();
  return (
    <div className={styles.docBlock}>
      <div className={styles.codeHead}>
        <Text as="h3" variant="subheadline" weight="semibold">
          {title}
        </Text>
        <Button variant="ghost" size="sm" radius="md" iconStart={<CopySimpleIcon />} onClick={() => void copy(code)}>
          {copyLabel}
        </Button>
      </div>
      {children}
      <pre className={styles.code}>
        {code}
      </pre>
    </div>
  );
}
