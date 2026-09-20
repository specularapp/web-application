"use client";

import { XIcon } from "@phosphor-icons/react";
import { addDays, format } from "date-fns";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { saveTaskAction } from "../actions";
import { priorityLabels } from "../labels";
import { priorityValues, taskLimits } from "../schemas";
import { taskStageMeta, type TaskStage } from "../stages";
import type { TaskPerson, TaskPriority } from "../summary";
import styles from "./new-task-dialog.module.css";

export type NewTaskDialogProps = {
  open: boolean;
  onClose: () => void;
  /** As etapas deste quadro: são as únicas para onde a tarefa pode nascer. */
  stages: TaskStage[];
  /** A etapa em que ela nasce: a coluna cujo "+" foi tocado, ou a primeira do quadro. */
  stage: TaskStage;
  /** O projeto do quadro; nulo no balde de tarefas soltas. */
  projectId?: string | null;
  /** A equipe, para escolher quem assume já na criação. */
  team?: TaskPerson[];
  /** A tarefa nasceu: o quadro se refaz e abre a ficha dela. */
  onCreated: (id: string) => void;
};

/** Em quantos dias o prazo cai por padrão: uma semana é o que a maioria das tarefas de estúdio pede. */
const DEFAULT_DAYS = 7;

/**
 * Nova tarefa: o formulário curto do que **precisa** existir para uma tarefa ter lugar no quadro, e nada
 * além. Descrição, estimativa, etiquetas, subtarefas e anexos ficam para a ficha, que é onde a tarefa é
 * trabalhada; pedir tudo isso na criação faria a pessoa desistir no meio para anotar uma coisa que ela
 * queria anotar rápido. Quem assume entra, porque é a primeira coisa que se decide ao anotar uma tarefa.
 *
 * O "+" de cada coluna abre daqui já com a etapa dela escolhida, e a barra abre com a primeira do quadro.
 */
export function NewTaskDialog({ open, onClose, stages, stage, projectId = null, team, onCreated }: NewTaskDialogProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);

  return (
    <Dialog open={open} onClose={onClose} label="Nova tarefa" size="sm" surface="glass" scrim={mobile} focusOnOpen={!mobile}>
      <TaskForm stages={stages} stage={stage} projectId={projectId} team={team} onClose={onClose} onCreated={onCreated} />
    </Dialog>
  );
}

const NOBODY = "__nobody__";

function TaskForm({ stages, stage, projectId, team, onClose, onCreated }: Omit<NewTaskDialogProps, "open">) {
  const router = useRouter();
  const { toast } = useToast();
  const titleId = useId();

  const [title, setTitle] = useState("");
  const [chosenStage, setChosenStage] = useState<TaskStage>(stage);
  const [dueDate, setDueDate] = useState<Date>(addDays(new Date(), DEFAULT_DAYS));
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [ownerId, setOwnerId] = useState<string>(NOBODY);
  const [saving, setSaving] = useState(false);

  /* Só quem tem id pode ser escolhido: é o id que a tarefa guarda. */
  const people = (team ?? []).filter((person): person is TaskPerson & { id: string } => Boolean(person.id));
  const [error, setError] = useState<string | null>(null);

  const filled = title.trim().length >= 2;

  const create = async () => {
    if (saving || !filled) return;
    setSaving(true);
    setError(null);

    const result = await saveTaskAction({
      projectId,
      title: title.trim(),
      description: "",
      dueDate: format(dueDate, "yyyy-MM-dd"),
      startDate: "",
      estimate: null,
      stage: chosenStage,
      priority,
      ownerId: ownerId === NOBODY ? null : ownerId,
      tags: [],
      alert: "",
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      toast({ title: "Não deu para criar", description: result.error, tone: "danger" });
      return;
    }

    toast({ title: "Tarefa criada", description: `Ela entrou em ${taskStageMeta[chosenStage].label}.`, tone: "success" });
    setTitle("");
    onCreated(result.id);
    router.refresh();
  };

  useFloatingActionsRegistration({
    primary: { label: saving ? "Criando" : "Criar tarefa", loading: saving, disabled: !filled, onClick: () => void create() },
    cancel: { label: "Cancelar", onClick: onClose },
  });

  return (
    <div className={styles.dialog} aria-labelledby={titleId}>
      <header className={styles.head}>
        <Text as="h2" id={titleId} variant="headline" weight="semibold">
          Nova tarefa
        </Text>
        <IconButton label="Fechar" variant="ghost" size="sm" disabled={saving} onClick={onClose}>
          <XIcon />
        </IconButton>
      </header>

      <div className={styles.body}>
        <Field label="O que precisa ser feito" error={error ?? undefined} required>
          <Input
            type="text"
            value={title}
            maxLength={taskLimits.title}
            placeholder="Fechar a proposta do cliente"
            disabled={saving}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>

        <div className={styles.pair}>
          <Field label="Etapa">
            <Select
              label="Etapa"
              value={chosenStage}
              disabled={saving}
              options={stages.map((id) => ({ value: id, label: taskStageMeta[id].label }))}
              onChange={setChosenStage}
            />
          </Field>

          <Field label="Prazo">
            <DatePicker value={dueDate} disabled={saving} onChange={(date) => date && setDueDate(date)} />
          </Field>
        </div>

        <div className={styles.pair}>
          <Field label="Prioridade">
            <Select
              label="Prioridade"
              value={priority}
              disabled={saving}
              options={priorityValues.map((value) => ({ value, label: priorityLabels[value] }))}
              onChange={setPriority}
            />
          </Field>

          <Field label="Responsável">
            <Select
              label="Responsável"
              value={ownerId}
              disabled={saving}
              searchable={people.length > 6}
              searchPlaceholder="Buscar na equipe"
              options={[
                { value: NOBODY, label: "Sem responsável" },
                ...people.map((person) => ({
                  value: person.id,
                  label: person.name,
                  media: <Avatar name={person.name} src={person.avatarUrl ?? undefined} size="xs" />,
                })),
              ]}
              onChange={setOwnerId}
            />
          </Field>
        </div>
      </div>

      {/* No celular criar e cancelar moram na barra flutuante, acima da bandeja, e o rodapé some. */}
      <footer className={styles.foot}>
        <Button variant="ghost" size="sm" radius="md" disabled={saving} onClick={onClose}>
          Cancelar
        </Button>
        <Button size="sm" radius="md" loading={saving} disabled={!filled} onClick={() => void create()}>
          Criar tarefa
        </Button>
      </footer>
    </div>
  );
}
