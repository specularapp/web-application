"use client";

import {
  CheckSquareIcon,
  ClockCounterClockwiseIcon,
  EyeIcon,
  PencilSimpleIcon,
  ReceiptIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import type { Route } from "next";
import dynamic from "next/dynamic";
import { useState } from "react";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import type { CatalogItem } from "../summary";

/* A janela chega só quando alguém a abre: o leque aparece em cada cartão da grade. */
const HistoryDialog = dynamic(() => import("@/features/records/components/history-dialog").then((module) => module.HistoryDialog));

export type CatalogMenuProps = {
  /** Só o que o menu usa: o cartão carrega o item inteiro, mas o menu não precisa dele. */
  item: Pick<CatalogItem, "id" | "name">;
  /** O interruptor de ativo mora fora, no cartão, para o cartão apagar junto quando o item sai de linha. */
  active: boolean;
  onActiveChange: (active: boolean) => void;
  /** Abre a ficha do item; na própria ficha não vai, porque ela já está aberta. */
  onView?: () => void;
  /** Abre a gaveta de edição no lugar, com a ficha já preenchida. */
  onEdit?: () => void;
  /** Pede a exclusão; quem confirma é a janela da prancha, com a pergunta e o aviso. */
  onDelete?: () => void;
};

/** Gerar orçamento a partir do item pede o plano Pro, como os documentos do cliente. */
const QUOTE_PLAN = "pro";

// As opções de um item do catálogo, no mesmo padrão do menu do cliente: ver e editar, gerar orçamento
// com o item já dentro (com o selo do plano que libera), o histórico em janela, o interruptor de ativo e,
// por último e em vermelho, excluir. Visualizar abre a ficha, Editar abre a gaveta do formulário no lugar
// (2026-09-08) e Excluir pede a confirmação da casa (2026-09-16).
export function CatalogMenu({ item, active, onActiveChange, onView, onEdit, onDelete }: CatalogMenuProps) {
  const [history, setHistory] = useState<"never" | "open" | "closed">("never");

  const sections: DropdownSection[] = [
    {
      id: "actions",
      items: [
        { id: "view", label: "Visualizar", icon: EyeIcon, onSelect: onView },
        { id: "edit", label: "Editar", icon: PencilSimpleIcon, onSelect: onEdit },
        {
          id: "quote",
          label: "Gerar orçamento",
          icon: ReceiptIcon,
          href: `/orcamentos/novo?item=${item.id}` as Route,
          submenu: true,
          plan: QUOTE_PLAN,
        },
      ],
    },
    {
      id: "tracking",
      label: "Acompanhamento",
      items: [{ id: "history", label: "Histórico de edições", icon: ClockCounterClockwiseIcon, onSelect: () => setHistory("open") }],
    },
    {
      id: "flags",
      items: [{ kind: "toggle", id: "active", label: "Ativo", icon: CheckSquareIcon, checked: active, onChange: onActiveChange }],
    },
    {
      id: "danger",
      items: [{ id: "delete", label: "Excluir", icon: TrashIcon, tone: "danger", onSelect: onDelete }],
    },
  ];

  return (
    <>
      <DropdownMenu label={`Opções de ${item.name}`} triggerLabel={`Mais opções de ${item.name}`} sections={sections} />

      {history !== "never" && (
        <HistoryDialog
          open={history === "open"}
          onClose={() => setHistory("closed")}
          recordType="catalog"
          recordId={item.id}
          name={item.name}
        />
      )}
    </>
  );
}
