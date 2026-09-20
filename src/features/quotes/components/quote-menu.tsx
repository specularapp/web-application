"use client";

import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  ClockCounterClockwiseIcon,
  CopySimpleIcon,
  LinkIcon,
  PaperPlaneTiltIcon,
  PencilSimpleIcon,
  TrashIcon,
  WhatsappLogoIcon,
} from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/providers/toast-provider";
import { callAction } from "@/lib/action";
import { deleteQuotesAction, duplicateQuoteAction, markQuoteStatusAction } from "../actions";
import { quoteShareUrl, quoteWhatsappUrl } from "../share";
import type { Quote } from "../summary";

export type QuoteMenuProps = {
  quote: Quote;
  /** Abre o editor no lugar, com o orçamento já preenchido. */
  onEdit?: () => void;
  /** O orçamento saiu da base: quem chama tira a linha da tela antes de a lista se refazer. */
  onDeleted?: () => void;
};

/* A janela do histórico chega só quando alguém a abre: o leque aparece em cada cartão da grade e em cada
   linha da tabela, e trazê-la na carga da lista seria pagar por ela vinte e quatro vezes por página. */
const HistoryDialog = dynamic(() => import("@/features/records/components/history-dialog").then((module) => module.HistoryDialog));

// As opções de um orçamento, todas funcionando: abrir o documento como o cliente vê, editar, enviar pelo
// WhatsApp com a mensagem pronta, copiar o link público; o histórico em janela; marcar como enviado ou
// aprovado à mão, para quem fechou por fora; duplicar, que abre a cópia no editor; e, por último e em
// vermelho, excluir, que pede confirmação.
export function QuoteMenu({ quote, onEdit, onDeleted }: QuoteMenuProps) {
  const router = useRouter();
  const { toast } = useToast();
  const url = quoteShareUrl(quote.shareToken);
  const [history, setHistory] = useState<"never" | "open" | "closed">("never");
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado", description: "Cole no WhatsApp ou no e-mail do cliente.", tone: "success" });
    } catch {
      toast({ title: "Não deu para copiar", description: url, tone: "warning" });
    }
  };

  const mark = async (status: "sent" | "approved", title: string, description: string) => {
    if (working) return;
    setWorking(true);
    const result = await callAction(markQuoteStatusAction({ id: quote.id, status }));
    setWorking(false);
    if (!result.ok) {
      toast({ title: "Não deu para marcar", description: result.error, tone: "danger" });
      return;
    }
    toast({ title, description, tone: "success" });
  };

  /* Duplicar abre a cópia no editor: quem duplica quer mudar alguma coisa, senão teria mandado a original
     de novo. Parar na lista obrigaria a procurar qual das duas é a nova. */
  const duplicate = async () => {
    if (working) return;
    setWorking(true);
    const result = await callAction(duplicateQuoteAction(quote.id));
    setWorking(false);
    if (!result.ok) {
      toast({ title: "Não deu para duplicar", description: result.error, tone: "danger" });
      return;
    }
    toast({ title: "Cópia criada", description: "Ela nasceu como rascunho, com link próprio.", tone: "success" });
    router.push(`/orcamentos/${result.id}`);
  };

  const remove = async () => {
    if (working) return;
    setWorking(true);
    const result = await callAction(deleteQuotesAction([quote.id]));
    setWorking(false);
    setConfirming(false);

    if (!result.ok) {
      toast({ title: "Não deu para excluir", description: result.error, tone: "danger" });
      return;
    }

    toast({ title: "Orçamento excluído", description: `${quote.number} saiu da base.`, tone: "success" });
    onDeleted?.();
  };

  const sections: DropdownSection[] = [
    {
      id: "actions",
      items: [
        { id: "open", label: "Abrir documento", icon: ArrowSquareOutIcon, href: url as `http${string}` },
        { id: "edit", label: "Editar", icon: PencilSimpleIcon, onSelect: onEdit },
      ],
    },
    {
      id: "share",
      label: "Compartilhar",
      items: [
        { id: "whatsapp", label: "Enviar pelo WhatsApp", icon: WhatsappLogoIcon, href: quoteWhatsappUrl(quote) as `http${string}` },
        { id: "copy", label: "Copiar link", icon: LinkIcon, onSelect: () => void copyLink() },
      ],
    },
    {
      id: "tracking",
      label: "Acompanhamento",
      items: [
        ...(quote.status === "draft"
          ? [
              {
                id: "mark-sent",
                label: "Marcar como enviado",
                icon: PaperPlaneTiltIcon,
                onSelect: () => void mark("sent", "Marcado como enviado", "O orçamento passa a contar como enviado ao cliente."),
              },
            ]
          : []),
        ...(quote.status === "sent" || quote.status === "viewed"
          ? [
              {
                id: "mark-approved",
                label: "Marcar como aprovado",
                icon: CheckCircleIcon,
                onSelect: () => void mark("approved", "Marcado como aprovado", "Já dá para gerar a cobrança a partir dele."),
              },
            ]
          : []),
        { id: "history", label: "Histórico", icon: ClockCounterClockwiseIcon, onSelect: () => setHistory("open") },
      ],
    },
    {
      id: "more",
      label: "Mais ações",
      items: [{ id: "duplicate", label: "Duplicar", icon: CopySimpleIcon, onSelect: () => void duplicate() }],
    },
    {
      id: "danger",
      items: [{ id: "delete", label: "Excluir", icon: TrashIcon, tone: "danger", onSelect: () => setConfirming(true) }],
    },
  ];

  return (
    <>
      <DropdownMenu label={`Opções de ${quote.number}`} triggerLabel={`Mais opções de ${quote.number}`} sections={sections} />

      {history !== "never" && (
        <HistoryDialog
          open={history === "open"}
          onClose={() => setHistory("closed")}
          recordType="quote"
          recordId={quote.id}
          name={quote.number}
        />
      )}
      <ConfirmDialog
        open={confirming}
        pending={working}
        title="Excluir este orçamento?"
        description={`${quote.number}, de ${quote.client.name}, sai da base e o link público para de abrir. Isso não pode ser desfeito.`}
        onClose={() => setConfirming(false)}
        onConfirm={remove}
      />
    </>
  );
}
