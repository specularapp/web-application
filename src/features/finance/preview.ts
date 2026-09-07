import { addDays, format } from "date-fns";
import { formatReference } from "@/lib/utils/reference";
import type { FinanceSummary } from "./summary";

const day = (offset: number) => format(addDays(new Date(), offset), "yyyy-MM-dd");

/**
 * Resumo de exemplo enquanto o domínio não existe no banco. Quem montar as tabelas troca só a origem:
 * o bloco recebe o resumo por prop e não sabe de onde ele vem. As datas são relativas a hoje, para a
 * prévia não envelhecer. Pessoa sem foto ganha o rosto gerado pelo `Avatar`; serviço usa a logo que
 * já existe em `public/brands`.
 */
export const previewFinanceSummary: FinanceSummary = {
  balance: 1_605_894,
  transactions: [
    {
      id: "t1",
      reference: formatReference("transaction", 2026, 148),
      kind: "scheduled",
      visual: { type: "person", avatarUrl: null },
      title: "Marina Duarte",
      description: "Mensalidade do contrato de manutenção",
      amount: 180_000,
      date: day(4),
      method: { type: "pix", label: "Pix" },
    },
    {
      id: "t2",
      reference: formatReference("transaction", 2026, 147),
      kind: "income",
      visual: { type: "person", avatarUrl: null },
      title: "Rafael Nunes",
      description: "Parcela 2 de 3 do site institucional",
      amount: 320_000,
      date: day(-1),
      time: "14:32",
      method: { type: "pix", label: "Pix" },
    },
    {
      id: "t3",
      reference: formatReference("transaction", 2026, 146),
      kind: "expense",
      visual: { type: "brand", name: "figma" },
      title: "Figma",
      description: "Assinatura mensal da equipe",
      amount: 14_990,
      date: day(-3),
      time: "03:10",
      method: { type: "card", label: "Cartão final 4242" },
    },
    {
      id: "t4",
      reference: formatReference("transaction", 2026, 145),
      kind: "income",
      visual: { type: "person", avatarUrl: null },
      title: "Linda Dong",
      description: "Pagamento final da identidade visual",
      amount: 450_000,
      date: day(-5),
      time: "10:05",
      method: { type: "transfer", label: "Transferência bancária" },
    },
    {
      id: "t5",
      reference: formatReference("transaction", 2026, 144),
      kind: "expense",
      status: "cancelled",
      visual: { type: "brand", name: "google" },
      title: "Google Workspace",
      description: "Assinatura mensal das contas de e-mail",
      amount: 9_800,
      date: day(-7),
      time: "08:00",
      method: { type: "card", label: "Cartão final 4242" },
    },
    {
      id: "t6",
      reference: formatReference("transaction", 2026, 143),
      kind: "income",
      title: "Rendimento da conta",
      description: "Rendimento automático do saldo em caixa",
      amount: 3_624,
      date: day(-8),
      time: "00:00",
    },
  ],
};
