import type { Icon } from "@phosphor-icons/react";
import {
  CalendarBlankIcon,
  FlagIcon,
  FolderIcon,
  TagIcon,
  TimerIcon,
  UserCircleIcon,
  UsersIcon,
  WarningIcon,
} from "@phosphor-icons/react/ssr";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { ReactNode } from "react";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { squircle } from "@/lib/corners";
import { dueOf, priorityLabels, priorityTones, statusLabels, statusTones } from "../labels";
import type { Task, TaskPerson } from "../summary";
import { AttachmentCard } from "./attachment-card";
import { Subtasks } from "./subtasks";
import styles from "./task-sheet.module.css";

export type TaskSheetProps = { task: Task };

/* O aviso no raio `md` da casa, recortado no fallback porque não tem borda. */
const cardCorner = squircle("md", { clip: true });

/** Quantos rostos a pílula de envolvidos mostra antes de resumir o resto em "+N", o mesmo do aviso do menu. */
const SHOWN_FACES = 3;

/* Os nomes ligados por "e" para a leitura por voz, como no cartão de tarefa do painel. */
const nameList = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" });

const longDate = (iso: string) => format(parseISO(iso), "EEEE, d 'de' MMM. 'de' yyyy", { locale: ptBR });
const shortStamp = (iso: string) => format(parseISO(iso), "d MMM., HH:mm", { locale: ptBR });

function estimateOf(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function Person({ person }: { person: TaskPerson }) {
  return (
    <span className={styles.person}>
      <Avatar name={person.name} src={person.avatarUrl ?? undefined} size="xs" />
      <Text as="span" variant="subheadline" weight="medium" truncate>
        {person.name}
      </Text>
    </span>
  );
}

/* Quem está envolvido cabe numa pílula só, na receita do aviso do menu lateral: até três bolinhas
   sobrepostas e o resto em "+N". Uma pílula por pessoa, com o nome ao lado, empurrava a ficha para
   várias linhas assim que a tarefa tinha mais de duas pessoas. Os nomes seguem inteiros na leitura por
   voz, porque na pílula só aparecem os rostos. */
function People({ people }: { people: TaskPerson[] }) {
  const faces = people.slice(0, SHOWN_FACES);
  const rest = people.length - faces.length;

  return (
    <>
      <span className={styles.people}>
        <AvatarGroup>
          {faces.map((person) => (
            <Avatar key={person.name} name={person.name} src={person.avatarUrl ?? undefined} size="xs" />
          ))}
        </AvatarGroup>
        {rest > 0 && (
          <Text as="span" variant="caption1" tone="secondary">
            +{rest}
          </Text>
        )}
      </span>
      <VisuallyHidden>{nameList.format(people.map((person) => person.name))}</VisuallyHidden>
    </>
  );
}

function Fact({ icon: Glyph, label, children }: { icon: Icon; label: string; children: ReactNode }) {
  return (
    <div className={styles.fact}>
      <Text as="dt" variant="subheadline" tone="secondary" className={styles.factLabel}>
        <Glyph aria-hidden="true" />
        {label}
      </Text>
      <dd className={styles.factValue}>{children}</dd>
    </div>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <Text as="h3" variant="callout" weight="semibold">
          {title}
        </Text>
        {aside}
      </div>
      {children}
    </section>
  );
}

// A ficha completa da tarefa, na pegada das referências de ficha de consulta e de reunião: em cima o
// projeto e o identificador, o título e as etiquetas de prazo e situação; um aviso quando há algo a ler
// antes de mexer; os fatos em rótulo à esquerda e valor à direita, com as pessoas em chips; e as
// seções de descrição, subtarefas (em `Subtasks`, que marca e desmarca), anexos que abrem na própria tela
// (`AttachmentCard`) e, depois de um fio, a atividade. É Server Component: o cartão do bloco é quem abre, e passa a ficha pronta à janela.
export function TaskSheet({ task }: TaskSheetProps) {
  const due = dueOf(task);

  return (
    <div className={styles.sheet}>
      <header className={styles.head}>
        <div className={styles.topline}>
          {task.project && (
            <Text as="span" variant="footnote" tone="secondary" className={styles.project}>
              <FolderIcon aria-hidden="true" />
              {task.project.name}
            </Text>
          )}
          <Text as="span" variant="footnote" tone="secondary">
            {task.reference}
          </Text>
        </div>
        <Text as="h2" variant="title2" weight="semibold">
          {task.title}
        </Text>
        <div className={styles.badges}>
          <Badge tone={statusTones[task.status]} size="sm">
            {statusLabels[task.status]}
          </Badge>
          <Badge tone={due.tone} size="sm" icon={<CalendarBlankIcon />}>
            {due.label}
          </Badge>
          <Badge tone={priorityTones[task.priority]} size="sm" icon={<FlagIcon />}>
            {priorityLabels[task.priority]}
          </Badge>
        </div>
      </header>

      {task.alert && (
        <div className={styles.alert} role="note" {...cardCorner}>
          <WarningIcon weight="fill" aria-hidden="true" />
          <Text variant="subheadline">{task.alert}</Text>
        </div>
      )}

      <dl className={styles.facts}>
        <Fact icon={UserCircleIcon} label="Responsável">
          <Person person={task.owner} />
        </Fact>
        <Fact icon={UsersIcon} label="Envolvidos">
          <People people={task.people} />
        </Fact>
        <Fact icon={CalendarBlankIcon} label="Prazo">
          <Text as="span" variant="subheadline" weight="medium">
            {longDate(task.dueDate)}
          </Text>
        </Fact>
        {task.startDate && (
          <Fact icon={CalendarBlankIcon} label="Início">
            <Text as="span" variant="subheadline" weight="medium">
              {longDate(task.startDate)}
            </Text>
          </Fact>
        )}
        {task.estimate !== undefined && (
          <Fact icon={TimerIcon} label="Estimativa">
            <Text as="span" variant="subheadline" weight="medium">
              {estimateOf(task.estimate)}
            </Text>
          </Fact>
        )}
        {task.project && (
          <Fact icon={FolderIcon} label="Projeto">
            <span className={styles.chip}>
              <Text as="span" variant="footnote" tone="secondary">
                {task.project.reference}
              </Text>
              <Text as="span" variant="subheadline" weight="medium" truncate>
                {task.project.name}
              </Text>
            </span>
          </Fact>
        )}
        {task.tags.length > 0 && (
          <Fact icon={TagIcon} label="Etiquetas">
            {task.tags.map((tag) => (
              <Badge key={tag} size="md">
                {tag}
              </Badge>
            ))}
          </Fact>
        )}
      </dl>

      <hr className={styles.rule} />

      <Section title="Descrição">
        <Text variant="callout" tone="secondary">
          {task.description}
        </Text>
      </Section>

      {task.subtasks.length > 0 && <Subtasks subtasks={task.subtasks} />}

      {task.attachments.length > 0 && (
        <Section title="Anexos">
          <ul className={styles.list}>
            {task.attachments.map((file) => (
              <li key={file.id}>
                <AttachmentCard file={file} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {task.activity.length > 0 && (
        <>
          <hr className={styles.rule} />
          <Section title="Atividade">
          <ol className={styles.list}>
            {task.activity.map((event) => (
              <li key={event.id} className={styles.event}>
                <Avatar name={event.person.name} src={event.person.avatarUrl ?? undefined} size="xs" />
                <span className={styles.eventCopy}>
                  <Text as="span" variant="subheadline">
                    <Text as="span" variant="subheadline" weight="medium">
                      {event.person.name.split(" ")[0]}
                    </Text>{" "}
                    {event.action}
                  </Text>
                  <Text as="span" variant="footnote" tone="secondary">
                    {shortStamp(event.at)}
                  </Text>
                </span>
              </li>
            ))}
          </ol>
          </Section>
        </>
      )}
    </div>
  );
}
