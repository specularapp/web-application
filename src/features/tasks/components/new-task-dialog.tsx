"use client";

import { CalendarBlankIcon, KanbanIcon, NotePencilIcon, UsersThreeIcon, XIcon, type Icon } from "@phosphor-icons/react";
import { addDays, format, isBefore, startOfDay } from "date-fns";
import { useId, useState, type ReactNode } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog } from "@/components/ui/dialog";
import { DurationPicker } from "@/components/ui/duration-picker";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { TagPicker } from "@/components/ui/tag-picker";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { saveTaskAction } from "../actions";
import { DAY_MINUTES, estimateLabel, priorityLabels } from "../labels";
import { MAX_TAGS, priorityValues, taskLimits } from "../schemas";
import { taskStageMeta, type TaskStage } from "../stages";
import { taskTagCatalog } from "../tags";
import type { TaskPerson, TaskPriority } from "../summary";
import styles from "./new-task-dialog.module.css";

/** Um projeto que pode receber a tarefa, do jeito que o seletor o desenha. */
export type NewTaskProject = { id: string; name: string; imageUrl?: string | null };

export type NewTaskDialogProps = {
  open: boolean;
  onClose: () => void;
  /** As etapas deste quadro: são as únicas para onde a tarefa pode nascer. */
  stages: TaskStage[];
  /** A etapa em que ela nasce: a coluna cujo "+" foi tocado, ou a primeira do quadro. */
  stage: TaskStage;
  /** O projeto do quadro; nulo no balde de tarefas soltas. */
  projectId?: string | null;
  /**
   * Os projetos que podem receber a tarefa. Só vale no quadro de todas, em que não há projeto no endereço:
   * na página de um projeto o destino já está decidido e um seletor ali só ofereceria sair do lugar.
   */
  projects?: NewTaskProject[];
  /** A equipe, para escolher quem assume já na criação. */
  team?: TaskPerson[];
  /** A tarefa nasceu: o quadro se refaz e abre a ficha dela. */
  onCreated: (id: string) => void;
};

/** Em quantos dias o prazo cai por padrão: uma semana é o que a maioria das tarefas de estúdio pede. */
const DEFAULT_DAYS = 7;

const NOBODY = "__nobody__";
const LOOSE = "__loose__";

const priorityOptions = priorityValues.map((value) => ({ value, label: priorityLabels[value] }));

/**
 * Nova tarefa: a janela de criação no desenho de bloco da casa, a mesma da ficha de projeto e da gaveta de
 * cliente (2026-09-20, a pedido: "a abertura precisa ser mais organizada de acordo com as estruturas que
 * trabalhamos"). Antes eram seis campos soltos numa coluna, sem hierarquia nenhuma, e a janela lia como
 * rascunho ao lado do resto do produto.
 *
 * São quatro blocos separados por fio, cada um com glifo e título: **a tarefa** (o que é e os detalhes),
 * **onde ela entra** (projeto, etapa e prioridade), **prazo e esforço** (começo, entrega e estimativa) e
 * **quem e o quê** (responsável e etiquetas). A ordem é a da conversa: primeiro o que precisa ser feito,
 * depois onde isso mora, depois quando, e por último com quem.
 *
 * Continua sendo criação, e não a ficha: subtarefa, anexo, comentário e vínculo ficam para lá, que é onde a
 * tarefa é trabalhada. O que entrou aqui é o que a pessoa já sabe no instante em que anota.
 *
 * O "+" de cada coluna abre daqui já com a etapa dela escolhida, e a barra abre com a primeira do quadro.
 */
export function NewTaskDialog({ open, onClose, stages, stage, projectId = null, projects, team, onCreated }: NewTaskDialogProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);

  return (
    <Dialog open={open} onClose={onClose} label="Nova tarefa" size="md" surface="glass" scrim={mobile} focusOnOpen={!mobile}>
      <TaskForm stages={stages} stage={stage} projectId={projectId} projects={projects} team={team} onClose={onClose} onCreated={onCreated} />
    </Dialog>
  );
}

/* Um bloco da janela: o glifo e o título numa linha, e os campos embaixo. É a mesma peça da ficha de
   projeto, e quem separa um bloco do outro é o fio, de ponta a ponta. */
function Section({ icon: Glyph, title, children }: { icon: Icon; title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.heading}>
        <Glyph aria-hidden="true" />
        <Text as="h3" id={id} variant="subheadline" weight="semibold">
          {title}
        </Text>
      </div>
      {children}
    </section>
  );
}

function TaskForm({ stages, stage, projectId, projects, team, onClose, onCreated }: Omit<NewTaskDialogProps, "open">) {
  const { toast } = useToast();
  const titleId = useId();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [chosenProject, setChosenProject] = useState<string>(projectId ?? LOOSE);
  const [chosenStage, setChosenStage] = useState<TaskStage>(stage);
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [dueDate, setDueDate] = useState<Date>(addDays(new Date(), DEFAULT_DAYS));
  const [estimate, setEstimate] = useState(0);
  const [ownerId, setOwnerId] = useState<string>(NOBODY);
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);

  /* Só quem tem id pode ser escolhido: é o id que a tarefa guarda. */
  const people = (team ?? []).filter((person): person is TaskPerson & { id: string } => Boolean(person.id));

  /* O seletor de projeto só aparece onde há escolha: na página de um projeto o destino já está decidido. */
  const choosable = projectId === null ? (projects ?? []) : [];

  /* O prazo antes do começo é o único engano que a janela pega sozinha, porque a pessoa vê os dois campos
     lado a lado: o servidor recusa de novo, mas deixar o pedido sair para voltar com erro seria ida à toa. */
  const backwards = Boolean(startDate && isBefore(startOfDay(dueDate), startOfDay(startDate)));
  const filled = title.trim().length >= 2 && !backwards;

  const create = async () => {
    if (saving || !filled) return;
    setSaving(true);
    setError(null);

    const result = await saveTaskAction({
      projectId: chosenProject === LOOSE ? null : chosenProject,
      title: title.trim(),
      description: description.trim(),
      dueDate: format(dueDate, "yyyy-MM-dd"),
      startDate: startDate ? format(startDate, "yyyy-MM-dd") : "",
      estimate: estimate > 0 ? estimate : null,
      stage: chosenStage,
      priority,
      ownerId: ownerId === NOBODY ? null : ownerId,
      tags,
      alert: "",
    });

    setSaving(false);

    if (!result.ok) {
      setError({ field: result.field, message: result.error });
      toast({ title: "Não deu para criar", description: result.error, tone: "danger" });
      return;
    }

    toast({ title: "Tarefa criada", description: `Ela entrou em ${taskStageMeta[chosenStage].label}.`, tone: "success" });
    onCreated(result.id);
  };

  useFloatingActionsRegistration({
    primary: { label: saving ? "Criando" : "Criar tarefa", loading: saving, disabled: !filled, onClick: () => void create() },
    cancel: { label: "Cancelar", onClick: onClose },
  });

  const errorOf = (field: string) => (error?.field === field ? error.message : undefined);

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
        <Section icon={NotePencilIcon} title="A tarefa">
          <Field label="O que precisa ser feito" error={errorOf("title")} required>
            <Input
              type="text"
              value={title}
              maxLength={taskLimits.title}
              placeholder="Fechar a proposta do cliente"
              disabled={saving}
              invalid={Boolean(errorOf("title"))}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>

          <Field label="Detalhes" hint="O que quem for fazer precisa saber antes de começar" error={errorOf("description")}>
            <Textarea
              value={description}
              rows={3}
              maxLength={taskLimits.description}
              placeholder="Contexto, o que já foi combinado, onde estão os arquivos"
              disabled={saving}
              invalid={Boolean(errorOf("description"))}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
        </Section>

        <Separator className={styles.divider} />

        <Section icon={KanbanIcon} title="Onde ela entra">
          {choosable.length > 0 && (
            <Field label="Projeto" hint="Sem projeto, ela fica no balde das tarefas soltas" error={errorOf("projectId")}>
              <Select
                label="Projeto"
                value={chosenProject}
                disabled={saving}
                searchable={choosable.length > 6}
                searchPlaceholder="Buscar projeto"
                options={[
                  { value: LOOSE, label: "Sem projeto" },
                  ...choosable.map((project) => ({
                    value: project.id,
                    label: project.name,
                    media: <Avatar name={project.name} src={project.imageUrl ?? undefined} size="xs" shape="squircle" />,
                  })),
                ]}
                onChange={setChosenProject}
              />
            </Field>
          )}

          <div className={styles.pair}>
            <Field label="Etapa" error={errorOf("stage")}>
              <Select
                label="Etapa"
                value={chosenStage}
                disabled={saving}
                options={stages.map((id) => ({ value: id, label: taskStageMeta[id].label }))}
                onChange={setChosenStage}
              />
            </Field>

            <Field label="Prioridade" error={errorOf("priority")}>
              <Select label="Prioridade" value={priority} disabled={saving} options={priorityOptions} onChange={setPriority} />
            </Field>
          </div>
        </Section>

        <Separator className={styles.divider} />

        <Section icon={CalendarBlankIcon} title="Prazo e esforço">
          <div className={styles.pair}>
            <Field label="Começo" hint="Em branco é começar quando der">
              <DatePicker value={startDate} disabled={saving} placeholder="Sem data" onChange={setStartDate} />
            </Field>

            <Field label="Prazo" error={errorOf("dueDate") ?? (backwards ? "O prazo não pode vir antes do começo" : undefined)} required>
              <DatePicker value={dueDate} disabled={saving} invalid={backwards} onChange={(date) => date && setDueDate(date)} />
            </Field>
          </div>

          {/* A roleta de dias, horas e minutos da casa, a mesma da ficha: o dia aqui é o dia do calendário,
              como lá, para a mesma estimativa ler igual nos dois lugares. Zero é "sem estimativa". */}
          <Field label="Estimativa de esforço" hint="Em branco é sem estimativa" error={errorOf("estimate")}>
            <DurationPicker
              label="Estimativa de esforço"
              value={estimate}
              hoursPerDay={DAY_MINUTES / 60}
              maxDays={60}
              disabled={saving}
              display={estimateLabel}
              placeholder="Sem estimativa"
              onChange={setEstimate}
            />
          </Field>
        </Section>

        <Separator className={styles.divider} />

        <Section icon={UsersThreeIcon} title="Quem e o quê">
          <Field label="Responsável" hint="Quem assume agora; os demais envolvidos entram pela ficha" error={errorOf("ownerId")}>
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

          <Field label="Etiquetas" hint={`Até ${MAX_TAGS}, da gama da casa`} error={errorOf("tags")}>
            <TagPicker catalog={taskTagCatalog} label="Etiquetas da tarefa" value={tags} max={MAX_TAGS} disabled={saving} onChange={setTags} />
          </Field>
        </Section>

        {error && !error.field && (
          <Text variant="footnote" tone="danger" role="alert" className={styles.alert}>
            {error.message}
          </Text>
        )}
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
