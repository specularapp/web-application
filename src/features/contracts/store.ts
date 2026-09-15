import "server-only";
import { addDays, format } from "date-fns";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { previewClients } from "@/features/clients/list-preview";
import { previewTeamSummary } from "@/features/organizations/preview";
import { previewProjects } from "@/features/projects/list-preview";
import { previewIssuer, previewQuotes } from "@/features/quotes/list-preview";
import { quoteTotals } from "@/features/quotes/totals";
import { formatReference } from "@/lib/utils/reference";
import { previewContracts } from "./list-preview";
import type { SaveContractInput } from "./schemas";
import type { Contract, ContractEvent, ContractEventKind, ContractParty, ContractSource, SignatureField } from "./summary";
import { blankDocument, findTemplate, plainText, type TemplateContext } from "./templates";

/**
 * Onde os contratos vivem enquanto o domínio não existe no banco (2026-09-14): uma lista na memória do
 * servidor, semeada pela prévia, mais os bytes dos PDFs anexados num mapa à parte, porque o contrato viaja
 * para a tela e o arquivo não. É a regra do domínio inteira, com a assinatura que a tabela vai herdar: criar
 * pelas três origens, salvar o rascunho, enviar, registrar a visualização e a assinatura de cada parte,
 * cancelar. Zera quando o processo reinicia e não é compartilhada entre instâncias, então é só a ponte:
 * quando a tabela nascer, cada função vira a consulta ou a escrita em `service.ts`, com a RLS valendo, e
 * `api/v1` expõe as mesmas para o aplicativo.
 */

let contracts: Contract[] = [];
const files = new Map<string, Uint8Array>();
let seeding: Promise<void> | null = null;

const today = () => format(new Date(), "yyyy-MM-dd");
const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID().slice(0, 8);
/** O token do endereço público de uma parte: aleatório e longo o bastante para não ser adivinhado. */
const newToken = () => crypto.randomUUID().replace(/-/g, "");

/* Quem emite, na prévia: o primeiro da equipe, que é quem está na sessão de exemplo. */
const currentMember = () => previewTeamSummary.members[0]!;

const event = (kind: ContractEventKind, actor: string | null): ContractEvent => ({ id: newId(), kind, actor, at: now() });

/* A sequência seguinte sai do maior identificador que existe: o número é o que a pessoa vê e fala, então não
   pode repetir nem reaproveitar buraco. */
function nextSequence() {
  return contracts.reduce((max, contract) => Math.max(max, Number(contract.reference.split("-").at(-1) ?? 0)), 0) + 1;
}

async function ready() {
  seeding ??= seed();
  await seeding;
}

/**
 * A semente: a prévia inteira, e para os contratos que nasceram de PDF um arquivo de exemplo gerado na hora
 * com o texto do modelo do tipo deles, com os dois campos de assinatura na última página. É o que deixa o
 * caminho do PDF anexado ser visto e assinado sem ninguém precisar subir um arquivo.
 */
async function seed() {
  contracts = previewContracts.map((contract) => ({ ...contract, parties: contract.parties.map((party) => ({ ...party })), events: [...contract.events], fields: [...contract.fields] }));
  for (const contract of contracts) {
    if (contract.source !== "pdf") continue;
    const bytes = await samplePdf(contract);
    files.set(contract.id, bytes);
    contract.file = { name: `${contract.title}.pdf`, size: bytes.byteLength, pages: 2 };
    contract.fields = defaultFields(contract, 2);
    contract.body = null;
  }
}

/* Um PDF simples de duas páginas com o texto do modelo do tipo do contrato, para a semente do caminho do
   arquivo anexado. Helvetica, porque é a fonte que todo leitor tem. */
async function samplePdf(contract: Contract) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const template = findTemplate(contract.templateId ?? contract.kind) ?? findTemplate("institutional")!;
  const built = template.build(contextOf(contract));
  const lines = plainText(built.body)
    .split("\n")
    .flatMap((line) => wrap(line, 92));

  let page = pdf.addPage([595.28, 841.89]);
  let cursor = 841.89 - 64;
  page.drawText(contract.title, { x: 56, y: cursor, size: 16, font: bold, color: rgb(0, 0, 0) });
  cursor -= 30;
  for (const line of lines) {
    if (cursor < 96) {
      page = pdf.addPage([595.28, 841.89]);
      cursor = 841.89 - 64;
    }
    page.drawText(line, { x: 56, y: cursor, size: 9.5, font, color: rgb(0.1, 0.1, 0.12) });
    cursor -= line === "" ? 8 : 14;
  }
  while (pdf.getPageCount() < 2) pdf.addPage([595.28, 841.89]);

  return pdf.save();
}

function wrap(text: string, width: number) {
  if (text.length <= width) return [text];
  const words = text.split(" ");
  const out: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > width) {
      out.push(line.trim());
      line = word;
    } else line = `${line} ${word}`;
  }
  if (line.trim()) out.push(line.trim());
  return out;
}

/* Os dois campos padrão de um PDF anexado: lado a lado no pé da última página, a contratada à esquerda. */
function defaultFields(contract: Contract, pages: number): SignatureField[] {
  return contract.parties.map((party, index) => ({
    id: `f-${party.id}`,
    partyId: party.id,
    page: pages,
    x: index === 0 ? 0.1 : 0.55,
    y: 0.8,
    width: 0.35,
    height: 0.075,
  }));
}

function contextOf(contract: Contract): TemplateContext {
  const member = currentMember();
  return {
    issuer: { name: previewIssuer.name, email: member.email ?? previewIssuer.email, city: previewIssuer.city },
    client: contract.client ? { name: contract.client.name, company: contract.client.company } : null,
    amount: contract.amount,
    date: contract.createdAt,
    project: contract.project?.name ?? null,
  };
}

export async function readContracts(): Promise<Contract[]> {
  await ready();
  return contracts;
}

/** As bases de onde o editor puxa vínculos: os clientes, os projetos e os orçamentos aprovados da casa. */
export type ContractLookups = {
  clients: { id: string; name: string; company?: string; email: string | null; avatarUrl: string | null }[];
  projects: { id: string; name: string; clientId: string; url: string | null }[];
  quotes: { id: string; number: string; title: string; clientId: string | null; amount: number }[];
};

export async function readContractLookups(): Promise<ContractLookups> {
  return {
    clients: previewClients
      .map((client) => ({ id: client.id, name: client.name, company: client.company, email: client.email, avatarUrl: client.avatarUrl }))
      .sort((a, b) => (a.company ?? a.name).localeCompare(b.company ?? b.name, "pt-BR")),
    projects: previewProjects.map((project) => ({ id: project.id, name: project.name, clientId: project.client.id, url: project.url })),
    quotes: previewQuotes.filter((quote) => quote.status === "approved").map((quote) => ({ id: quote.id, number: quote.number, title: quote.title, clientId: quote.clientId, amount: quoteTotals(quote).total })),
  };
}

export async function findContract(id: string) {
  await ready();
  return contracts.find((contract) => contract.id === id) ?? null;
}

/** O contrato e a parte pelo token dela: é a credencial da página pública. */
export async function findContractByPartyToken(token: string) {
  await ready();
  for (const contract of contracts) {
    const party = contract.parties.find((entry) => entry.token === token);
    if (party) return { contract, party };
  }
  return null;
}

export async function readContractFile(id: string) {
  await ready();
  return files.get(id) ?? null;
}

function issuerParty(): ContractParty {
  const member = currentMember();
  return { id: newId(), role: "issuer", name: member.name, email: member.email ?? previewIssuer.email ?? "", avatarUrl: member.avatarUrl, token: newToken(), viewedAt: null, signedAt: null, signatureUrl: null };
}

function skeleton(source: ContractSource): Contract {
  const member = currentMember();
  const sequence = nextSequence();
  return {
    id: `c${sequence}-${newId()}`,
    reference: formatReference("contract", new Date().getFullYear(), sequence),
    title: "Contrato sem título",
    kind: "other",
    description: "",
    source,
    status: "draft",
    client: null,
    owner: { name: member.name, avatarUrl: member.avatarUrl },
    parties: [issuerParty()],
    project: null,
    quote: null,
    amount: null,
    body: null,
    theme: "plain",
    templateId: null,
    file: null,
    fields: [],
    expiresInDays: 15,
    createdAt: today(),
    sentAt: null,
    expiresAt: null,
    signedAt: null,
    events: [event("created", member.name)],
  };
}

/** Um rascunho novo, escrito: do zero, com o esqueleto, ou de um modelo, já preenchido com o que se sabe. */
export async function createContract(input: { source: "template" | "scratch"; templateId?: string; kind?: Contract["kind"] }) {
  await ready();
  const contract = skeleton(input.source);
  const template = input.source === "template" && input.templateId ? findTemplate(input.templateId) : null;

  if (template) {
    const built = template.build(contextOf(contract));
    contract.title = built.title;
    contract.description = built.description;
    contract.body = built.body;
    contract.kind = template.kind;
    contract.templateId = template.id;
  } else {
    contract.body = blankDocument(contextOf(contract));
    if (input.kind) contract.kind = input.kind;
  }

  contracts = [contract, ...contracts];
  return contract;
}

/** Um rascunho novo a partir de um PDF anexado: o arquivo fica no mapa, e o contrato só sabe o nome, o tamanho e as páginas. */
export async function createPdfContract(input: { name: string; bytes: Uint8Array; pages: number }) {
  await ready();
  const contract = skeleton("pdf");
  contract.title = input.name.replace(/\.pdf$/i, "").slice(0, 90) || "Contrato anexado";
  contract.file = { name: input.name, size: input.bytes.byteLength, pages: input.pages };
  files.set(contract.id, input.bytes);
  contracts = [contract, ...contracts];
  return contract;
}

export type SaveResult = { ok: true; contract: Contract } | { ok: false; error: string; field?: string };

/**
 * Salva o rascunho: quem contrata, a que se liga, o documento, os campos e as partes. Só rascunho aceita;
 * documento enviado não muda por baixo de quem vai assinar. O cliente, o projeto e o orçamento saem das bases
 * da casa pelo id, e o valor vem do orçamento quando há um.
 */
export async function saveContract(input: SaveContractInput): Promise<SaveResult> {
  await ready();
  const contract = contracts.find((entry) => entry.id === input.id);
  if (!contract) return { ok: false, error: "Esse contrato não existe mais." };
  if (contract.status !== "draft") return { ok: false, error: "Um contrato enviado não pode ser editado. Cancele e crie outro." };

  const client = input.clientId ? previewClients.find((entry) => entry.id === input.clientId) : null;
  if (input.clientId && !client) return { ok: false, error: "Esse cliente não está mais na base.", field: "clientId" };
  const project = input.projectId ? previewProjects.find((entry) => entry.id === input.projectId) : null;
  if (input.projectId && !project) return { ok: false, error: "Esse projeto não está mais na base.", field: "projectId" };
  const quote = input.quoteId ? previewQuotes.find((entry) => entry.id === input.quoteId) : null;
  if (input.quoteId && !quote) return { ok: false, error: "Esse orçamento não está mais na base.", field: "quoteId" };

  contract.title = input.title || contract.title;
  contract.kind = input.kind;
  contract.description = input.description;
  contract.theme = input.theme;
  contract.expiresInDays = input.expiresInDays;
  contract.client = client ? { id: client.id, name: client.name, company: client.company, avatarUrl: client.avatarUrl } : null;
  contract.project = project ? { id: project.id, name: project.name, url: project.url } : null;
  contract.quote = quote ? { id: quote.id, number: quote.number, title: quote.title, amount: quoteTotals(quote).total } : null;
  contract.amount = quote ? quoteTotals(quote).total : contract.amount;
  if (contract.source !== "pdf") contract.body = input.body ?? contract.body;
  else contract.fields = input.fields;

  /* As partes: quem emite sempre existe e só troca o e-mail; quem contrata nasce com o cliente e vai embora
     com ele, guardando o token se já tinha um. */
  const issuer = contract.parties.find((party) => party.role === "issuer");
  if (issuer && input.emails.issuer) issuer.email = input.emails.issuer;
  const existing = contract.parties.find((party) => party.role === "client");
  if (client) {
    const email = input.emails.client || client.email || existing?.email || "";
    if (existing) {
      existing.name = client.name;
      existing.avatarUrl = client.avatarUrl;
      existing.email = email;
    } else {
      contract.parties.push({ id: newId(), role: "client", name: client.name, email, avatarUrl: client.avatarUrl, token: newToken(), viewedAt: null, signedAt: null, signatureUrl: null });
    }
  } else if (existing) {
    contract.parties = contract.parties.filter((party) => party.role !== "client");
    contract.fields = contract.fields.filter((field) => field.partyId !== existing.id);
  }

  return { ok: true, contract };
}

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export type SendResult = { ok: true; contract: Contract; reminder: boolean } | { ok: false; error: string };

/**
 * Envia para assinatura, ou reenvia o convite: as duas partes precisam existir com e-mail, e no PDF anexado
 * cada uma precisa de um campo marcado. O convite passa a valer por `expiresInDays` a partir de hoje.
 */
export async function sendContract(id: string): Promise<SendResult> {
  await ready();
  const contract = contracts.find((entry) => entry.id === id);
  if (!contract) return { ok: false, error: "Esse contrato não existe mais." };
  if (contract.status === "signed" || contract.status === "cancelled") return { ok: false, error: "Esse contrato já foi encerrado." };

  const client = contract.parties.find((party) => party.role === "client");
  const issuer = contract.parties.find((party) => party.role === "issuer");
  if (!contract.client || !client) return { ok: false, error: "Escolha quem contrata antes de enviar." };
  if (!validEmail(client.email)) return { ok: false, error: "Informe um e-mail válido para quem contrata." };
  if (!issuer || !validEmail(issuer.email)) return { ok: false, error: "Informe um e-mail válido para quem assina pela equipe." };
  if (contract.source === "pdf" && contract.parties.some((party) => !contract.fields.some((field) => field.partyId === party.id))) {
    return { ok: false, error: "Marque no documento onde cada parte assina." };
  }
  if (contract.source !== "pdf" && !contract.body) return { ok: false, error: "O documento está vazio." };

  const reminder = contract.status !== "draft";
  if (!reminder) {
    contract.status = "sent";
    contract.sentAt = today();
  }
  contract.expiresAt = format(addDays(new Date(), contract.expiresInDays), "yyyy-MM-dd");
  contract.events.push(event(reminder ? "resent" : "sent", currentMember().name));
  return { ok: true, contract, reminder };
}

/** A parte abriu o link: fica registrado uma vez, com quem abriu. */
export async function markViewed(token: string) {
  const found = await findContractByPartyToken(token);
  if (!found || found.party.viewedAt) return;
  found.party.viewedAt = now();
  found.contract.events.push(event("viewed", found.party.name));
}

export type SignResult = { ok: true; contract: Contract; party: ContractParty; completed: boolean } | { ok: false; error: string };

/**
 * A assinatura de uma parte, pelo token dela: o traço e o registro com data e hora ficam na parte, e a
 * situação do contrato anda para parcial ou assinado. Fora do prazo do convite ou depois de cancelado, não.
 */
export async function signContract(token: string, input: { name: string; signature: string }): Promise<SignResult> {
  const found = await findContractByPartyToken(token);
  if (!found) return { ok: false, error: "Este link não vale mais." };
  const { contract, party } = found;
  if (contract.status === "cancelled") return { ok: false, error: "Este contrato foi cancelado." };
  if (contract.status === "draft") return { ok: false, error: "Este contrato ainda não foi enviado para assinatura." };
  if (party.signedAt) return { ok: false, error: "Você já assinou este contrato." };
  if (contract.expiresAt && contract.expiresAt < today()) return { ok: false, error: "O prazo para assinar este contrato terminou. Peça um novo convite." };

  party.signedAt = now();
  party.signatureUrl = input.signature;
  contract.events.push(event("signed", input.name));

  const completed = contract.parties.every((entry) => entry.signedAt);
  contract.status = completed ? "signed" : "partial";
  if (completed) contract.signedAt = now();

  return { ok: true, contract, party, completed };
}

export async function cancelContract(id: string) {
  await ready();
  const contract = contracts.find((entry) => entry.id === id);
  if (!contract) return { ok: false as const, error: "Esse contrato não existe mais." };
  if (contract.status === "signed") return { ok: false as const, error: "Um contrato assinado não pode ser cancelado por aqui." };
  contract.status = "cancelled";
  contract.events.push(event("cancelled", currentMember().name));
  return { ok: true as const, contract };
}
