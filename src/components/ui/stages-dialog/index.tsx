"use client";

import { ArrowDownIcon, ArrowUpIcon, XIcon, type Icon } from "@phosphor-icons/react";
import { useId, useState, type CSSProperties } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { squircle } from "@/lib/corners";
import { Button } from "../button";
import { Checkbox } from "../checkbox";
import { Dialog } from "../dialog";
import { IconButton } from "../icon-button";
import { Text } from "../text";
import styles from "./stages-dialog.module.css";

/** Uma etapa do catálogo do domínio, como a janela a desenha. */
export type StageOption<S extends string> = { id: S; label: string; icon: Icon; hue: string };

export type StagesDialogProps<S extends string> = {
  open: boolean;
  onClose: () => void;
  /** O nome do quadro cujas etapas estão sendo arrumadas: "Site da Aurora". */
  name: string;
  /** O catálogo inteiro do domínio, na ordem dele: é o que se pode ligar. */
  catalog: readonly StageOption<S>[];
  /** As etapas que o quadro tem hoje, na ordem das colunas. */
  value: S[];
  /** Grava a nova lista. Devolve o erro a mostrar, ou nada quando deu certo. */
  onSave: (stages: S[]) => Promise<string | undefined>;
};

/**
 * As etapas de um quadro, para ligar, desligar e ordenar. Uma janela só para o quadro de tarefas de um
 * projeto e para o funil de vendas: os dois têm a mesma regra (o catálogo é global, e cada quadro escolhe as
 * suas e em que ordem), e desenhar duas janelas para a mesma regra é como elas saem de sincronia.
 *
 * O que ela **não** faz é renomear: o nome de uma etapa é do catálogo, o mesmo em toda a base, e é isso que
 * deixa o filtro da URL ter uma lista fechada e a tarefa saber onde cair em qualquer quadro. Nomear uma etapa
 * nova é acrescentar uma linha ao catálogo, não um campo aqui.
 */
export function StagesDialog<S extends string>({ open, onClose, ...rest }: StagesDialogProps<S>) {
  const mobile = useMediaQuery(MOBILE_QUERY);

  return (
    <Dialog open={open} onClose={onClose} label={`Etapas de ${rest.name}`} size="sm" surface="glass" scrim={mobile} focusOnOpen={false}>
      <StagesForm onClose={onClose} {...rest} />
    </Dialog>
  );
}

function StagesForm<S extends string>({ onClose, name, catalog, value, onSave }: Omit<StagesDialogProps<S>, "open">) {
  const titleId = useId();
  /* A ordem que a pessoa está montando: o que está ligado, na ordem das colunas, e o resto do catálogo em
     seguida, desligado, para poder entrar. */
  const [order, setOrder] = useState<S[]>(() => [...value, ...catalog.map((stage) => stage.id).filter((id) => !value.includes(id))]);
  const [enabled, setEnabled] = useState<Set<S>>(() => new Set(value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = order.filter((id) => enabled.has(id));
  const changed = chosen.length !== value.length || chosen.some((id, index) => id !== value[index]);
  const canSave = chosen.length > 0 && changed;

  const toggle = (id: S) =>
    setEnabled((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const move = (id: S, step: -1 | 1) =>
    setOrder((current) => {
      const index = current.indexOf(id);
      const target = index + step;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const save = async () => {
    if (saving || !canSave) return;
    setSaving(true);
    setError(null);
    const problem = await onSave(chosen);
    setSaving(false);
    if (problem) {
      setError(problem);
      return;
    }
    onClose();
  };

  useFloatingActionsRegistration({
    primary: { label: saving ? "Salvando" : "Salvar etapas", loading: saving, disabled: !canSave, onClick: () => void save() },
    cancel: { label: "Cancelar", onClick: onClose },
  });

  return (
    <div className={styles.dialog} aria-labelledby={titleId}>
      <header className={styles.head}>
        <div className={styles.heading}>
          <Text as="h2" id={titleId} variant="headline" weight="semibold">
            Etapas do quadro
          </Text>
          <Text variant="footnote" tone="secondary" truncate>
            {name}
          </Text>
        </div>
        <IconButton label="Fechar" variant="ghost" size="sm" disabled={saving} onClick={onClose}>
          <XIcon />
        </IconButton>
      </header>

      <div className={styles.body}>
        <Text variant="footnote" tone="secondary">
          Ligue as etapas que este quadro usa e arrume a ordem das colunas. O que está em uma etapa desligada
          continua existindo e volta a aparecer quando ela for ligada de novo.
        </Text>

        <ol className={styles.list}>
          {order.map((id, index) => {
            const stage = catalog.find((entry) => entry.id === id);
            if (!stage) return null;
            const on = enabled.has(id);
            const Glyph = stage.icon;

            return (
              <li key={id} className={styles.row} data-off={!on || undefined} style={{ "--stage-hue": stage.hue } as CSSProperties} {...squircle("md")}>
                <Checkbox checked={on} disabled={saving} onChange={() => toggle(id)} aria-label={`${on ? "Desligar" : "Ligar"} ${stage.label}`} />
                <span className={styles.glyph} aria-hidden="true">
                  <Glyph weight="bold" />
                </span>
                <Text as="span" variant="subheadline" weight="medium" className={styles.label}>
                  {stage.label}
                </Text>
                <span className={styles.order}>
                  <IconButton label={`Subir ${stage.label}`} variant="ghost" size="sm" disabled={saving || index === 0} onClick={() => move(id, -1)}>
                    <ArrowUpIcon />
                  </IconButton>
                  <IconButton label={`Descer ${stage.label}`} variant="ghost" size="sm" disabled={saving || index === order.length - 1} onClick={() => move(id, 1)}>
                    <ArrowDownIcon />
                  </IconButton>
                </span>
              </li>
            );
          })}
        </ol>

        {error && (
          <Text variant="footnote" tone="danger" role="alert">
            {error}
          </Text>
        )}
        {chosen.length === 0 && (
          <Text variant="footnote" tone="secondary">
            Um quadro precisa de ao menos uma etapa.
          </Text>
        )}
      </div>

      <footer className={styles.foot}>
        <Button variant="ghost" size="sm" radius="md" disabled={saving} onClick={onClose}>
          Cancelar
        </Button>
        <Button size="sm" radius="md" loading={saving} disabled={!canSave} onClick={() => void save()}>
          Salvar etapas
        </Button>
      </footer>
    </div>
  );
}
