import type { Icon } from "@phosphor-icons/react";
import { BankIcon, BarcodeIcon, CheckCircleIcon, ClockIcon, CreditCardIcon, EyeIcon, FileDashedIcon, HourglassIcon, PixLogoIcon, XCircleIcon } from "@phosphor-icons/react/ssr";
import type { BadgeTone } from "@/components/ui/badge";
import type { QuotePaymentMethod, QuoteStatus } from "./summary";

/* A situação do orçamento em etiqueta: rótulo, tom e ícone, os mesmos no bloco do painel, na ficha do cliente,
   na tabela e no documento. */
export const quoteStatuses: Record<QuoteStatus, { label: string; tone: BadgeTone; icon: Icon }> = {
  draft: { label: "Rascunho", tone: "neutral", icon: FileDashedIcon },
  sent: { label: "Enviado", tone: "accent", icon: ClockIcon },
  viewed: { label: "Visualizado", tone: "info", icon: EyeIcon },
  approved: { label: "Aprovado", tone: "success", icon: CheckCircleIcon },
  declined: { label: "Recusado", tone: "danger", icon: XCircleIcon },
  expired: { label: "Vencido", tone: "warning", icon: HourglassIcon },
};

/**
 * As marcas dos meios de pagamento que o pé do documento mostra, pelos nomes dos arquivos de
 * `public/brands` (2026-09-09, a pedido). Desenhadas em máscara monocromática pelo `BrandIcon`, uma por
 * caixa quadrada, centradas em fila. **Só entram nomes que existem na pasta**: a máscara sem arquivo não
 * desenha nada, mas a caixa continua ocupando lugar, e a fila ficaria com buracos. Marca nova é um arquivo
 * em `public/brands` e o nome aqui.
 */
export const paymentBrandLogos = ["pix", "mastercard", "elo", "boleto"] as const;

/* A forma de pagamento como o documento escreve, com o glifo do recibo do financeiro. */
export const paymentMethods: Record<QuotePaymentMethod, { label: string; icon: Icon }> = {
  pix: { label: "Pix", icon: PixLogoIcon },
  transfer: { label: "Transferência bancária", icon: BankIcon },
  boleto: { label: "Boleto", icon: BarcodeIcon },
  card: { label: "Cartão de crédito", icon: CreditCardIcon },
};
