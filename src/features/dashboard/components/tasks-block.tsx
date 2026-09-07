import { CaretRightIcon } from "@phosphor-icons/react/ssr";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useId } from "react";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DetailsTrigger } from "@/components/ui/details-dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { TaskSheet } from "@/features/tasks/components/task-sheet";
import { dueOf, statusLabels, statusTones } from "@/features/tasks/labels";
import type { Task, TasksSummary } from "@/features/tasks/summary";
import { squircle } from "@/lib/corners";
import { cx } from "@/lib/utils/cx";
import list from "./block-list.module.css";
import styles from "./tasks-block.module.css";

export type TasksBlockProps = { summary: TasksSummary };

const SHOWN_TASKS = 5;
const SHOWN_PEOPLE = 3;

const names = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" });

/* Cartão de tarefa no raio `md` da casa, recortado no fallback porque não tem borda. */
const cardCorner = squircle("md", { clip: true });

// O cartão é o gatilho da janela de detalhes, com o mesmo `li` e a mesma classe de sempre; a seta da
// ponta também abre. A janela é a ficha completa da tarefa.
function Row({ task }: { task: Task }) {
  const due = dueOf(task);
  const shown = task.people.slice(0, SHOWN_PEOPLE);

  return (
    <DetailsTrigger
      dialog={<TaskSheet task={task} />}
      dialogLabel={`Tarefa ${task.title}`}
      dialogSize="lg"
      label={`Ver detalhes de ${task.title}`}
      className={styles.task}
      {...cardCorner}
    >
      <div className={styles.head}>
        <span className={styles.naming}>
          <Text as="p" variant="headline" truncate>
            {task.title}
          </Text>
          <Badge tone={due.tone} size="sm">
            {due.label}
          </Badge>
          <Badge tone={statusTones[task.status]} size="sm">
            {statusLabels[task.status]}
          </Badge>
        </span>
        <IconButton label={`Abrir ${task.title}`} variant="ghost" size="sm" data-open-details>
          <CaretRightIcon weight="bold" />
        </IconButton>
      </div>

      <Text variant="footnote" tone="secondary" className={styles.description}>
        {task.description}
      </Text>

      {shown.length > 0 && (
        <div className={styles.people}>
          <AvatarGroup>
            {shown.map((person) => (
              <Avatar key={person.name} name={person.name} src={person.avatarUrl ?? undefined} size="xs" />
            ))}
          </AvatarGroup>
          <Text as="p" variant="footnote" tone="secondary" truncate>
            Com{" "}
            <Text as="span" variant="footnote" weight="medium" tone="default">
              {names.format(task.people.map((person) => person.name.split(" ")[0] ?? person.name))}
            </Text>
          </Text>
        </div>
      )}
    </DetailsTrigger>
  );
}

// Uma linha de abertura com o nome da lista e a data de hoje nas pontas, e as tarefas mais próximas do
// vencimento, cada uma num cartão: título com as etiquetas de prazo e de
// situação e o chevron na ponta, a descrição, e embaixo quem está envolvido, em bolinhas e por nome. O
// chevron ainda não abre nada: a tela de tarefas existe só como rota vazia, para o atalho do cabeçalho.
export function TasksBlock({ summary }: TasksBlockProps) {
  const headingId = useId();
  const today = format(new Date(), "d MMM. yyyy", { locale: ptBR });

  if (summary.tasks.length === 0) {
    return (
      <Text variant="footnote" tone="secondary">
        Nenhuma tarefa por aqui
      </Text>
    );
  }

  return (
    <div className={styles.block}>
      <div className={styles.intro}>
        <Text as="h3" id={headingId} variant="caption1" weight="medium" tone="secondary">
          Tarefas pendentes
        </Text>
        <Text as="p" variant="caption1" tone="secondary" numeric>
          {today}
        </Text>
      </div>
      <ul className={cx(list.list, styles.cards)} aria-labelledby={headingId}>
        {summary.tasks.slice(0, SHOWN_TASKS).map((task) => (
          <Row key={task.id} task={task} />
        ))}
      </ul>
    </div>
  );
}
