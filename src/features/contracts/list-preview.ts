import { addDays, format } from "date-fns";
import { previewTeamSummary } from "@/features/organizations/preview";
import { previewProjects } from "@/features/projects/list-preview";
import { previewIssuer, previewQuotes } from "@/features/quotes/list-preview";
import { quoteTotals } from "@/features/quotes/totals";
import { formatReference } from "@/lib/utils/reference";
import type { Contract, ContractEvent, ContractKind, ContractSource, ContractStatus, ContractTheme } from "./summary";
import { findTemplate, type TemplateContext } from "./templates";

/**
 * Contratos de exemplo enquanto o domínio não existe no banco: é a semente do store em memória (`store.ts`),
 * de onde a página lê. Nascem dos **orçamentos aprovados da base de exemplo**, que é de onde um contrato nasce
 * no produto (`objective.md`), com o cliente, quem responde e o valor vindos do orçamento, e ligados ao projeto
 * do mesmo cliente quando ele existe na base de projetos, para o vínculo de uma tela cair no cartão certo da
 * outra. O documento de cada um é o modelo pronto do tipo, já preenchido; os que nasceram de PDF ganham o
 * arquivo no store, que o gera na primeira leitura. Datas relativas ao orçamento, para a prévia não
 * envelhecer.
 *
 * As situações, as origens, os temas e os tipos saem de um padrão determinístico pelo índice, como as outras
 * prévias: dá uma lista plausível, com todas as situações e as três origens à vista, e a mesma carga sai
 * sempre igual.
 */

const day = (iso: string, offset: number) => format(addDays(new Date(iso), offset), "yyyy-MM-dd");
const moment = (iso: string, offset: number, time: string) => `${day(iso, offset)}T${time}`;

const statusCycle: ContractStatus[] = ["signed", "sent", "signed", "partial", "draft", "signed", "sent", "cancelled", "signed", "sent", "signed", "draft"];
const sourceCycle: ContractSource[] = ["template", "pdf", "scratch", "template", "template", "scratch", "pdf", "template"];
const themeCycle: ContractTheme[] = ["plain", "blue", "plain", "purple", "green", "plain", "yellow", "blue"];

/* O tipo sai do título do orçamento, para a etiqueta do cartão combinar com o que o documento diz. */
function kindOf(title: string): ContractKind {
  const text = title.toLowerCase();
  if (text.includes("landing")) return "landing";
  if (text.includes("loja") || text.includes("membros")) return "ecommerce";
  if (text.includes("aplicativo") || text.includes("sistema")) return "app";
  if (text.includes("marca") || text.includes("identidade") || text.includes("papelaria")) return "branding";
  if (text.includes("manutenção") || text.includes("hospedagem")) return "maintenance";
  if (text.includes("blog") || text.includes("conteúdo") || text.includes("campanha")) return "content";
  if (text.includes("site")) return "institutional";
  return "other";
}

/* O token do endereço público de cada parte, estável por contrato: a prévia não pode trocar de link a cada
   carga, senão o link mandado ao cliente morre no reload. */
const tokenOf = (index: number, role: string) => `${role}${String(index + 1).padStart(3, "0")}${"k7m2p9q4w1z8x3v6c5b0n2".slice(index % 10, (index % 10) + 12)}`;

const approved = previewQuotes.filter((quote) => quote.status === "approved");

export const previewContracts: Contract[] = approved.map((quote, index) => {
  const sequence = approved.length - index;
  const status = statusCycle[index % statusCycle.length] ?? "signed";
  const source = sourceCycle[index % sourceCycle.length] ?? "template";
  const kind = kindOf(quote.title);
  const template = findTemplate(kind) ?? findTemplate("institutional")!;
  const owner = previewTeamSummary.members.find((member) => member.name === quote.owner.name) ?? previewTeamSummary.members[0]!;
  const createdAt = day(quote.respondedAt ?? quote.issuedAt, 1);
  const sent = status !== "draft";
  const sentAt = sent ? day(createdAt, 1) : null;
  const clientSigned = status === "signed" || status === "partial";
  const issuerSigned = status === "signed";
  const clientSignedAt = clientSigned ? moment(createdAt, 2, "10:05:00") : null;
  const issuerSignedAt = issuerSigned ? moment(createdAt, 3, "14:20:00") : null;
  const project = previewProjects.find((entry) => entry.client.id === quote.clientId) ?? null;
  const amount = quoteTotals(quote).total;
  const client = { id: quote.clientId ?? `fora-${index}`, name: quote.client.name, company: quote.client.company, avatarUrl: quote.client.avatarUrl };

  const context: TemplateContext = {
    issuer: { name: previewIssuer.name, email: owner.email ?? previewIssuer.email, city: previewIssuer.city },
    client: { name: client.name, company: client.company },
    amount,
    date: createdAt,
    project: project?.name ?? null,
  };
  const built = template.build(context);

  const events: ContractEvent[] = [{ id: `${sequence}-e1`, kind: "created", actor: owner.name, at: moment(createdAt, 0, "09:12:00") }];
  if (sentAt) events.push({ id: `${sequence}-e2`, kind: "sent", actor: owner.name, at: moment(sentAt, 0, "09:40:00") });
  if (clientSigned) events.push({ id: `${sequence}-e3`, kind: "viewed", actor: client.name, at: moment(createdAt, 2, "09:58:00") }, { id: `${sequence}-e4`, kind: "signed", actor: client.name, at: clientSignedAt! });
  if (issuerSigned) events.push({ id: `${sequence}-e5`, kind: "signed", actor: owner.name, at: issuerSignedAt! });
  if (status === "cancelled") events.push({ id: `${sequence}-e6`, kind: "cancelled", actor: owner.name, at: moment(createdAt, 5, "16:30:00") });

  return {
    id: `c${sequence}`,
    reference: formatReference("contract", 2026, sequence),
    title: quote.title,
    kind,
    description: built.description,
    source,
    status,
    client,
    owner: { name: owner.name, avatarUrl: owner.avatarUrl },
    parties: [
      {
        id: `${sequence}-issuer`,
        role: "issuer",
        name: owner.name,
        email: owner.email ?? previewIssuer.email ?? "contato@specular.app",
        avatarUrl: owner.avatarUrl,
        token: tokenOf(index, "i"),
        viewedAt: issuerSigned ? moment(createdAt, 3, "14:10:00") : null,
        signedAt: issuerSignedAt,
        signatureUrl: null,
      },
      {
        id: `${sequence}-client`,
        role: "client",
        name: quote.client.name,
        email: quote.client.email ?? `${quote.client.name.split(" ")[0]?.toLowerCase()}@exemplo.com`,
        avatarUrl: quote.client.avatarUrl,
        token: tokenOf(index, "c"),
        viewedAt: clientSigned ? moment(createdAt, 2, "09:58:00") : null,
        signedAt: clientSignedAt,
        signatureUrl: null,
      },
    ],
    project: project ? { id: project.id, name: project.name, url: project.url } : null,
    quote: { id: quote.id, number: quote.number, title: quote.title, amount },
    amount,
    body: source === "pdf" ? null : built.body,
    theme: themeCycle[index % themeCycle.length] ?? "plain",
    templateId: template.id,
    file: null,
    fields: [],
    expiresInDays: 15,
    createdAt,
    sentAt,
    expiresAt: sent && status !== "signed" && status !== "cancelled" ? day(createdAt, 1 + 15 - (index % 4) * 6) : null,
    signedAt: issuerSignedAt,
    events,
  };
});
