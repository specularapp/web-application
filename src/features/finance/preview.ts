import { addDays, format } from "date-fns";
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
      kind: "scheduled",
      visual: { type: "person", avatarUrl: null },
      title: "Marina Duarte",
      description: "Mensalidade do contrato de manutenção",
      amount: 180_000,
      date: day(4),
    },
    {
      id: "t2",
      kind: "income",
      visual: { type: "person", avatarUrl: null },
      title: "Rafael Nunes",
      description: "Parcela 2 de 3 do site institucional",
      amount: 320_000,
      date: day(-1),
    },
    {
      id: "t3",
      kind: "expense",
      visual: { type: "brand", name: "figma" },
      title: "Figma",
      description: "Assinatura mensal da equipe",
      amount: 14_990,
      date: day(-3),
    },
    {
      id: "t4",
      kind: "income",
      visual: { type: "person", avatarUrl: null },
      title: "Linda Dong",
      description: "Pagamento final da identidade visual",
      amount: 450_000,
      date: day(-5),
    },
    {
      id: "t5",
      kind: "expense",
      visual: { type: "brand", name: "google" },
      title: "Google Workspace",
      description: "Assinatura mensal das contas de e-mail",
      amount: 9_800,
      date: day(-7),
    },
    {
      id: "t6",
      kind: "income",
      title: "Rendimento da conta",
      description: "Rendimento automático do saldo em caixa",
      amount: 3_624,
      date: day(-8),
    },
  ],
};
