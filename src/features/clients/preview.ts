import { addDays, format } from "date-fns";
import type { ClientsSummary } from "./summary";

const day = (offset: number) => format(addDays(new Date(), offset), "yyyy-MM-dd");

/**
 * Resumo de exemplo enquanto o domínio não existe no banco. Quem montar a tabela troca só a origem: o
 * bloco recebe o resumo por prop e não sabe de onde ele vem. Ninguém tem foto, para o rosto gerado pelo
 * `Avatar` aparecer; o telefone vai só em dígitos, como no banco.
 */
export const previewClientsSummary: ClientsSummary = {
  total: 26,
  clients: [
    { id: "c1", name: "Camila Ferreira", email: "camila@estudioaurora.com.br", phone: "11987654321", avatarUrl: null, createdAt: day(-1) },
    { id: "c2", name: "Rafael Nunes", email: "rafael.nunes@bravo.studio", phone: "21998877665", avatarUrl: null, createdAt: day(-3) },
    { id: "c3", name: "Marina Duarte", email: "marina@padariaaurora.com", phone: "31988776655", avatarUrl: null, createdAt: day(-6) },
    { id: "c4", name: "Linda Dong", email: "linda@dong.design", phone: "4133445566", avatarUrl: null, createdAt: day(-9) },
    { id: "c5", name: "Tiago Almeida", email: "tiago@almeidaeng.com.br", phone: "51997766554", avatarUrl: null, createdAt: day(-12) },
    { id: "c6", name: "Beatriz Rocha", email: "bia@rochaadvocacia.com", phone: "61996655443", avatarUrl: null, createdAt: day(-15) },
  ],
};
