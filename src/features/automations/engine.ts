import "server-only";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { siteConfig } from "@/lib/metadata";
import { formatMoney } from "@/lib/utils/format";
import { nodeCatalog, nodeTitle } from "./catalog";
import { sendAutomationEmail } from "./emails";
import type { Automation, AutomationNode, AutomationRun, RunMode, RunStatus, RunStep, RunStepStatus } from "./summary";
import { continuesOnFail, emailPreview, evaluate, retriesOf, validEmail, type RunContext } from "./template";
import { triggerOf } from "./templates";

export type { RunContext } from "./template";

/**
 * O motor das automações: recebe um fluxo e o evento que o disparou e anda pelo grafo a partir do gatilho,
 * seguindo as ligações, fazendo cada passo e registrando o que aconteceu. Roda no servidor, porque manda
 * e-mail e chama endereço externo. Duas formas de rodar: por **evento**, quando a esperar o fluxo para e
 * fica "em espera" (quem o retoma é o relógio, quando o domínio for para o banco), e em **teste**, quando a
 * espera é pulada, os e-mails vão para quem está testando e o fluxo anda até o fim para a pessoa ver tudo.
 * Cada passo pode **tentar de novo** e **continuar se falhar**, pelas configurações do nó.
 */

export type Runner = { name: string; email: string };

/** Quantos passos um fluxo anda numa execução: um laço no quadro não pode rodar para sempre. */
const MAX_STEPS = 60;

/** Quanto um webhook tem para responder. */
const WEBHOOK_TIMEOUT = 8000;

const longDate = (date: Date) => format(date, "d 'de' MMMM", { locale: ptBR });

/** O contexto de um evento real, sem nada inventado: o que o evento não tem fica vazio. */
export function emptyContext(team: RunContext["equipe"]): RunContext {
  return {
    cliente: { nome: "", primeiro_nome: "", email: "", empresa: "" },
    cobranca: { numero: "", valor: "", valor_centavos: 0, vencimento: "", situacao: "", link: "" },
    contrato: { titulo: "", numero: "", situacao: "", link: "" },
    orcamento: { numero: "", valor: "", valor_centavos: 0 },
    equipe: team,
    hoje: longDate(new Date()),
  };
}

/**
 * O contexto do teste, para a pessoa ver o e-mail como o cliente veria. O cliente vem de fora, da conta de
 * quem testa, e não de uma lista escrita aqui: quem chama passa o primeiro cadastro da base, e sem nenhum
 * cadastro entra um nome genérico, com o e-mail de quem testa, para o teste chegar a alguém de verdade.
 */
export type SampleClient = { name: string; email: string; company: string };

export function sampleContext(team: RunContext["equipe"], client: SampleClient): RunContext {
  const first = client.name.split(" ")[0] ?? client.name;
  return {
    cliente: { nome: client.name, primeiro_nome: first, email: client.email, empresa: client.company },
    cobranca: { numero: "COB-2026-0031", valor: formatMoney(117_880), valor_centavos: 117_880, vencimento: longDate(addDays(new Date(), 3)), situacao: "em aberto", link: `${siteConfig.url}/cobranca/exemplo` },
    contrato: { titulo: "Domínio, e-mail e certificado", numero: "CTR-2026-0010", situacao: "aguardando assinatura", link: `${siteConfig.url}/contrato/exemplo` },
    orcamento: { numero: "ORC-2026-0029", valor: formatMoney(117_880), valor_centavos: 117_880 },
    equipe: team,
    hoje: longDate(new Date()),
  };
}

/** A equipe como o fluxo a escreve: o nome de quem emite e o e-mail de quem recebe os avisos internos. */
export const teamOf = (issuer: { name: string; email?: string }, runner: Runner): RunContext["equipe"] => ({
  nome: issuer.name,
  email: runner.email || issuer.email || "",
});

/* Só HTTPS e só para fora: endereço local ou de rede interna não vale, para o servidor não virar ponte. */
function webhookTarget(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(":")) return null;
    return url;
  } catch {
    return null;
  }
}

export type StepOutcome = { status: RunStepStatus; detail: string; branch?: "yes" | "no"; stop?: boolean };

export type RunInput = { mode: RunMode; trigger: string; context: RunContext; runner: Runner };

async function attempt(automation: Automation, node: AutomationNode, input: RunInput): Promise<StepOutcome> {
  const spec = nodeCatalog[node.kind];
  const { context, mode, runner } = input;

  switch (node.kind) {
    case "logic.wait": {
      const summary = spec.summary(node.config);
      return mode === "test" ? { status: "skipped", detail: `Esperaria ${summary}. No teste o fluxo segue direto.` } : { status: "waiting", detail: `Retoma em ${summary}.`, stop: true };
    }
    case "logic.condition": {
      const yes = evaluate(node.config, context);
      return { status: "done", detail: `${spec.summary(node.config)}: ${yes ? "sim" : "não"}.`, branch: yes ? "yes" : "no" };
    }
    case "action.send_email":
    case "action.notify_team": {
      const preview = emailPreview(node.kind, node.config, context, automation.name);
      const recipient = mode === "test" ? runner.email : preview.to;
      if (!validEmail(recipient)) return { status: "failed", detail: preview.to ? `"${preview.to}" não é um e-mail válido.` : "O evento não trouxe um e-mail para enviar." };
      const body = [...preview.paragraphs, ...(preview.url ? [preview.url] : [])].join("\n");
      const sent = await sendAutomationEmail({ to: recipient, subject: preview.subject, body, teamName: context.equipe.nome, automationName: automation.name });
      if (sent === "unconfigured") return { status: "skipped", detail: `"${preview.subject}" para ${recipient} não saiu: o envio de e-mail não está configurado neste ambiente.` };
      if (!sent) return { status: "failed", detail: `O envio de "${preview.subject}" para ${recipient} falhou.` };
      return { status: "done", detail: mode === "test" && recipient !== preview.to ? `"${preview.subject}" enviado para você (${recipient}) no lugar de ${preview.to || "o destinatário"}.` : `"${preview.subject}" enviado para ${recipient}.` };
    }
    case "action.webhook": {
      const url = webhookTarget(String(node.config.url ?? ""));
      if (!url) return { status: "failed", detail: "O endereço do webhook precisa ser HTTPS e público." };
      const method = node.config.method === "PUT" ? "PUT" : "POST";
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT);
      try {
        const response = await fetch(url, {
          method,
          headers: { "content-type": "application/json", "user-agent": "Specular-Automations/1.0" },
          body: JSON.stringify({ automation: { id: automation.id, name: automation.name }, trigger: input.trigger, mode, at: new Date().toISOString(), data: context }),
          signal: controller.signal,
          redirect: "manual",
        });
        return response.ok ? { status: "done", detail: `${method} ${url.host} respondeu ${response.status}.` } : { status: "failed", detail: `${method} ${url.host} respondeu ${response.status}.` };
      } catch (error) {
        return { status: "failed", detail: error instanceof Error && error.name === "AbortError" ? `${url.host} não respondeu em ${WEBHOOK_TIMEOUT / 1000} segundos.` : `Não deu para chamar ${url.host}.` };
      } finally {
        clearTimeout(timer);
      }
    }
    default:
      return { status: "done", detail: spec.summary(node.config) };
  }
}

/** Um passo só, com as tentativas que ele pede: é o que o teste de um nó e a execução inteira usam. */
export async function performStep(automation: Automation, node: AutomationNode, input: RunInput): Promise<StepOutcome> {
  const retries = retriesOf(node.config);
  let outcome = await attempt(automation, node, input);
  let tries = 1;
  while (outcome.status === "failed" && tries <= retries) {
    tries += 1;
    outcome = await attempt(automation, node, input);
  }
  if (tries > 1) outcome = { ...outcome, detail: `${outcome.detail} (${tries} tentativas)` };
  return outcome;
}

/** Anda pelo fluxo a partir do gatilho e devolve a execução com um passo por nó visitado. */
export async function runAutomation(automation: Automation, input: RunInput): Promise<AutomationRun> {
  const steps: RunStep[] = [];
  const finish = (status: RunStatus): AutomationRun => ({ id: crypto.randomUUID().slice(0, 8), at: new Date().toISOString(), mode: input.mode, trigger: input.trigger, status, steps });

  const start = triggerOf(automation.nodes);
  if (!start) {
    steps.push({ nodeId: "", kind: "trigger.manual", label: "Gatilho", status: "failed", detail: "O fluxo não tem um gatilho. Adicione um pela paleta." });
    return finish("failed");
  }

  const byId = new Map(automation.nodes.map((node) => [node.id, node]));
  const queue = [start.id];
  const visited = new Set<string>();
  let status: RunStatus = "ok";

  while (queue.length > 0 && steps.length < MAX_STEPS) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = byId.get(id);
    if (!node) continue;

    const outcome = await performStep(automation, node, input);
    steps.push({ nodeId: id, kind: node.kind, label: nodeTitle(node), status: outcome.status, detail: outcome.detail });

    if (outcome.status === "failed") {
      status = "failed";
      if (!continuesOnFail(node.config)) continue;
    }
    if (outcome.stop) {
      status = "waiting";
      break;
    }
    automation.edges.filter((edge) => edge.from === id && (!outcome.branch || edge.branch === null || edge.branch === outcome.branch)).forEach((edge) => queue.push(edge.to));
  }

  if (steps.length === 1 && automation.nodes.length > 1 && automation.edges.every((edge) => edge.from !== start.id)) {
    steps.push({ nodeId: "", kind: start.kind, label: "Fluxo", status: "skipped", detail: "O gatilho não está ligado a nenhum passo." });
  }

  return finish(status);
}
