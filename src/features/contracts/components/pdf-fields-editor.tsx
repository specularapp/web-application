"use client";

import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { cx } from "@/lib/utils/cx";
import { partyRoles } from "../document";
import type { Contract, ContractParty, SignatureField } from "../summary";
import { PdfPages } from "./pdf-pages";
import { SignatureFieldMark } from "./signature-field-mark";
import styles from "./pdf-fields-editor.module.css";

/* O tamanho de um campo novo, em frações da página: uma linha de assinatura confortável numa A4. */
const NEW_FIELD = { width: 0.36, height: 0.075 };
const MIN_FIELD = { width: 0.12, height: 0.035 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Um campo novo para a parte, na última página, ao lado dos que já estão lá. */
export function newSignatureField(partyId: string, page: number, fields: SignatureField[]): SignatureField {
  const others = fields.filter((field) => field.page === page).length;
  return { id: `f-${crypto.randomUUID().slice(0, 8)}`, partyId, page, x: clamp(0.1 + others * 0.42, 0, 1 - NEW_FIELD.width), y: 0.78, ...NEW_FIELD };
}

export type PdfFieldsEditorProps = {
  contract: Contract;
  parties: ContractParty[];
  fields: SignatureField[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (fields: SignatureField[]) => void;
};

// O editor de campos de um PDF anexado (2026-09-14, a pedido): as páginas desenhadas pelo pdf.js e, por
// cima, um campo por parte, que a pessoa arrasta para onde cada uma assina e redimensiona pela quina. A
// posição vive em frações da página, então vale em qualquer tamanho de tela e no carimbo do PDF final. Quem
// soma, tira e muda de página é o painel ao lado; aqui é só arrastar.
export function PdfFieldsEditor({ contract, parties, fields, selectedId, onSelect, onChange }: PdfFieldsEditorProps) {
  const update = (id: string, patch: Partial<SignatureField>) => onChange(fields.map((field) => (field.id === id ? { ...field, ...patch } : field)));

  /* Arrastar move; a quina redimensiona. A conta é em frações do retângulo da camada, que é a página. */
  const startDrag = (field: SignatureField, mode: "move" | "resize") => (event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const layer = event.currentTarget.closest<HTMLElement>("[data-layer]");
    if (!layer) return;
    const rect = layer.getBoundingClientRect();
    const origin = { x: event.clientX, y: event.clientY, field };
    onSelect(field.id);
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);

    const onMove = (move: PointerEvent) => {
      const dx = (move.clientX - origin.x) / rect.width;
      const dy = (move.clientY - origin.y) / rect.height;
      if (mode === "move") {
        update(field.id, { x: clamp(origin.field.x + dx, 0, 1 - origin.field.width), y: clamp(origin.field.y + dy, 0, 1 - origin.field.height) });
      } else {
        update(field.id, {
          width: clamp(origin.field.width + dx, MIN_FIELD.width, 1 - origin.field.x),
          height: clamp(origin.field.height + dy, MIN_FIELD.height, 1 - origin.field.y),
        });
      }
    };
    const onUp = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  };

  return (
    <PdfPages
      src={`/api/contratos/${contract.id}/arquivo`}
      className={styles.pages}
      overlay={(page) => (
        <div className={styles.layer} data-layer onPointerDown={() => onSelect(null)}>
          {fields
            .filter((field) => field.page === page)
            .map((field) => {
              const party = parties.find((entry) => entry.id === field.partyId);
              if (!party) return null;
              return (
                <div
                  key={field.id}
                  className={cx(styles.draggable, field.id === selectedId && styles.selected)}
                  style={{ left: `${field.x * 100}%`, top: `${field.y * 100}%`, width: `${field.width * 100}%`, height: `${field.height * 100}%` }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Campo de assinatura de ${party.name}, arraste para posicionar`}
                  onPointerDown={startDrag(field, "move")}
                  onFocus={() => onSelect(field.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Delete" || event.key === "Backspace") onChange(fields.filter((entry) => entry.id !== field.id));
                  }}
                >
                  <SignatureFieldMark field={{ ...field, x: 0, y: 0, width: 1, height: 1 }} party={party} highlighted={field.id === selectedId} className={styles.mark} />
                  <span className={styles.handle} aria-hidden="true" onPointerDown={startDrag(field, "resize")} />
                </div>
              );
            })}
        </div>
      )}
    />
  );
}

export type PdfFieldsToolsPanelProps = {
  contract: Contract;
  parties: ContractParty[];
  fields: SignatureField[];
  selectedId: string | null;
  onChange: (fields: SignatureField[]) => void;
  onSelect: (id: string | null) => void;
};

/* O painel das ferramentas do PDF: uma linha por parte com quantos campos ela tem e o botão de somar, e a
   ferramenta do campo escolhido, para mudar de página ou tirar. */
export function PdfFieldsToolsPanel({ contract, parties, fields, selectedId, onChange, onSelect }: PdfFieldsToolsPanelProps) {
  const pages = contract.file?.pages ?? 1;
  const selected = fields.find((field) => field.id === selectedId) ?? null;
  const pageOptions = Array.from({ length: pages }, (_, index) => ({ value: index + 1, label: `Página ${index + 1}` }));

  const add = (partyId: string) => {
    const field = newSignatureField(partyId, pages, fields);
    onChange([...fields, field]);
    onSelect(field.id);
  };

  return (
    <div className={styles.panel}>
      <Text as="h3" variant="subheadline" weight="semibold">
        Onde cada parte assina
      </Text>
      <Text variant="footnote" tone="secondary">
        Adicione um campo por parte e arraste-o até o lugar da assinatura. A quina redimensiona.
      </Text>
      <ul className={styles.partyList}>
        {parties.map((party) => {
          const count = fields.filter((field) => field.partyId === party.id).length;
          return (
            <li key={party.id} className={styles.partyRow}>
              <Avatar name={party.name} src={party.avatarUrl ?? undefined} size="xs" />
              <span className={styles.partyCopy}>
                <Text as="span" variant="footnote" weight="medium" truncate>
                  {party.name}
                </Text>
                <Text as="span" variant="caption1" tone={count ? "secondary" : "tertiary"} truncate>
                  {partyRoles[party.role]}, {count === 0 ? "sem campo" : count === 1 ? "1 campo" : `${count} campos`}
                </Text>
              </span>
              <IconButton label={`Adicionar campo de ${party.name}`} variant="outline" size="sm" radius="md" onClick={() => add(party.id)}>
                <PlusIcon />
              </IconButton>
            </li>
          );
        })}
      </ul>
      {parties.length < 2 && (
        <Text variant="caption1" tone="tertiary">
          Escolha quem contrata, nos ajustes, para a segunda parte ganhar campo.
        </Text>
      )}

      {selected && (
        <div className={styles.selectedTools}>
          <Text as="h4" variant="footnote" weight="semibold">
            Campo escolhido
          </Text>
          <Select<number> label="Página do campo" size="sm" options={pageOptions} value={selected.page} onChange={(page) => onChange(fields.map((field) => (field.id === selected.id ? { ...field, page } : field)))} />
          <Button
            variant="outline"
            size="sm"
            radius="md"
            iconStart={<TrashIcon />}
            onClick={() => {
              onChange(fields.filter((field) => field.id !== selected.id));
              onSelect(null);
            }}
          >
            Tirar campo
          </Button>
        </div>
      )}
    </div>
  );
}
