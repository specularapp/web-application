"use client";

import {
  CheckSquareIcon,
  ClockCounterClockwiseIcon,
  EyeIcon,
  FileTextIcon,
  HandCoinsIcon,
  PencilSimpleIcon,
  ReceiptIcon,
  StarIcon,
  TrashIcon,
  TreeStructureIcon,
  WhatsappLogoIcon,
} from "@phosphor-icons/react";
import type { Route } from "next";
import { useState } from "react";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import type { Client } from "@/features/clients/summary";

export type ClientMenuProps = {
  /** Só o que o menu usa: a ficha inteira serve, mas o cartão da listagem não precisa carregá-la. */
  client: Pick<Client, "id" | "name" | "phone">;
  /** Quantas entradas o histórico do cliente tem, para a contagem na linha. */
  historyCount?: number;
};

/** Os documentos gerados a partir do cliente pedem o plano Pro. */
const DOCUMENTS_PLAN = "pro";

// As opções de um cliente, no padrão pedido: ver e editar, gerar documentos (com o selo do plano que
// libera), chamar no WhatsApp, o acompanhamento, os interruptores de ativo e favorito e, por último e
// em vermelho, excluir. Editar leva à tela da ficha; histórico, mapa e excluir ainda não têm tela nem
// regra: fecham o menu e nada mais. Ativo e favorito trocam só na tela.
export function ClientMenu({ client, historyCount = 0 }: ClientMenuProps) {
  const [active, setActive] = useState(true);
  const [favorite, setFavorite] = useState(false);

  const sections: DropdownSection[] = [
    {
      id: "actions",
      items: [
        { id: "view", label: "Visualizar", icon: EyeIcon, href: "/clientes" },
        { id: "edit", label: "Editar", icon: PencilSimpleIcon, href: `/clientes/${client.id}/editar` as Route },
        {
          id: "quote",
          label: "Gerar orçamento",
          icon: ReceiptIcon,
          href: `/orcamentos/novo?cliente=${client.id}` as Route,
          submenu: true,
          plan: DOCUMENTS_PLAN,
        },
        { id: "invoice", label: "Gerar cobrança", icon: HandCoinsIcon, href: "/cobrancas", submenu: true, plan: DOCUMENTS_PLAN },
        { id: "contract", label: "Gerar contrato", icon: FileTextIcon, href: "/contratos", submenu: true, plan: DOCUMENTS_PLAN },
        ...(client.phone
          ? [{ id: "whatsapp", label: "Chamar no WhatsApp", icon: WhatsappLogoIcon, href: `https://wa.me/55${client.phone}` as const, submenu: true }]
          : []),
      ],
    },
    {
      id: "tracking",
      label: "Acompanhamento",
      items: [
        { id: "history", label: "Histórico", icon: ClockCounterClockwiseIcon, count: historyCount },
        { id: "map", label: "Mapa de relação", icon: TreeStructureIcon },
      ],
    },
    {
      id: "flags",
      items: [
        { kind: "toggle", id: "active", label: "Ativo", icon: CheckSquareIcon, checked: active, onChange: setActive },
        { kind: "toggle", id: "favorite", label: "Favoritar", icon: StarIcon, checked: favorite, onChange: setFavorite },
      ],
    },
    {
      id: "danger",
      items: [{ id: "delete", label: "Excluir", icon: TrashIcon, tone: "danger" }],
    },
  ];

  return <DropdownMenu label={`Opções de ${client.name}`} triggerLabel={`Mais opções de ${client.name}`} sections={sections} />;
}
