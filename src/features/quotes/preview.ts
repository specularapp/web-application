import { addDays, format } from "date-fns";
import { formatReference } from "@/lib/utils/reference";
import type { QuotesSummary } from "./summary";

const day = (offset: number) => format(addDays(new Date(), offset), "yyyy-MM-dd");

/**
 * Orçamento de exemplo enquanto o domínio não existe no banco. Quem montar a tabela troca só a origem:
 * o bloco recebe o resumo por prop e não sabe de onde ele vem. As datas são relativas a hoje, para a
 * prévia não envelhecer; ninguém tem foto, para o rosto gerado pelo `Avatar` aparecer.
 */
export const previewQuotesSummary: QuotesSummary = {
  latest: {
    id: "q-2026-0042",
    number: formatReference("quote", 2026, 42),
    title: "Site institucional e identidade visual",
    client: { name: "Camila Ferreira", avatarUrl: null },
    owner: { name: "Aleph Ramos", avatarUrl: null },
    amount: 1_840_000,
    installments: 3,
    items: 4,
    status: "sent",
    sentAt: day(-2),
    validUntil: day(13),
    description: "Site em cinco páginas com blog, identidade visual completa e manual de marca para a padaria.",
  },
};
