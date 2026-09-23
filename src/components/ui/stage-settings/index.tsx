"use client";

import styled from "@emotion/styled";
import { CaretRightIcon, CaretUpDownIcon, DotsSixVerticalIcon, PlusIcon, TrashIcon, XIcon } from "@phosphor-icons/react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { layerMotion } from "@/components/ui/styles";
import { useAnchoredPosition } from "@/hooks/use-anchored-position";
import { isTopLayer, useLayer } from "@/hooks/use-layer";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { useOutsideDismiss } from "@/hooks/use-outside-dismiss";
import { usePresence } from "@/hooks/use-presence";
import { rounded } from "@/lib/corners";
import { cx } from "@/lib/utils/cx";
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
  const mobile = useMediaQuery(MOBILE_QUERY);

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
    cancel: { label: "Fechar", onClick: onClose },
  });

  /* No celular a tabela não cabe: cada etapa vira uma linha que abre a própria bandeja de edição. */
  const [editing, setEditing] = useState<string | null>(null);
  const editingIndex = rows.findIndex((entry) => entry.key === editing);
  const aspectLabel = (value: string) => aspect.options.find((option) => option.value === value)?.label ?? "";

  /* Etapa nova já nasce com o cursor no nome: é a primeira coisa que ela pede. No celular ela abre direto na
     bandeja, que foca o nome ao abrir. */
  const [known, setKnown] = useState(rows.length);
  const [fresh, setFresh] = useState(false);
  if (rows.length !== known) {
    setKnown(rows.length);
    if (mobile && rows.length > known) {
      setEditing(rows[rows.length - 1]?.key ?? null);
      setFresh(true);
    }
  }

  const table = useRef<HTMLDivElement>(null);
  const count = useRef(rows.length);

  useEffect(() => {
    if (!mobile && rows.length > count.current) {
      const names = table.current?.querySelectorAll<HTMLInputElement>("input[data-stage-name]");
      names?.[names.length - 1]?.focus();
    }
    count.current = rows.length;
  }, [mobile, rows.length]);

  return (
    <div className={styles.dialog}>
      <header className={styles.head}>
        <Text as="h2" variant="headline">
          Etapas de {name}
        </Text>
        {!mobile && (
          <IconButton size="sm" label="Fechar" variant="ghost" disabled={saving} onClick={onClose}>
            <XIcon />
          </IconButton>
        )}
      </header>

      <div className={styles.body}>
        <div ref={table} className={styles.stageTable} {...rounded("md")}>
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
              {rows.map((entry, index) =>
                mobile ? (
                  <SortableStage key={entry.key} id={entry.key} index={index} disabled={saving} className={styles.mobileRow}>
                    <button type="button" className={styles.stageSummary} onClick={() => {
                        setFresh(false);
                        setEditing(entry.key);
                      }}
                      {...rounded("md")}
                    >
                      <Swatch hue={entry.hue} />
                      <span className={styles.stageSummaryText}>
                        <Text as="span" variant="subheadline" weight="medium" className={styles.stageSummaryName}>
                          {entry.label || `Etapa ${index + 1}`}
                        </Text>
                        <Text as="span" variant="footnote" tone="secondary">
                          {aspectLabel(entry.aspect)}
                        </Text>
                      </span>
                      <CaretRightIcon aria-hidden="true" />
                    </button>
                  </SortableStage>
                ) : (
                <SortableStage key={entry.key} id={entry.key} index={index} disabled={saving}>
                  <Field label={`Nome da etapa ${index + 1}`} required>
                    <Input
                      size="sm"
                      data-stage-name=""
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
                        surface="glass"
                        indicator="toggle"
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
                        surface="glass"
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
                ),
              )}
            </SortableContext>
          </DndContext>

          {rows.length === 0 && (
            <Text className={styles.empty} tone="secondary">
              Adicione uma etapa para organizar este quadro
            </Text>
          )}
        </div>

        <div className={styles.actions}>
          {!mobile && (
            <Button size="sm" variant="outline" iconStart={<PlusIcon />} disabled={saving || rows.length >= max} onClick={onAdd}>
              Nova etapa
            </Button>
          )}
          {onReset && (
            <Button size="sm" variant="ghost" disabled={saving} onClick={onReset}>
              Usar etapas padrão
            </Button>
          )}
        </div>

        {removals.map((removal) => (
          <Field key={removal.key} label={`Mover ${itemsLabel} de ${removal.label} para`} required>
            <Select
              surface="glass"
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
        <Button size="sm" loading={saving} disabled={rows.length === 0} onClick={onSave}>
          Salvar etapas
        </Button>
      </footer>

      {mobile && (
        <Dialog open={editingIndex >= 0} onClose={() => setEditing(null)} label="Editar etapa" size="sm" surface="glass" focusOnOpen={fresh}>
          {editingIndex >= 0 && (
            <StageSheet
              index={editingIndex}
              row={rows[editingIndex]}
              colorOptions={colorOptions}
              aspect={aspect}
              disabled={saving}
              onChange={(values) => change(rows[editingIndex].key, values)}
              onRemove={() => {
                const key = rows[editingIndex].key;
                setEditing(null);
                onRowsChange(rows.filter((item) => item.key !== key));
              }}
              onClose={() => setEditing(null)}
            />
          )}
        </Dialog>
      )}
    </div>
  );
}

/** A bandeja de uma etapa no celular: o nome, a cor e o significado, com remover e fechar na barra. */
function StageSheet({
  index,
  row,
  colorOptions,
  aspect,
  disabled,
  onChange,
  onRemove,
  onClose,
}: {
  index: number;
  row: StageRow;
  colorOptions: readonly SelectOption<string>[];
  aspect: StageSettingsDialogProps["aspect"];
  disabled: boolean;
  onChange: (values: Partial<StageRow>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  useFloatingActionsRegistration({
    extras: [{ label: "Remover etapa", icon: <TrashIcon weight="bold" />, disabled, onClick: onRemove }],
    cancel: { label: "Fechar", onClick: onClose },
  });

  return (
    <div className={styles.dialog}>
      <header className={styles.head}>
        <Text as="h2" variant="headline">
          {row.label || `Etapa ${index + 1}`}
        </Text>
      </header>
      <div className={styles.body}>
        <Field label="Nome da etapa" required>
          <Input value={row.label} maxLength={60} disabled={disabled} onChange={(event) => onChange({ label: event.target.value })} />
        </Field>
        <Field label="Cor">
          <Select
            surface="glass"
            indicator="toggle"
            label="Cor da etapa"
            value={row.hue}
            options={[...colorOptions]}
            disabled={disabled}
            onChange={(hue) => onChange({ hue: String(hue) })}
          />
        </Field>
        <Field label={aspect.label}>
          <Select
            surface="glass"
            label={`${aspect.label} da etapa`}
            value={row.aspect}
            options={[...aspect.options]}
            disabled={disabled}
            onChange={(value) => onChange({ aspect: String(value) })}
          />
        </Field>
      </div>
    </div>
  );
}

function SortableStage({
  id,
  index,
  disabled,
  className,
  children,
}: {
  id: string;
  index: number;
  disabled: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });

  return (
    <section
      ref={setNodeRef}
      className={className ?? styles.row}
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

export type AppearancePopoverProps = Omit<AppearanceDialogProps, "open" | "onClose"> & {
  /** O nome do botão próprio; sem ele a caixa não desenha gatilho e abre ancorada em `anchor`. */
  triggerLabel?: string;
  renderHeaderAction?: (close: () => void) => ReactNode;
  /**
   * A caixa aberta de fora, colada em quem pediu (2026-09-23, a pedido: a cor do quadro abre igual a edição da
   * pasta): quem chama monta a caixa já aberta e a ancora na linha do menu, sem o chevron próprio.
   */
  anchor?: RefObject<HTMLElement | null>;
  /** Avisa quem montou a caixa ancorada que ela fechou, para ela sair da árvore. */
  onClose?: () => void;
};

const APPEARANCE_WIDTH = 320;
const APPEARANCE_HEIGHT = 336;
const APPEARANCE_EDGE = 16;

const AppearancePanel = styled.div`
  --genie-y: calc(var(--space-2) * -1);
  --panel-line: 0.0375rem;

  position: fixed;
  z-index: var(--z-popover);
  display: flex;
  flex-direction: column;
  width: min(${APPEARANCE_WIDTH}px, calc(100vw - ${APPEARANCE_EDGE * 2}px));
  max-height: calc(100dvh - ${APPEARANCE_EDGE * 2}px);
  overflow: hidden;
  background-color: var(--glass-layer-bg);
  border: var(--panel-line) solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  -webkit-backdrop-filter: var(--glass-layer-blur);
  backdrop-filter: var(--glass-layer-blur);
  transform-origin: top left;

  ${layerMotion};

  &[data-placement="above"] {
    --genie-y: var(--space-2);
    transform-origin: bottom left;
    translate: 0 -100%;
  }
`;

export function AppearanceDialog({ open = true, onClose, ...rest }: AppearanceDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} label={rest.title} size="md" surface="solid" className={styles.appearancePanel}>
      <AppearanceForm onClose={onClose} {...rest} />
    </Dialog>
  );
}

export function AppearancePopover({ triggerLabel, renderHeaderAction, anchor, onClose, ...rest }: AppearancePopoverProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(Boolean(anchor));
  const { present, state, onAnimationEnd } = usePresence(open && !mobile);
  const layer = useLayer(open && !mobile);
  const target = (anchor ?? triggerRef) as RefObject<HTMLElement | null>;
  const position = useAnchoredPosition(open && !mobile, target, {
    width: APPEARANCE_WIDTH,
    height: APPEARANCE_HEIGHT,
    edge: APPEARANCE_EDGE,
  });

  const close = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  /* O foco volta para o gatilho quando a caixa fecha, num efeito, e não dentro do `close`: o `close` é
     entregue a quem desenha o leque do cabeçalho, e uma função que lê `ref` não pode ser passada durante a
     renderização. */
  const wasOpen = useRef(false);

  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  useOutsideDismiss(open && !mobile, [panelRef, target], close, () => isTopLayer(layer));

  useEffect(() => {
    if (!open || mobile) return;

    const frame = window.requestAnimationFrame(() =>
      panelRef.current?.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus({ preventScroll: true }),
    );

    return () => window.cancelAnimationFrame(frame);
  }, [mobile, open]);

  useEffect(() => {
    if (!open || mobile) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !isTopLayer(layer)) return;
      event.preventDefault();
      close();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, layer, mobile, open]);

  const form = <AppearanceForm {...rest} compact headerAction={renderHeaderAction?.(close)} onClose={close} />;

  return (
    <>
      {!anchor && (
        <IconButton
          ref={triggerRef}
          label={triggerLabel ?? rest.title}
          variant="ghost"
          size="sm"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <CaretUpDownIcon weight="bold" />
        </IconButton>
      )}

      {mobile ? (
        <Dialog open={open} onClose={close} label={rest.title} size="sm" surface="glass" scrim={false} focusOnOpen={false}>
          {form}
        </Dialog>
      ) : (
        present &&
        createPortal(
          <AppearancePanel
            ref={panelRef}
            role="dialog"
            aria-label={rest.title}
            data-placement={position?.placement ?? "below"}
            data-state={state}
            style={position ? { top: position.top, left: position.left } : { visibility: "hidden" }}
            onAnimationEnd={onAnimationEnd}
          >
            {form}
          </AppearancePanel>,
          document.body,
        )
      )}
    </>
  );
}

function AppearanceForm({
  title,
  glyphOptions,
  colorOptions,
  labels,
  initial,
  withName = true,
  compact = false,
  headerAction,
  onClose,
  onSave,
}: Omit<AppearanceDialogProps, "open"> & { compact?: boolean; headerAction?: ReactNode }) {
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

  /* No celular salvar e fechar moram na barra flutuante, como em toda janela da casa: o X do topo e o rodapé
     saem da ficha para sobrar espaço. */
  const mobile = useMediaQuery(MOBILE_QUERY);

  useFloatingActionsRegistration(
    mobile
      ? {
          primary: { label: "Salvar", loading: saving, disabled: !ready, onClick: () => void save() },
          cancel: { label: "Fechar", onClick: onClose },
        }
      : null,
  );

  return (
    <form
      className={cx(styles.dialog, compact && styles.appearanceCompact)}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <header className={styles.head}>
        <Text as="h2" variant={compact ? "subheadline" : "headline"} weight={compact ? "semibold" : undefined}>
          {title}
        </Text>
        <span className={styles.headActions}>
          {headerAction}
          {!mobile && (
            <IconButton label="Fechar" variant="ghost" size="sm" disabled={saving} onClick={onClose}>
              <XIcon />
            </IconButton>
          )}
        </span>
      </header>

      <div className={styles.body}>
        {withName && (
          <Field label="Nome" required>
            <Input size={compact ? "sm" : "md"} value={value.name} maxLength={60} disabled={saving} onChange={(event) => setValue({ ...value, name: event.target.value })} />
          </Field>
        )}
        <div className={glyphOptions ? styles.pair : undefined}>
          {glyphOptions && (
            <Field label={labels?.glyph ?? "Ícone"}>
              <Select
                surface="glass"
                indicator="toggle"
                size={compact ? "sm" : "md"}
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
              surface="glass"
              indicator="toggle"
              size={compact ? "sm" : "md"}
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
        <Button size={compact ? "sm" : "md"} type="submit" loading={saving} disabled={!ready}>
          Salvar
        </Button>
      </footer>
    </form>
  );
}
