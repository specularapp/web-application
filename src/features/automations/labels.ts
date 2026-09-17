import type { Icon } from "@phosphor-icons/react";
import { CheckCircleIcon, FileDashedIcon, HourglassMediumIcon, LightningIcon, PauseCircleIcon, WarningCircleIcon } from "@phosphor-icons/react/ssr";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { BadgeTone } from "@/components/ui/badge";
import type { AutomationStatus, RunStatus, RunStepStatus } from "./summary";

/* As situações da automação: ativa roda sozinha, pausada guarda o fluxo sem rodar, rascunho ainda não tem o
   que rodar. Os mesmos glifos e tons no cartão, no filtro e no editor. */
export const automationStatuses: Record<AutomationStatus, { label: string; tone: BadgeTone; icon: Icon }> = {
  active: { label: "Ativa", tone: "success", icon: LightningIcon },
  paused: { label: "Pausada", tone: "warning", icon: PauseCircleIcon },
  draft: { label: "Rascunho", tone: "neutral", icon: FileDashedIcon },
};

export const runStatuses: Record<RunStatus, { label: string; tone: BadgeTone; icon: Icon }> = {
  ok: { label: "Concluída", tone: "success", icon: CheckCircleIcon },
  failed: { label: "Falhou", tone: "danger", icon: WarningCircleIcon },
  waiting: { label: "Em espera", tone: "warning", icon: HourglassMediumIcon },
};

export const stepStatuses: Record<RunStepStatus, { label: string; tone: BadgeTone }> = {
  done: { label: "Feito", tone: "success" },
  skipped: { label: "Pulado", tone: "neutral" },
  failed: { label: "Falhou", tone: "danger" },
  waiting: { label: "Esperando", tone: "warning" },
};

/** "há 2 dias", "há 3 horas": a distância até agora, para o cartão dizer quando rodou. */
export const agoLabel = (iso: string) => `há ${formatDistanceToNowStrict(parseISO(iso), { locale: ptBR })}`;

/** "15 set., 08:12": o momento exato, para a lista de execuções. */
export const momentLabel = (iso: string) => format(parseISO(iso), "d MMM., HH:mm", { locale: ptBR });

export const runsLabel = (count: number) => (count === 0 ? "Nunca rodou" : count === 1 ? "1 execução" : `${count} execuções`);
