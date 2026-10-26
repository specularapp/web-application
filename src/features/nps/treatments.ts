import { HOUR, spanLabel, treatmentIsOpen, treatmentLabels } from "./labels";
import type { NpsMember, NpsResponse, Treatment, TreatmentEventKind, TreatmentStatus } from "./types";

/*
 * As mudanças de uma tratativa, sem tela: cada uma devolve a tratativa nova com o evento na linha do tempo.
 * Hoje rodam só no navegador, sobre os dados de exemplo; quando o domínio existir, viram o serviço do NPS.
 */

const YOU = "Você";

const event = (treatment: Treatment, kind: TreatmentEventKind, text: string, at: string) => ({ id: `${treatment.id}-e${treatment.events.length + 1}`, at, by: YOU, kind, text });

export function openTreatment(response: NpsResponse, at: string, count: number): Treatment {
  const treatment: Treatment = { id: `t-novo-${count}`, responseId: response.id, status: "open", ownerId: null, createdAt: at, dueAt: new Date(Date.parse(at) + 24 * HOUR).toISOString(), firstContactAt: null, closedAt: null, recovered: null, events: [] };
  return { ...treatment, events: [event(treatment, "created", `Tratativa aberta à mão pela nota ${response.score}.`, at)] };
}

export function addTreatmentEvent(treatment: Treatment, kind: "contact" | "note", text: string, at: string): Treatment {
  const firstContact = kind === "contact" && !treatment.firstContactAt;
  return {
    ...treatment,
    status: firstContact && treatment.status === "open" ? "contacted" : treatment.status,
    firstContactAt: firstContact ? at : treatment.firstContactAt,
    events: [...treatment.events, event(treatment, kind, text.trim(), at)],
  };
}

export function setTreatmentStatus(treatment: Treatment, status: TreatmentStatus, at: string, recovered: boolean | null = null): Treatment {
  const closing = !treatmentIsOpen(status);
  const text = status === "resolved" ? (recovered ? "Resolvida: o cliente saiu satisfeito." : "Resolvida: o cliente segue insatisfeito.") : status === "noReply" ? "Encerrada sem retorno do cliente." : `Situação mudou para ${treatmentLabels[status].label.toLowerCase()}.`;
  return {
    ...treatment,
    status,
    closedAt: closing ? at : null,
    recovered: status === "resolved" ? recovered : null,
    events: [...treatment.events, event(treatment, "status", text, at)],
  };
}

export function setTreatmentOwner(treatment: Treatment, owner: NpsMember | null, at: string): Treatment {
  return { ...treatment, ownerId: owner?.id ?? null, events: [...treatment.events, event(treatment, "owner", owner ? `${owner.name} ficou com a tratativa.` : "A tratativa ficou sem responsável.", at)] };
}

/** O prazo do primeiro contato: quanto falta, quanto passou ou em quanto tempo foi feito. */
export function slaOf(treatment: Treatment, now: string): { tone: "neutral" | "info" | "warning" | "danger"; label: string } {
  if (treatment.firstContactAt) return { tone: "neutral", label: `Contato em ${spanLabel((Date.parse(treatment.firstContactAt) - Date.parse(treatment.createdAt)) / HOUR)}` };
  if (!treatmentIsOpen(treatment.status)) return { tone: "neutral", label: "Sem contato" };
  const left = (Date.parse(treatment.dueAt) - Date.parse(now)) / HOUR;
  if (left < 0) return { tone: "danger", label: `Atrasada ${spanLabel(Math.abs(left))}` };
  return { tone: left < 6 ? "warning" : "info", label: `Vence em ${spanLabel(left)}` };
}
