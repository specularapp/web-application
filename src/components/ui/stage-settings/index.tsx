"use client";

import { DotsSixVerticalIcon, PlusIcon, TrashIcon, XIcon } from "@phosphor-icons/react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { squircle } from "@/lib/corners";
import { Button } from "../button";
import { Dialog } from "../dialog";
import { Field } from "../field";
import { IconButton } from "../icon-button";
import { Input } from "../input";
import { Select, type SelectOption } from "../select";
import { Text } from "../text";
import styles from "./stage-settings.module.css";

/**
 * As etapas de um quadro e a cara de um nó da árvore, num lugar só (2026-09-22, a pedido: "precisa pegar
 * literalmente o component de etapas do funil, e adaptar para etapas da tarefa, quero literalmente a mesma
 * coisa visual").
 *
 * Nasceu no funil de vendas e subiu para cá inteiro, com o CSS junto: a janela, a tabela de uma linha por
 * etapa, o arrastar na vertical, a lista de destinos do que sai e o par de ações. O que muda de um domínio
 * para o outro fica de fora, em props: as cores que ele oferece, o nome da terceira coluna (o "Resultado" do
 * funil, o "Significa" da tarefa) e o que se move quando uma etapa sai.
 *
 * A peça é **controlada**: cada domínio guarda o rascunho e a regra dele (no funil o id da etapa muda quando
 * o desfecho muda; nas tarefas a etapa é linha de tabela com id próprio), e aqui mora só o que os dois têm
 * igual, que é a tela.
 */

/**
 * A amostra de uma cor, para o seletor mostrar o matiz ao lado do nome. Sai daqui porque é a mesma bolinha
 * nos dois domínios, e uma cópia em cada um sairia de medida na primeira mexida.
 */
export function Swatch({ hue }: { hue: string }) {
  return <span className={styles.swatch} style={{ backgroundColor: `var(--sys-${hue})` } as CSSProperties} />;
}

/** Uma linha da tabela: a chave para o arraste, o nome, a cor e a terceira coluna do domínio. */
export type StageRow = { key: string; label: string; hue: string; aspect: string };

export type StageSettingsDialogProps = {
  open?: boolean;
  /** O nome do quadro cujas etapas estão sendo arrumadas. */
  name: string;
  rows: StageRow[];
  onRowsChange: (rows: StageRow[]) => void;
  /** As cores que este domínio oferece, com a amostra ao lado do nome. */
  colorOptions: readonly SelectOption<string>[];
  /** A terceira coluna: o nome dela e o que ela oferece. */
  aspect: { label: string; options: readonly SelectOption<string>[] };
  /** O que se move quando uma etapa sai: "oportunidades", "tarefas". */
  itemsLabel: string;
  /** As etapas que saíram da tabela e precisam de destino, com o nome que tinham. */
  removals: { key: string; label: string }[];
  destinations: Record<string, string>;
  onDestinationChange: (key: string, to: string) => void;
  onAdd: () => void;
  /** "Usar etapas padrão", quando o domínio tem um padrão a oferecer. */
  onReset?: () => void;
  /** Teto de etapas; passando dele, acrescentar fica mudo. */
  max?: number;
  saving: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: () => void;
};

export function StageSettingsDialog({ open = true, onClose, ...rest }: StageSettingsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} label={`Etapas de ${rest.name}`} size="lg" surface="solid" className={styles.stagesPanel}>
      <StageSettingsForm onClose={onClose} {...rest} />
    </Dialog>
  );
}

function StageSettingsForm({
  name,
  rows,
  onRowsChange,
  colorOptions,
  aspect,
  itemsLabel,
  removals,
  destinations,
  onDestinationChange,
  onAdd,
  onReset,
  max = 40,
  saving,
  error,
  onClose,
  onSave,
}: Omit<StageSettingsDialogProps, "open">) {
  const dragId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reorder = ({ active, over }: DragEndEvent) => {
    if (saving || !over || active.id === over.id) return;
    const from = rows.findIndex((entry) => entry.key === active.id);
    const to = rows.findIndex((entry) => entry.key === over.id);
    if (from < 0 || to < 0) return;
    onRowsChange(arrayMove(rows, from, to));
  };

  const change = (key: string, values: Partial<StageRow>) =>
    onRowsChange(rows.map((entry) => (entry.key === key ? { ...entry, ...values } : entry)));

  useFloatingActionsRegistration({
    primary: { label: "Salvar etapas", loading: saving, disabled: rows.length === 0, onClick: onSave },
    extras: [{ label: "Nova etapa", icon: <PlusIcon weight="bold" />, onClick: onAdd }],
    cancel: { label: "Cancelar", onClick: onClose },
  });

  return (
    <div className={styles.dialog}>
      <header className={styles.head}>
        <Text as="h2" variant="headline">
          Etapas de {name}
        </Text>
        <IconButton size="sm" label="Fechar" variant="ghost" disabled={saving} onClick={onClose}>
          <XIcon />
        </IconButton>
      </header>

      <div className={styles.body}>
        <div className={styles.stageTable} {...squircle("md")}>
          <div className={styles.tableHead} aria-hidden="true">
            <span />
            <span>Nome da etapa</span>
            <div className={styles.pair}>
              <span>Cor</span>
              <span>{aspect.label}</span>
            </div>
            <span />
          </div>

          <DndContext
            id={dragId}
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={reorder}
            accessibility={{
              screenReaderInstructions: {
                draggable: "Pressione espaço para pegar a etapa, use as setas para mover e espaço para soltar. Escape cancela.",
              },
              announcements: {
                onDragStart: () => "Etapa selecionada para mover",
                onDragOver: () => "Movendo etapa",
                onDragEnd: () => "Ordenação concluída",
                onDragCancel: () => "Ordenação cancelada",
              },
            }}
          >
            <SortableContext items={rows.map((entry) => entry.key)} strategy={verticalListSortingStrategy}>
              {rows.map((entry, index) => (
                <SortableStage key={entry.key} id={entry.key} index={index} disabled={saving}>
                  <Field label={`Nome da etapa ${index + 1}`} required>
                    <Input
                      size="sm"
                      className={styles.stageControl}
                      value={entry.label}
                      maxLength={60}
                      disabled={saving}
                      onChange={(event) => change(entry.key, { label: event.target.value })}
                    />
                  </Field>
                  <div className={styles.pair}>
                    <Field label="Cor">
                      <Select
                        size="sm"
                        className={styles.stageControl}
                        label={`Cor da etapa ${index + 1}`}
                        value={entry.hue}
                        options={[...colorOptions]}
                        disabled={saving}
                        onChange={(hue) => change(entry.key, { hue: String(hue) })}
                      />
                    </Field>
                    <Field label={aspect.label}>
                      <Select
                        size="sm"
                        className={styles.stageControl}
                        label={`${aspect.label} da etapa ${index + 1}`}
                        value={entry.aspect}
                        options={[...aspect.options]}
                        disabled={saving}
                        onChange={(value) => change(entry.key, { aspect: String(value) })}
                      />
                    </Field>
                  </div>
                  <div className={styles.rowActions}>
                    <IconButton
                      size="sm"
                      label={`Remover etapa ${index + 1}`}
                      title="Remover etapa"
                      variant="ghost"
                      disabled={saving}
                      onClick={() => onRowsChange(rows.filter((item) => item.key !== entry.key))}
                    >
                      <TrashIcon />
                    </IconButton>
                  </div>
                </SortableStage>
              ))}
            </SortableContext>
          </DndContext>

          {rows.length === 0 && (
            <Text className={styles.empty} tone="secondary">
              Adicione uma etapa para organizar este quadro
            </Text>
          )}
        </div>

        <div className={styles.actions}>
          <Button size="sm" variant="outline" iconStart={<PlusIcon />} disabled={saving || rows.length >= max} onClick={onAdd}>
            Nova etapa
          </Button>
          {onReset && (
            <Button size="sm" variant="ghost" disabled={saving} onClick={onReset}>
              Usar etapas padrão
            </Button>
          )}
        </div>

        {removals.map((removal) => (
          <Field key={removal.key} label={`Mover ${itemsLabel} de ${removal.label} para`} required>
            <Select
              size="sm"
              className={styles.stageControl}
              label={`Destino de ${removal.label}`}
              value={destinations[removal.key] ?? ""}
              options={[
                { value: "", label: "Escolher destino" },
                ...rows.map((entry, index) => ({ value: entry.key, label: entry.label || `Etapa ${index + 1}` })),
              ]}
              disabled={saving}
              onChange={(value) => onDestinationChange(removal.key, String(value))}
            />
          </Field>
        ))}

        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </div>

      <footer className={styles.foot}>
        <Button size="sm" variant="secondary" disabled={saving} onClick={onClose}>
          Cancelar
        </Button>
        <Button size="sm" loading={saving} disabled={rows.length === 0} onClick={onSave}>
          Salvar etapas
        </Button>
      </footer>
    </div>
  );
}

function SortableStage({ id, index, disabled, children }: { id: string; index: number; disabled: boolean; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });

  return (
    <section
      ref={setNodeRef}
      className={styles.row}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-label={`Etapa ${index + 1}`}
    >
      <IconButton
        size="sm"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        label={`Arrastar etapa ${index + 1}`}
        title="Arrastar para reordenar"
        variant="ghost"
        className={styles.dragHandle}
        disabled={disabled}
      >
        <DotsSixVerticalIcon />
      </IconButton>
      {children}
    </section>
  );
}

/**
 * A cara de um nó da árvore: o nome, o ícone e a cor. Também veio do funil de vendas inteira, e serve pasta e
 * folha nos dois domínios; quem não tem ícone (a pasta do funil) simplesmente não passa a lista deles.
 */
export type AppearanceValue = { name: string; hue: string; glyph: string };

export type AppearanceDialogProps = {
  open?: boolean;
  title: string;
  /** Sem a lista de ícones, a janela mostra só nome e cor, que é o caso da pasta do funil. */
  glyphOptions?: readonly SelectOption<string>[];
  /** O campo de nome, que some quando o nó já é nomeado em outro lugar: o quadro, na ficha do projeto. */
  withName?: boolean;
  colorOptions: readonly SelectOption<string>[];
  /** Os nomes dos dois campos, que mudam com o que está sendo editado: "Cor da pasta", "Ícone do funil". */
  labels?: { glyph?: string; hue?: string };
  initial?: Partial<AppearanceValue>;
  onClose: () => void;
  /** Grava e devolve o erro a mostrar, ou nada quando deu certo. */
  onSave: (value: AppearanceValue) => Promise<string | undefined>;
};

export function AppearanceDialog({ open = true, onClose, ...rest }: AppearanceDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} label={rest.title} size="md" surface="solid">
      <AppearanceForm onClose={onClose} {...rest} />
    </Dialog>
  );
}

function AppearanceForm({ title, glyphOptions, colorOptions, labels, initial, withName = true, onClose, onSave }: Omit<AppearanceDialogProps, "open">) {
  const [value, setValue] = useState<AppearanceValue>({
    name: initial?.name ?? "",
    hue: initial?.hue ?? String(colorOptions[0]?.value ?? "blue"),
    glyph: initial?.glyph ?? String(glyphOptions?.[0]?.value ?? ""),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const ready = !withName || Boolean(value.name.trim());

  const save = async () => {
    if (busy.current || !ready) return;
    busy.current = true;
    setSaving(true);
    setError(null);

    const problem = await onSave({ ...value, name: value.name.trim() });

    busy.current = false;
    setSaving(false);

    if (problem) {
      setError(problem);
      return;
    }

    onClose();
  };

  useFloatingActionsRegistration({
    primary: { label: "Salvar", loading: saving, disabled: !ready, onClick: () => void save() },
    cancel: { label: "Cancelar", onClick: onClose },
  });

  return (
    <form
      className={styles.dialog}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <header className={styles.head}>
        <Text as="h2" variant="headline">
          {title}
        </Text>
        <IconButton label="Fechar" variant="ghost" size="sm" disabled={saving} onClick={onClose}>
          <XIcon />
        </IconButton>
      </header>

      <div className={styles.body}>
        {withName && (
          <Field label="Nome" required>
            <Input value={value.name} maxLength={60} disabled={saving} onChange={(event) => setValue({ ...value, name: event.target.value })} />
          </Field>
        )}
        <div className={glyphOptions ? styles.pair : undefined}>
          {glyphOptions && (
            <Field label={labels?.glyph ?? "Ícone"}>
              <Select
                label={labels?.glyph ?? "Ícone"}
                value={value.glyph}
                options={[...glyphOptions]}
                disabled={saving}
                onChange={(glyph) => setValue({ ...value, glyph: String(glyph) })}
              />
            </Field>
          )}
          <Field label={labels?.hue ?? "Cor"}>
            <Select
              label={labels?.hue ?? "Cor"}
              value={value.hue}
              options={[...colorOptions]}
              disabled={saving}
              onChange={(hue) => setValue({ ...value, hue: String(hue) })}
            />
          </Field>
        </div>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </div>

      <footer className={styles.foot}>
        <Button variant="secondary" disabled={saving} onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving} disabled={!ready}>
          Salvar
        </Button>
      </footer>
    </form>
  );
}
