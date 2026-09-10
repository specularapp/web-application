"use client";

import { CheckIcon, DownloadSimpleIcon, InfoIcon, WhatsappLogoIcon, XIcon } from "@phosphor-icons/react";
import { useState } from "react";
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
import { quoteAttachmentName, quoteDocumentName } from "../share";
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
  const [details, setDetails] = useState(false);
  const [preparing, setPreparing] = useState(false);
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
     rota ao lado da página devolve o PDF pronto, gerado da mesma folha. */
  const downloadUrl = `/orcamento/${quote.shareToken}/pdf`;
  /* Dois nomes para o mesmo arquivo: o bonito, com acento e vírgula, para o download do computador, onde ele
     é lido como texto; e o seguro, sem nenhum dos dois, para virar anexo no celular. */
  const fileName = `${quoteDocumentName(quote)}.pdf`;
  const attachmentName = quoteAttachmentName(quote);

  /* **No celular o arquivo vai para a folha de compartilhar do sistema** (pedido de 2026-09-10, do relato de
     que no Safari do iPhone não dava para baixar): o `download` de uma âncora não existe no iOS, então o PDF
     sempre abria no visualizador e ficava sem saída dali. Buscando o arquivo e entregando-o ao
     `navigator.share`, o iPhone abre a folha que ele já conhece, com Salvar em Arquivos, Enviar por WhatsApp
     e imprimir na mesma lista, que é o que a pessoa quer fazer com um orçamento. Só entra quando o navegador
     diz que aceita compartilhar **arquivo** (`canShare` com o `File` na mão, e não só `share`, que existe em
     muito lugar que não recebe anexo); fora daí o botão continua sendo a âncora com `download`, que é o
     caminho certo no desktop.

     Cancelar a folha vem como `AbortError` e não é erro nenhum: a pessoa desistiu, e a tela não avisa nada.

     **A capacidade é medida antes de buscar o arquivo**, com um `File` vazio do mesmo tipo: compartilhar
     precisa do gesto da pessoa ainda valendo, e cada espera no caminho gasta essa permissão. Perguntando
     primeiro, quem não compartilha arquivo desvia para o download antes de baixar nada, e quem compartilha
     chega ao `share` com uma espera só no meio. */
  const canShareFile = () => navigator.canShare?.({ files: [new File([], attachmentName, { type: "application/pdf" })] }) ?? false;

  /* Sem compartilhar arquivo, é o download comum: a âncora entra no documento antes do clique, porque o
     Safari ignora clique em elemento que não está nele, e sai depois. */
  const downloadByLink = () => {
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
  };

  const getFile = async () => {
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error(String(response.status));
    return new File([await response.blob()], attachmentName, { type: "application/pdf" });
  };

  const shareFile = async () => {
    if (!canShareFile()) {
      downloadByLink();
      return;
    }

    setPreparing(true);
    try {
      /* Só o arquivo, sem `title` nem `text` (acerto de 2026-09-10, do relato de que o WhatsApp do iPhone
         recusava o anexo): com um título ao lado dos arquivos a folha do iOS recebe dois assuntos e deixa de
         montar a prévia do documento, e sem prévia o destino recebe um anexo degradado. Salvar em Arquivos
         continuava funcionando, porque só precisa dos bytes; o WhatsApp falhava. O nome do arquivo já diz o
         que ele é, e é ele que o destino mostra. */
      await navigator.share({ files: [await getFile()] });
    } catch (error) {
      /* Fechar a folha sem escolher nada é `AbortError`, e não é erro: a pessoa desistiu, e a tela fica quieta. */
      if (error instanceof DOMException && error.name === "AbortError") return;
      /* Se o compartilhar foi recusado (o gesto expirou enquanto o PDF era montado, por exemplo), o download
         comum ainda resolve, e é melhor que avisar de um erro que a pessoa não pode consertar. */
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        downloadByLink();
        return;
      }
      toast({ title: "Não deu para preparar o arquivo", description: "Tente de novo em um instante.", tone: "danger" });
    } finally {
      setPreparing(false);
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
          impressão: o que sai no papel é só a folha. São cinco ações e nada além (pedido de 2026-09-10):
          baixar, os detalhes, aprovar, recusar e voltar. */}
      <div className={styles.toolbar} role="toolbar" aria-label="Ações do orçamento" {...squircle("lg")}>
        {/* No celular baixar entrega o arquivo à folha de compartilhar do sistema, que é de onde ele vai para
            Arquivos, WhatsApp ou impressora; no desktop é a âncora com `download`, que o navegador resolve
            direto. O giro aparece enquanto o PDF é montado no servidor. */}
        {mobile ? (
          <IconButton label="Baixar o orçamento em PDF" variant="ghost" size="sm" loading={preparing} disabled={preparing} onClick={() => void shareFile()}>
            <DownloadSimpleIcon />
          </IconButton>
        ) : (
          <IconButton label="Baixar o orçamento em PDF" variant="ghost" size="sm" href={downloadUrl} download={fileName}>
            <DownloadSimpleIcon />
          </IconButton>
        )}

        <IconButton label="Detalhes do orçamento" variant="ghost" size="sm" onClick={() => setDetails(true)}>
          <InfoIcon />
        </IconButton>

        <span className={styles.divider} aria-hidden="true" />

        {open ? (
          <>
            <Button size="sm" radius="md" iconStart={<CheckIcon weight="bold" />} loading={pending === "approve"} disabled={pending !== null} onClick={() => respond("approve")}>
              Aprovar
            </Button>
            {/* No celular recusar fica só no X (pedido de 2026-09-10): aprovar é a ação que se quer ler, e
                escrever as duas na mesma fila estreita apertava a linha. O nome continua na voz. */}
            {mobile ? (
              <IconButton
                label="Recusar o orçamento"
                variant="ghost"
                size="sm"
                loading={pending === "decline"}
                disabled={pending !== null}
                onClick={() => respond("decline")}
              >
                <XIcon weight="bold" />
              </IconButton>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                radius="md"
                iconStart={<XIcon weight="bold" />}
                loading={pending === "decline"}
                disabled={pending !== null}
                onClick={() => respond("decline")}
              >
                Recusar
              </Button>
            )}
          </>
        ) : (
          <Text as="span" variant="footnote" tone="secondary" className={styles.answered}>
            {status === "approved" ? "Você aprovou" : status === "declined" ? "Você recusou" : "Orçamento vencido"}
          </Text>
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
