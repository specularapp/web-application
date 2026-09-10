"use client";

import { CheckIcon, DownloadSimpleIcon, InfoIcon, WhatsappLogoIcon, XIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardFact, HoverCardFacts, HoverCardNaming } from "@/components/ui/hover-card";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/providers/toast-provider";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { squircle } from "@/lib/corners";
import { formatMoney } from "@/lib/utils/format";
import { respondToQuoteAction } from "../actions";
import { paymentMethods } from "../labels";
import { quoteDocumentName } from "../share";
import type { Quote, QuoteStatus } from "../summary";
import { quoteTotals } from "../totals";
import { QuoteDocument } from "./quote-document";
import { QuotePaper } from "./quote-paper";
import styles from "./quote-public-view.module.css";

export type QuotePublicViewProps = { quote: Quote };

const OPEN_STATUSES: QuoteStatus[] = ["sent", "viewed", "draft"];

/* O WhatsApp abre em outra aba, como os contatos do perfil. */
const external = { target: "_blank", rel: "noopener noreferrer" };

// A página que o cliente abre pelo link do WhatsApp (refeita em 2026-09-09, a pedido): só a folha, centrada
// e na escala de uma A4, e nada mais escrito em volta, porque o que importa é o documento. As ações moram num
// container flutuante de vidro no rodapé, na receita do visualizador de anexos: baixar o PDF, os detalhes do
// orçamento, aprovar, recusar e falar com a equipe.
export function QuotePublicView({ quote }: QuotePublicViewProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<QuoteStatus>(quote.status);
  const [pending, setPending] = useState<"approve" | "decline" | null>(null);
  const [downloading, setDownloading] = useState(false);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const open = OPEN_STATUSES.includes(status);
  const totals = quoteTotals(quote);

  const respond = async (decision: "approve" | "decline") => {
    setPending(decision);
    const result = await respondToQuoteAction({ token: quote.shareToken, decision });
    setPending(null);
    if (!result.ok) {
      toast({ title: "Não deu para registrar", description: result.error, tone: "danger" });
      return;
    }
    setStatus(result.status);
    toast({
      title: result.status === "approved" ? "Orçamento aprovado" : "Orçamento recusado",
      description:
        result.status === "approved" ? `${quote.issuer.name} já foi avisada e entra em contato para começar.` : `${quote.issuer.name} foi avisada da sua resposta.`,
      tone: result.status === "approved" ? "success" : "neutral",
    });
  };

  /* Um clique e o arquivo desce, sem a janela de impressão do navegador no meio (pedido de 2026-09-09): a
     rota ao lado da página devolve o PDF pronto, gerado da mesma folha. Buscar o arquivo e só então clicar
     num link, em vez de mandar o navegador para o endereço, é o que dá o giro no botão enquanto o documento
     é montado; o endereço temporário é liberado no próximo ciclo, quando o download já começou. */
  const download = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`/orcamento/${quote.shareToken}/pdf`);
      if (!response.ok) throw new Error(String(response.status));
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${quoteDocumentName(quote)}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      toast({ title: "Não deu para baixar", description: "Tente de novo em um instante.", tone: "danger" });
    } finally {
      setDownloading(false);
    }
  };

  const whatsapp = quote.issuer.phone ? `https://wa.me/55${quote.issuer.phone}?text=${encodeURIComponent(`Olá! Sobre o orçamento ${quote.number} (${quote.title}):`)}` : null;
  const methods = quote.paymentMethods.map((method) => paymentMethods[method].label).join(", ");

  return (
    <main className={styles.page}>
      {/* No celular a folha desce pela rolagem em vez de encolher até caber na altura (pedido de 2026-09-10),
          que é o que faz o cliente ler o documento na escala em que ele é impresso. */}
      <QuotePaper className={styles.paper} fit={mobile ? "width" : "contain"}>
        <QuoteDocument quote={{ ...quote, status }} />
      </QuotePaper>

      {/* O container flutuante das ações, no vidro e no raio das camadas da casa. Ele não entra na
          impressão: o que sai no papel é só a folha. */}
      <div className={styles.toolbar} role="toolbar" aria-label="Ações do orçamento" {...squircle("lg")}>
        <IconButton label="Baixar o orçamento em PDF" variant="ghost" size="sm" loading={downloading} disabled={downloading} onClick={download}>
          <DownloadSimpleIcon />
        </IconButton>

        <HoverCard
          width={264}
          height={200}
          openOnClick
          inline
          scheme="light"
          content={
            <>
              <HoverCardNaming>
                <Text as="span" variant="subheadline" weight="semibold" truncate>
                  {quote.number}
                </Text>
                <Text as="span" variant="caption1" tone="secondary" truncate>
                  {quote.issuer.name}
                </Text>
              </HoverCardNaming>
              <HoverCardFacts>
                <HoverCardFact icon={InfoIcon}>
                  {quote.lines.length === 1 ? "1 item" : `${quote.lines.length} itens`}, {formatMoney(totals.total)}
                </HoverCardFact>
                <HoverCardFact icon={InfoIcon}>
                  {quote.installments > 1 ? `${quote.installments}x de ${formatMoney(totals.installment)}` : "À vista"}
                  {quote.cashDiscount > 0 ? `, ${quote.cashDiscount}% à vista` : ""}
                </HoverCardFact>
                <HoverCardFact icon={InfoIcon}>{methods}</HoverCardFact>
              </HoverCardFacts>
            </>
          }
        >
          <IconButton label="Detalhes do orçamento" variant="ghost" size="sm">
            <InfoIcon />
          </IconButton>
        </HoverCard>

        <span className={styles.divider} aria-hidden="true" />

        {open ? (
          <>
            <Button size="sm" radius="md" iconStart={<CheckIcon weight="bold" />} loading={pending === "approve"} disabled={pending !== null} onClick={() => respond("approve")}>
              Aprovar
            </Button>
            <Button variant="ghost" size="sm" radius="md" iconStart={<XIcon weight="bold" />} loading={pending === "decline"} disabled={pending !== null} onClick={() => respond("decline")}>
              Recusar
            </Button>
          </>
        ) : (
          <Text as="span" variant="footnote" tone="secondary" className={styles.answered}>
            {status === "approved" ? "Você aprovou" : status === "declined" ? "Você recusou" : "Orçamento vencido"}
          </Text>
        )}

        {whatsapp && (
          <IconButton label="Falar com a equipe no WhatsApp" variant="ghost" size="sm" href={whatsapp} {...external}>
            <WhatsappLogoIcon />
          </IconButton>
        )}
      </div>
    </main>
  );
}
