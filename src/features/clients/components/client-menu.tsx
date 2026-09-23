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
import dynamic from "next/dynamic";
import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { deleteClientsAction, setClientFlagAction } from "../actions";
import type { Client } from "../summary";
import { callAction } from "@/lib/action";

export type ClientMenuProps = {
  /** Só o que o leque usa: a ficha inteira serve, mas o cartão da listagem não precisa carregá-la. */
  client: Pick<Client, "id" | "kind" | "name" | "phone" | "active" | "favorite"> & { avatarUrl?: string | null; email?: string | null };
  /** Abre a ficha no lugar, sem navegar: a listagem abre a gaveta, o painel deixa o endereço fazer. */
  onView?: () => void;
  /** Abre a edição no lugar, sem navegar, pelo mesmo motivo. */
  onEdit?: () => void;
  /** O cliente saiu da base: quem chama tira a linha da tela antes de a lista se refazer. */
  onDeleted?: () => void;
};

/** Gerar documento a partir do cadastro é do plano Pro (`client_documents` em `plan_entitlements`). */
const DOCUMENTS_PLAN = "pro" as const;

/** O mapa de relação também (`relation_map`), e a ação confere de novo no servidor. */
const MAP_PLAN = "pro" as const;

/* As duas janelas chegam só quando alguém as abre. O mapa carrega o React Flow inteiro, e o leque aparece em
   seis telas, o painel entre elas: trazer o motor de fluxo na carga do painel seria pagar o desenho do mapa
   em toda visita para o caso de alguém talvez abri-lo. */
const HistoryDialog = dynamic(() => import("@/features/records/components/history-dialog").then((module) => module.HistoryDialog));
const RelationMapDialog = dynamic(() => import("@/features/records/components/relation-map-dialog").then((module) => module.RelationMapDialog));

// As opções de um cliente, todas funcionando: ver e editar, gerar orçamento, cobrança e contrato já
// preenchidos com ele (com o plano que libera, que abre o modal central quando falta), chamar no WhatsApp,
// o histórico e o mapa de relação em janela, os interruptores de ativo e favorito, que gravam de verdade, e
// por último, em vermelho, excluir, que pede confirmação.
//
// As três janelas moram **aqui**, e não em cada tela que desenha o leque: são seis lugares que o mostram, e
// seis cópias das mesmas janelas com seis estados seria a mesma coisa escrita seis vezes. Quem chama passa,
// no máximo, o que só ele sabe fazer (abrir a gaveta, abrir a edição, tirar a linha da lista).
export function ClientMenu({ client, onView, onEdit, onDeleted }: ClientMenuProps) {
  const { toast } = useToast();
  const [active, setActive] = useState(client.active);
  const [favorite, setFavorite] = useState(client.favorite);
  /* Aberta uma vez, a janela fica montada: é o que deixa a saída animar em vez de sumir de um corte, e o
     pedaço dela já está na mão a partir daí. */
  const [history, setHistory] = useState<"never" | "open" | "closed">("never");
  const [map, setMap] = useState<"never" | "open" | "closed">("never");
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const supplierOnly = client.kind === "supplier";
  const noun = supplierOnly ? "fornecedor" : "cliente";

  /* O interruptor vira na hora e a gravação vem atrás: é um sim ou não, e esperar o servidor para a chave
     mexer faria o leque parecer travado. Se o servidor recusa, a chave volta e o aviso diz por quê. */
  const toggle = (flag: "active" | "favorite", value: boolean) => {
    const set = flag === "active" ? setActive : setFavorite;
    set(value);

    void callAction(setClientFlagAction({ id: client.id, flag, value })).then((result) => {
      if (!result.ok) {
        set(!value);
        toast({ title: "Não deu para salvar", description: result.error, tone: "danger" });
        return;
      }
    });
  };

  const remove = async () => {
    setDeleting(true);
    const result = await callAction(deleteClientsAction([client.id]));
    setDeleting(false);
    setConfirming(false);

    if (!result.ok) {
      toast({ title: "Não deu para excluir", description: result.error, tone: "danger" });
      return;
    }

    toast({
      title: `${supplierOnly ? "Fornecedor" : "Cliente"} excluído`,
      description: `${client.name} saiu da base.`,
      tone: "success",
      feedback: {
        visual: <Avatar name={client.name} src={client.avatarUrl ?? undefined} size="lg" shape="rounded" />,
        confetti: false,
      },
    });
    onDeleted?.();
  };

  const sections: DropdownSection[] = [
    {
      id: "actions",
      items: [
        onView
          ? { id: "view", label: "Visualizar", icon: EyeIcon, onSelect: onView }
          : { id: "view", label: "Visualizar", icon: EyeIcon, href: `/clientes/${client.id}` as Route },
        onEdit
          ? { id: "edit", label: "Editar", icon: PencilSimpleIcon, onSelect: onEdit }
          : { id: "edit", label: "Editar", icon: PencilSimpleIcon, href: `/clientes/${client.id}` as Route },
      ],
    },
    ...(!supplierOnly ? [{
      id: "documents",
      label: "Criar documento",
      items: [
        {
          id: "quote",
          label: "Gerar orçamento",
          icon: ReceiptIcon,
          href: `/orcamentos/novo?cliente=${client.id}` as Route,
          submenu: true,
          plan: DOCUMENTS_PLAN,
        },
        {
          id: "invoice",
          label: "Gerar cobrança",
          icon: HandCoinsIcon,
          href: `/cobrancas/nova?cliente=${client.id}` as Route,
          submenu: true,
          plan: DOCUMENTS_PLAN,
        },
        {
          id: "contract",
          label: "Gerar contrato",
          icon: FileTextIcon,
          href: `/contratos/novo?cliente=${client.id}` as Route,
          submenu: true,
          plan: DOCUMENTS_PLAN,
        },
        ...(client.kind === "both"
          ? [{ id: "expense", label: "Gerar despesa", icon: HandCoinsIcon, href: `/despesas/nova?fornecedor=${client.id}` as Route, submenu: true }]
          : []),
      ],
    }] : [{
      id: "documents",
      label: "Financeiro",
      items: [{ id: "expense", label: "Gerar despesa", icon: HandCoinsIcon, href: `/despesas/nova?fornecedor=${client.id}` as Route, submenu: true }],
    }]),
    ...(client.phone
      ? [{ id: "contact", label: "Contato", items: [{ id: "whatsapp", label: "Chamar no WhatsApp", icon: WhatsappLogoIcon, href: `https://wa.me/55${client.phone}` as const, submenu: true }] }]
      : []),
    {
      id: "tracking",
      label: "Acompanhamento",
      items: [
        { id: "history", label: "Histórico", icon: ClockCounterClockwiseIcon, onSelect: () => setHistory("open") },
        { id: "map", label: "Mapa de relação", icon: TreeStructureIcon, plan: MAP_PLAN, onSelect: () => setMap("open") },
      ],
    },
    {
      id: "flags",
      label: "Situação",
      items: [
        { kind: "toggle", id: "active", label: "Ativo", icon: CheckSquareIcon, checked: active, onChange: (value) => toggle("active", value) },
        { kind: "toggle", id: "favorite", label: "Favoritar", icon: StarIcon, checked: favorite, onChange: (value) => toggle("favorite", value) },
      ],
    },
    {
      id: "danger",
      items: [{ id: "delete", label: "Excluir", icon: TrashIcon, tone: "danger", onSelect: () => setConfirming(true) }],
    },
  ];

  return (
    <>
      <DropdownMenu label={`Opções de ${client.name}`} triggerLabel={`Mais opções de ${client.name}`} sections={sections} />

      {history !== "never" && (
        <HistoryDialog open={history === "open"} onClose={() => setHistory("closed")} recordType="client" recordId={client.id} name={client.name} />
      )}
      {map !== "never" && <RelationMapDialog open={map === "open"} onClose={() => setMap("closed")} clientId={client.id} name={client.name} />}
      <ConfirmDialog
        open={confirming}
        pending={deleting}
        title={`Excluir este ${noun}?`}
        description={`${client.name} sai da base com os registros financeiros ligados. Isso não pode ser desfeito.`}
        faces={[{ id: client.id, name: client.name, avatarUrl: client.avatarUrl ?? null, seed: client.email ?? undefined }]}
        onClose={() => setConfirming(false)}
        onConfirm={remove}
      />
    </>
  );
}
