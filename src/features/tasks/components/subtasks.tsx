"use client";

import { CalendarBlankIcon, CalendarPlusIcon, FlagIcon, PlusIcon, UserCirclePlusIcon, XIcon } from "@phosphor-icons/react";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useState, type CSSProperties } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { priorityHues, priorityLabels, priorityTones } from "../labels";
import type { Subtask, TaskPerson, TaskPriority } from "../summary";
import { SubtaskDialog } from "./task-add-dialogs";
import styles from "./task-sheet.module.css";

export type SubtasksProps = {
  subtasks: Subtask[];
  /** Quem pode assumir uma subtarefa; vazio deixa o atribuir de responsável de fora. */
  team?: TaskPerson[];
};

/* Os prazos que o menu oferece, em dias a partir de hoje: cobrem o que se escolhe de verdade numa
   subtarefa, sem abrir um calendário inteiro para uma linha de lista. */
const deadlineChoices: { id: string; label: string; days: number | null }[] = [
  { id: "today", label: "Hoje", days: 0 },
  { id: "tomorrow", label: "Amanhã", days: 1 },
  { id: "week", label: "Em 7 dias", days: 7 },
  { id: "month", label: "Em 30 dias", days: 30 },
  { id: "none", label: "Sem prazo", days: null },
];

const priorities: TaskPriority[] = ["low", "normal", "high", "urgent"];

const shortDate = (iso: string) => format(parseISO(iso), "d MMM.", { locale: ptBR });
const isoDay = (days: number) => format(addDays(new Date(), days), "yyyy-MM-dd");

/* A bandeira no matiz da prioridade, para o menu dizer qual é qual pela cor e não só pelo nome. */
const priorityMark = (priority: TaskPriority) => <FlagIcon weight="bold" style={{ color: priorityHues[priority] } as CSSProperties} />;

// As subtarefas com a caixa da casa para marcar e desmarcar, e cada uma com **três atribuições separadas na
// ponta da linha** (2026-09-10, a pedido): quem assume, o prazo e a prioridade, cada uma no próprio menu.
// Vazia, a atribuição é só o glifo apagado, que é o convite para atribuir; preenchida, ela é o valor — o
// rosto, a data em etiqueta, a prioridade em etiqueta. É a mesma regra da ficha da tarefa: o valor continua
// sendo o valor, e é o clique nele que abre as opções.
//
// Um menu só com três seções durou uma rodada e saiu: escondia atrás de um chevron três coisas que a pessoa
// precisa ver atribuídas ou não de relance. Quem escolhe pessoa vê o rosto e o nome; o prazo é uma lista de
// escolhas ("Hoje", "Amanhã", "Em 7 dias") em vez de um calendário, porque numa linha de lista é o que se
// escolhe de verdade.
//
// Acrescentar mora no cabeçalho, só em glifo, e abre a janela da casa com título, responsável, prioridade e
// prazo. O estado é da janela enquanto o domínio não existe no banco; quem ligar a tabela troca o `useState`
// por uma Server Action com os mesmos `patch` e `add`.
export function Subtasks({ subtasks, team = [] }: SubtasksProps) {
  const [items, setItems] = useState(subtasks);
  const [adding, setAdding] = useState(false);

  const done = items.filter((item) => item.done).length;

  const patch = (id: string, change: Partial<Subtask>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)));

  const ownerSections = (item: Subtask): DropdownSection[] => [
    {
      id: "owner",
      label: "Quem assume",
      items: [
        ...team.map((person) => ({
          id: `owner-${person.name}`,
          label: person.name,
          media: <Avatar name={person.name} src={person.avatarUrl ?? undefined} size="xs" />,
          selected: item.person?.name === person.name,
          onSelect: () => patch(item.id, { person }),
        })),
        ...(item.person ? [{ id: "owner-none", label: "Sem responsável", icon: XIcon, onSelect: () => patch(item.id, { person: undefined }) }] : []),
      ],
    },
  ];

  const deadlineSections = (item: Subtask): DropdownSection[] => [
    {
      id: "deadline",
      label: "Prazo",
      items: deadlineChoices.map((choice) => ({
        id: `deadline-${choice.id}`,
        label: choice.label,
        icon: choice.days === null ? XIcon : CalendarBlankIcon,
        selected: choice.days === null ? !item.dueDate : item.dueDate === isoDay(choice.days),
        onSelect: () => patch(item.id, { dueDate: choice.days === null ? undefined : isoDay(choice.days) }),
      })),
    },
  ];

  const prioritySections = (item: Subtask): DropdownSection[] => [
    {
      id: "priority",
      label: "Prioridade",
      items: [
        ...priorities.map((priority) => ({
          id: `priority-${priority}`,
          label: priorityLabels[priority],
          media: priorityMark(priority),
          selected: item.priority === priority,
          onSelect: () => patch(item.id, { priority }),
        })),
        ...(item.priority ? [{ id: "priority-none", label: "Sem prioridade", icon: XIcon, onSelect: () => patch(item.id, { priority: undefined }) }] : []),
      ],
    },
  ];

  return (
    <section className={styles.block}>
      <div className={styles.blockInner}>
        <div className={styles.blockHead}>
          <span className={styles.blockTitle}>
            <Text as="h3" variant="callout" weight="semibold">
              Subtarefas
            </Text>
            {items.length > 0 && (
              <span className={styles.count}>
                <Text as="span" variant="footnote" tone="secondary">
                  {done} de {items.length}
                </Text>
                <Progress value={done} max={items.length} segments={items.length} size="xs" tone="success" className={styles.progress} />
              </span>
            )}
          </span>
          <IconButton label="Adicionar subtarefa" variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <PlusIcon />
          </IconButton>
        </div>

        {items.length === 0 ? (
          <div className={styles.blockEmpty}>
            <Text variant="footnote" tone="tertiary">
              Nenhuma subtarefa. Quebre o trabalho em passos.
            </Text>
          </div>
        ) : (
          <ul className={styles.list}>
            {items.map((item) => (
              <li key={item.id} className={styles.subtask} data-done={item.done || undefined}>
                <Checkbox checked={item.done} onChange={() => patch(item.id, { done: !item.done })} className={styles.check}>
                  {item.title}
                </Checkbox>

                {/* As três atribuições, sempre na mesma ordem: prioridade, prazo e quem assume. Cada uma é o
                    glifo apagado enquanto está vazia e o valor depois de atribuída. */}
                <span className={styles.assigns}>
                  <DropdownMenu
                    label={`Prioridade de ${item.title}`}
                    triggerLabel={item.priority ? `Prioridade: ${priorityLabels[item.priority]}. Trocar` : `Atribuir prioridade a ${item.title}`}
                    sections={prioritySections(item)}
                    triggerContent={
                      item.priority ? (
                        <Badge tone={priorityTones[item.priority]} size="sm" icon={<FlagIcon />}>
                          {priorityLabels[item.priority]}
                        </Badge>
                      ) : (
                        <FlagIcon aria-hidden="true" className={styles.assign} />
                      )
                    }
                  />

                  <DropdownMenu
                    label={`Prazo de ${item.title}`}
                    triggerLabel={item.dueDate ? `Prazo: ${shortDate(item.dueDate)}. Trocar` : `Atribuir prazo a ${item.title}`}
                    sections={deadlineSections(item)}
                    triggerContent={
                      item.dueDate ? (
                        <Badge size="sm" icon={<CalendarBlankIcon />}>
                          {shortDate(item.dueDate)}
                        </Badge>
                      ) : (
                        <CalendarPlusIcon aria-hidden="true" className={styles.assign} />
                      )
                    }
                  />

                  {team.length > 0 && (
                    <DropdownMenu
                      label={`Responsável por ${item.title}`}
                      triggerLabel={item.person ? `Responsável: ${item.person.name}. Trocar` : `Atribuir responsável a ${item.title}`}
                      sections={ownerSections(item)}
                      triggerContent={
                        item.person ? (
                          <Avatar name={item.person.name} src={item.person.avatarUrl ?? undefined} size="xs" />
                        ) : (
                          <UserCirclePlusIcon aria-hidden="true" className={styles.assign} />
                        )
                      }
                    />
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <SubtaskDialog
        open={adding}
        onClose={() => setAdding(false)}
        team={team}
        onAdd={(subtask) => setItems((current) => [...current, { ...subtask, id: `local-${current.length + 1}` }])}
      />
    </section>
  );
}
