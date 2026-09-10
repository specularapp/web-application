"use client";

import { ArrowLeftIcon, CheckIcon, DownloadSimpleIcon, InfoIcon, WhatsappLogoIcon, XIcon } from "@phosphor-icons/react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
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

/* O tamanho do histórico não muda enquanto a página vive, então a assinatura não tem o que escutar. */
const subscribeNothing = () => () => undefined;

// A página que o cliente abre pelo link do WhatsApp (refeita em 2026-09-09, a pedido): só a folha, centrada
// e na escala de uma A4, e nada mais escrito em volta, porque o que importa é o documento. As ações moram num
// container flutuante de vidro no rodapé, na receita do visualizador de anexos: baixar o PDF, os detalhes do
// orçamento, aprovar, recusar e falar com a equipe.
export function QuotePublicView({ quote }: QuotePublicViewProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<QuoteStatus>(quote.status);
  const [pending, setPending] = useState<"approve" | "decline" | null>(null);
  const [details, setDetails] = useState(false);
  const mobile = useMediaQuery(MOBILE_QUERY);
  /* O histórico é estado de fora do React, e é lido como tal: no servidor a resposta é "não há para onde
     voltar", que é o que também vale para o link aberto em aba nova, e no cliente vem o valor de verdade,
     sem a marcação divergir da que veio do servidor. Ele não muda enquanto a página vive, então ninguém
     precisa assinar nada. */
  const canGoBack = useSyncExternalStore(subscribeNothing, () => window.history.length > 1, () => false);
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
     rota ao lado da página devolve o PDF pronto, gerado da mesma folha.

     **É o botão que leva o navegador ao endereço, e não um blob montado aqui** (acerto de 2026-09-10, do
     relato de que no Safari não baixava): buscar o arquivo, criar um `blob:` e clicar num link tem três
     problemas no Safari, e no do iPhone os três de uma vez. O link nunca entrou no documento, e o Safari
     ignora o clique num elemento fora dele; o endereço temporário era liberado no ciclo seguinte, antes de o
     Safari terminar de ler o blob; e o iOS **não respeita `download` em `blob:`**, então, quando abria, abria
     no visualizador sem nome de arquivo nenhum.

     Agora baixar é o botão da casa como **âncora com `download`** apontando para a rota, e quem baixa é o
     navegador: o `Content-Disposition: attachment` que ela devolve é o que nomeia o arquivo, e o nome sai
     igual em todo navegador. O `download` no elemento faz o clique ser tratado como transferência, e não
     como navegação, então nem o `next/link` por baixo o intercepta nem a página sai do lugar. */
  const downloadUrl = `/orcamento/${quote.shareToken}/pdf`;

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
          impressão: o que sai no papel é só a folha. São cinco ações e nada além (pedido de 2026-09-10):
          baixar, os detalhes, aprovar, recusar e voltar. */}
      <div className={styles.toolbar} role="toolbar" aria-label="Ações do orçamento" {...squircle("lg")}>
        <IconButton label="Baixar o orçamento em PDF" variant="ghost" size="sm" href={downloadUrl} download={`${quoteDocumentName(quote)}.pdf`}>
          <DownloadSimpleIcon />
        </IconButton>

        <IconButton label="Detalhes do orçamento" variant="ghost" size="sm" onClick={() => setDetails(true)}>
          <InfoIcon />
        </IconButton>

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

        {/* Voltar é o histórico do navegador, para quem chegou pelo WhatsApp voltar à conversa. Ele só entra
            quando há para onde voltar: o link aberto em aba nova nasce sem histórico, e ali o botão não faria
            nada. Quem decide é o `history.length`, lido depois da montagem, porque no servidor não existe. */}
        {canGoBack && (
          <>
            <span className={styles.divider} aria-hidden="true" />
            <IconButton label="Voltar" variant="ghost" size="sm" onClick={() => window.history.back()}>
              <ArrowLeftIcon />
            </IconButton>
          </>
        )}
      </div>

      {/* Os detalhes na janela da casa, que no celular é a bandeja de baixo (pedido de 2026-09-10, no lugar
          do cartão flutuante que abria no toque): a ficha em duas colunas, no vidro e no escurecimento
          padrão. Ela é camada da interface, e não parte do documento, então segue o tema do aparelho, ao
          contrário da folha, que é papel branco sempre. */}
      <Dialog open={details} onClose={() => setDetails(false)} label={`Detalhes do orçamento ${quote.number}`} size="sm" surface="glass">
        <header className={styles.detailsHead}>
          <div className={styles.detailsHeading}>
            <Text as="h2" variant="headline" weight="semibold" truncate>
              {quote.number}
            </Text>
            <Text variant="footnote" tone="secondary" truncate>
              {quote.issuer.name}
            </Text>
          </div>
          <IconButton label="Fechar" variant="ghost" size="sm" onClick={() => setDetails(false)}>
            <XIcon />
          </IconButton>
        </header>

        <dl className={styles.detailsFacts}>
          <div className={styles.detailsFact}>
            <Text as="dt" variant="caption1" tone="secondary">
              Itens
            </Text>
            <Text as="dd" variant="subheadline" weight="medium">
              {quote.lines.length === 1 ? "1 item" : `${quote.lines.length} itens`}
            </Text>
          </div>
          <div className={styles.detailsFact}>
            <Text as="dt" variant="caption1" tone="secondary">
              Total
            </Text>
            <Text as="dd" variant="subheadline" weight="medium">
              {formatMoney(totals.total)}
            </Text>
          </div>
          <div className={styles.detailsFact}>
            <Text as="dt" variant="caption1" tone="secondary">
              Pagamento
            </Text>
            <Text as="dd" variant="subheadline" weight="medium">
              {quote.installments > 1 ? `${quote.installments}x de ${formatMoney(totals.installment)}` : "À vista"}
            </Text>
          </div>
          <div className={styles.detailsFact}>
            <Text as="dt" variant="caption1" tone="secondary">
              À vista
            </Text>
            <Text as="dd" variant="subheadline" weight="medium">
              {quote.cashDiscount > 0 ? `${quote.cashDiscount}% de desconto` : "Sem desconto"}
            </Text>
          </div>
          <div className={styles.detailsFactWide}>
            <Text as="dt" variant="caption1" tone="secondary">
              Formas de pagamento
            </Text>
            <Text as="dd" variant="subheadline" weight="medium">
              {methods}
            </Text>
          </div>
        </dl>

        {/* Falar com a equipe sai da fila de ações e vem para cá, porque é o assunto desta ficha: quem
            preparou o orçamento e como chegar nela. */}
        {whatsapp && (
          <div className={styles.detailsFoot}>
            <Button variant="outline" size="sm" radius="md" iconStart={<WhatsappLogoIcon />} href={whatsapp} {...external}>
              Falar com a equipe
            </Button>
          </div>
        )}
      </Dialog>
    </main>
  );
}
