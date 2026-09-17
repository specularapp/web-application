import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listTeamMembers } from "@/features/organizations/service";
import type { Database } from "@/types/database";

/**
 * O histórico de um registro: quem mexeu, o quê e quando. Uma leitura e uma escrita para todos os domínios,
 * porque a pergunta é a mesma em toda ficha, e a linha "Histórico" já existe no leque do cliente, do item de
 * catálogo, do projeto e da automação.
 *
 * Quem grava é a função `log_record_event` do banco, dentro da mesma operação que mudou o registro: histórico
 * que a tela pode escrever é histórico que a tela pode inventar.
 */
export type HistoryClient = SupabaseClient<Database>;

export type HistoryKind = Database["public"]["Enums"]["record_kind"];
export type HistoryAction = Database["public"]["Enums"]["history_action"];

/** Uma mudança campo a campo, como a ficha a mostra: o nome que a pessoa lê, o de e o para. */
export type HistoryChange = { field: string; label: string; from: string | null; to: string | null };

export type HistoryEntry = {
  id: string;
  action: HistoryAction;
  /** O que aconteceu, em uma linha: "Mudou o telefone e a cidade". */
  summary: string;
  changes: HistoryChange[];
  actor: { name: string; avatarUrl: string | null } | null;
  /** ISO com hora. */
  at: string;
};

/** Quantas entradas a janela carrega: o bastante para rolar sem paginar numa ficha comum. */
const LIMIT = 100;

export async function listHistory(
  client: HistoryClient,
  organizationId: string,
  recordType: HistoryKind,
  recordId: string,
): Promise<HistoryEntry[]> {
  const [{ data }, members] = await Promise.all([
    client
      .from("record_history")
      .select("id, action, summary, changes, actor_id, at")
      .eq("organization_id", organizationId)
      .eq("record_type", recordType)
      .eq("record_id", recordId)
      .order("at", { ascending: false })
      .limit(LIMIT),
    listTeamMembers(client, organizationId),
  ]);

  const people = new Map(members.map((member) => [member.userId, member]));

  return (data ?? []).map((row) => {
    const person = row.actor_id ? people.get(row.actor_id) : null;

    return {
      id: row.id,
      action: row.action,
      summary: row.summary,
      changes: (row.changes as HistoryChange[]) ?? [],
      actor: person ? { name: person.name || person.email || "Equipe", avatarUrl: person.avatarUrl } : null,
      at: row.at,
    };
  });
}

/**
 * Registra o que mudou. Falhar aqui **não** derruba a operação que a chamou: o cadastro já foi salvo, e
 * perder a linha do histórico é menos grave que desfazer o que a pessoa acabou de fazer.
 */
export async function logRecordEvent(
  client: HistoryClient,
  organizationId: string,
  input: { recordType: HistoryKind; recordId: string; action: HistoryAction; summary: string; changes?: HistoryChange[] },
) {
  const { error } = await client.rpc("log_record_event", {
    p_organization_id: organizationId,
    p_record_type: input.recordType,
    p_record_id: input.recordId,
    p_action: input.action,
    p_summary: input.summary,
    p_changes: input.changes ?? [],
  });

  if (error) console.error("histórico não gravado:", error.message);
}

/**
 * O que mudou entre o que estava e o que foi salvo, campo a campo, com o nome que a pessoa lê. Fica aqui,
 * e não em cada serviço, porque todo domínio precisa da mesma comparação: lista vira texto separado por
 * vírgula, vazio vira nulo, e campo que não mudou não entra.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T | null,
  after: T,
  labels: Partial<Record<keyof T & string, string>>,
): HistoryChange[] {
  const changes: HistoryChange[] = [];

  for (const [field, label] of Object.entries(labels) as [keyof T & string, string][]) {
    const from = asText(before?.[field]);
    const to = asText(after[field]);
    if (from === to) continue;
    changes.push({ field, label, from, to });
  }

  return changes;
}

function asText(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : null;
  if (typeof value === "boolean") return value ? "sim" : "não";
  return String(value);
}

/** A frase do resumo a partir do que mudou: até três nomes de campo, e o resto vira contagem. */
export function summarize(changes: HistoryChange[]) {
  if (changes.length === 0) return "Salvou sem mudar nada";

  const names = changes.slice(0, 3).map((change) => change.label.toLowerCase());
  const rest = changes.length - names.length;
  const list = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" });

  return `Mudou ${list.format(rest > 0 ? [...names, `mais ${rest}`] : names)}`;
}
