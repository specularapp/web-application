import { addDays, format } from "date-fns";
import { previewCatalog } from "@/features/catalog/list-preview";
import { previewClients } from "@/features/clients/list-preview";
import { previewTeamSummary } from "@/features/organizations/preview";
import { formatReference } from "@/lib/utils/reference";
import type { LatestQuote, Quote, QuoteCourtesy, QuoteIssuer, QuotePaymentMethod, QuoteStatus } from "./summary";
import { quoteTotals } from "./totals";

/**
 * Orçamentos de exemplo enquanto o domínio não existe no banco. Quem montar a tabela troca só a origem: a
 * página recebe a página pronta e não sabe de onde ela veio. Quarenta e dois orçamentos, para a paginação
 * de trinta aparecer já na primeira visita, com os clientes da base de exemplo e as linhas saindo do
 * catálogo de exemplo, para as três telas falarem das mesmas pessoas e dos mesmos itens. Datas relativas a
 * hoje, para a prévia não envelhecer.
 */

const day = (offset: number) => format(addDays(new Date(), offset), "yyyy-MM-dd");

/** A equipe que emite, enquanto o time não tem contatos próprios no banco além do nome e da logo. */
export const previewIssuer: QuoteIssuer = {
  name: "Specular Studio",
  logoUrl: null,
  website: "https://specular.app",
  email: "contato@specular.app",
  phone: "11991234567",
  city: "São Paulo, SP",
};

const titles = [
  "Site institucional e identidade visual",
  "Loja virtual com catálogo integrado",
  "Aplicativo para pedidos",
  "Redesign da marca",
  "Campanha de lançamento",
  "Manutenção e hospedagem anual",
  "Landing page da campanha de fim de ano",
  "Sistema interno de agendamentos",
  "Apresentação comercial e papelaria",
  "Blog e conteúdo mensal",
  "Área de membros com assinatura",
  "Consultoria técnica e auditoria",
  "Vídeo institucional e redes sociais",
  "Domínio, e-mail e certificado",
];

/* Cada orçamento pega itens vizinhos do catálogo, num passo que varia com o índice, para não saírem todos iguais. */
const lineSets = [
  [0, 6],
  [1, 7, 14],
  [3, 18],
  [6, 8, 25],
  [10, 27, 26],
  [15, 16, 17, 33],
  [0, 27],
  [4, 22],
  [8, 24, 26],
  [22, 28],
  [23, 21],
  [19, 20],
  [13, 29, 9],
  [14, 31, 16],
];

const statusCycle: QuoteStatus[] = ["sent", "approved", "viewed", "draft", "approved", "sent", "declined", "approved", "expired", "viewed", "sent", "approved"];
const methods: QuotePaymentMethod[] = ["transfer", "card", "boleto", "pix", "card", "transfer", "boleto"];

/* Um token de 64 hexadecimais, determinístico pelo índice, no formato que o link público exige. */
const tokenOf = (index: number) => {
  let seed = 0x9e3779b9 ^ (index + 1);
  let out = "";
  while (out.length < 64) {
    seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + index) >>> 0;
    seed = (Math.imul(seed ^ (seed >>> 12), 0x297a2d39) ^ 0x68e31da4) >>> 0;
    out += seed.toString(16).padStart(8, "0");
  }
  return out.slice(0, 64);
};

const NOTES = "Os prazos começam a contar depois do aceite e do recebimento do material listado em cada item. Alterações fora do escopo são orçadas à parte.";

export const previewQuotes: Quote[] = Array.from({ length: 42 }, (_, index) => {
  const client = previewClients[(index * 7) % previewClients.length];
  const owner = previewTeamSummary.members[index % previewTeamSummary.members.length];
  const status = statusCycle[index % statusCycle.length];
  const issuedOffset = -(index * 4 + (index % 3));
  const sent = status !== "draft";
  const responded = status === "approved" || status === "declined";
  const lines = lineSets[index % lineSets.length].map((catalogIndex, position) => {
    const item = previewCatalog[catalogIndex % previewCatalog.length];
    const quantity = item.unit === "hour" ? 8 + (index % 5) * 4 : item.unit === "unit" ? 1 + ((index + position) % 3) : item.unit === "month" ? 6 + (index % 2) * 6 : 1;
    return {
      id: `q${index + 1}-l${position + 1}`,
      catalogItemId: item.id,
      name: item.name,
      description: item.description,
      quantity,
      unitPrice: item.price,
      unit: item.unit,
      // Um brinde de vez em quando, sempre no último item e só em produto: é como a equipe fecha negócio.
      // Um em cada dez é cortesia só se fechar hoje, que é a versão com pressa.
      courtesy: (position > 0 && index % 5 === 0 && item.kind === "product" ? (index % 10 === 0 ? "today" : "yes") : "no") satisfies QuoteCourtesy as QuoteCourtesy,
    };
  });

  return {
    id: `q-2026-${String(42 - index).padStart(4, "0")}`,
    number: formatReference("quote", 2026, 42 - index),
    title: titles[index % titles.length],
    status,
    clientId: client.id,
    client: {
      name: client.name,
      avatarUrl: client.avatarUrl,
      company: client.company,
      email: client.email ?? undefined,
      phone: client.phone ?? undefined,
      city: client.city,
    },
    /* O estilo da assinatura alterna na base de exemplo (2026-09-10): a escolha é de quem assina e a tela
       que a define entra depois, então por ora os dois desenhos aparecem na lista, um a cada orçamento. */
    owner: { name: owner.name, avatarUrl: owner.avatarUrl, signatureStyle: index % 2 === 0 ? "written" : "digital" },
    issuer: previewIssuer,
    lines,
    discount: index % 4 === 0 ? { kind: "percent", value: 10 } : index % 7 === 0 ? { kind: "amount", value: 50_000 } : null,
    installments: index % 3 === 0 ? 3 : index % 5 === 0 ? 2 : 1,
    paymentMethods: index % 3 === 0 ? [methods[index % methods.length], "pix"] : [methods[index % methods.length]],
    cashDiscount: index % 2 === 0 ? 5 : 0,
    notes: index % 2 === 0 ? NOTES : "",
    issuedAt: day(issuedOffset),
    validUntil: day(issuedOffset + 15),
    sentAt: sent ? day(issuedOffset + 1) : null,
    viewedAt: status === "viewed" || responded ? day(issuedOffset + 2) : null,
    respondedAt: responded ? day(issuedOffset + 4) : null,
    shareToken: tokenOf(index),
    createdAt: day(issuedOffset),
    updatedAt: day(Math.min(0, issuedOffset + 4)),
  };
});

/** A versão curta que o painel e a ficha do cliente leem, com os totais já somados. */
export function toLatestQuote(quote: Quote): LatestQuote {
  const { total } = quoteTotals(quote);
  return {
    id: quote.id,
    number: quote.number,
    title: quote.title,
    client: { name: quote.client.name, avatarUrl: quote.client.avatarUrl },
    owner: quote.owner,
    amount: total,
    installments: quote.installments,
    items: quote.lines.length,
    status: quote.status,
    sentAt: quote.sentAt,
    validUntil: quote.validUntil,
    description: quote.lines.map((line) => line.name).join(", "),
  };
}
