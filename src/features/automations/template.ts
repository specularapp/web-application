import type { NodeConfig } from "./summary";

/**
 * O que o motor e o editor compartilham sem tocar no servidor: resolver as variáveis do texto, avaliar uma
 * condição e montar a prévia do que um passo faria com os dados do evento. Puro, sem `server-only`, para a
 * janela do passo mostrar no navegador exatamente o que o motor mandaria.
 */

export type RunContext = {
  cliente: { nome: string; primeiro_nome: string; email: string; empresa: string };
  cobranca: { numero: string; valor: string; valor_centavos: number; vencimento: string; situacao: string; link: string };
  contrato: { titulo: string; numero: string; situacao: string; link: string };
  orcamento: { numero: string; valor: string; valor_centavos: number };
  equipe: { nome: string; email: string };
  hoje: string;
};

export function valueAt(context: RunContext, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => (current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined), context);
}

/** Troca cada `{{caminho}}` pelo valor do evento; o que não existe vira vazio, e não o código. */
export function render(text: string, context: RunContext) {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
    const value = valueAt(context, path);
    return value === undefined || value === null ? "" : String(value);
  });
}

const normalize = (value: string) => value.trim().toLocaleLowerCase("pt-BR");

export function evaluate(config: NodeConfig, context: RunContext) {
  const raw = valueAt(context, String(config.field ?? ""));
  const actual = raw === undefined || raw === null ? "" : String(raw);
  const expected = render(String(config.value ?? ""), context);
  switch (config.operator) {
    case "equals":
      return normalize(actual) === normalize(expected);
    case "not_equals":
      return normalize(actual) !== normalize(expected);
    case "contains":
      return normalize(actual).includes(normalize(expected));
    case "gt":
      return Number(actual) > Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "empty":
      return actual.trim() === "";
    case "not_empty":
      return actual.trim() !== "";
    default:
      return false;
  }
}

export const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const isUrlLine = (line: string) => /^https?:\/\/\S+$/i.test(line);

export type EmailPreview = { to: string; subject: string; paragraphs: string[]; url: string | null };

/** O e-mail que um passo mandaria com estes dados: destinatário, assunto e os parágrafos já resolvidos. */
export function emailPreview(kind: "action.send_email" | "action.notify_team", config: NodeConfig, context: RunContext, automationName: string): EmailPreview {
  const team = kind === "action.notify_team" || config.to === "team";
  const to = team ? context.equipe.email : config.to === "custom" ? String(config.email ?? "").trim() : context.cliente.email;
  const subject = kind === "action.notify_team" ? `Aviso da automação ${automationName}` : render(String(config.subject ?? ""), context).trim() || `Mensagem da ${context.equipe.nome}`;
  const body = render(String(kind === "action.notify_team" ? config.message ?? "" : config.body ?? ""), context);
  const lines = body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const url = lines.find(isUrlLine) ?? null;
  return { to, subject, paragraphs: lines.filter((line) => line !== url), url };
}

/** Quantas vezes o passo tenta de novo antes de desistir, das configurações do nó. */
export const retriesOf = (config: NodeConfig) => Math.min(3, Math.max(0, Math.trunc(Number(config.retries) || 0)));

export const continuesOnFail = (config: NodeConfig) => config.continueOnFail === true;
