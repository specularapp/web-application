import { previewTeamSummary } from "@/features/organizations/preview";
import { previewQuotes } from "@/features/quotes/list-preview";
import { quoteTotals } from "@/features/quotes/totals";
import { stageStatus } from "@/features/tasks/labels";
import { previewTasks } from "@/features/tasks/list-preview";
import { findProject } from "./store";
import type { ProjectDetails, ProjectEvent, ProjectMember, ProjectQuote, ProjectTask } from "./summary";

/**
 * A ficha completa de exemplo, montada a partir do store e das prévias de verdade dos outros domínios, e não
 * de listas escritas à mão: as tarefas são as do quadro do projeto (`tarefas/list-preview.ts`, pelo
 * identificador que as duas pontas carregam), os orçamentos são os do cliente do projeto, a equipe é quem tem
 * o projeto na ficha de membro, e a atividade é a das tarefas dele, da mais recente para trás. É o que faz a
 * janela do projeto ser a ligação do projeto com o resto da casa em vez de uma ficha solta. Quem montar as
 * tabelas troca isto por consultas: o formato que sai daqui é o que a janela consome.
 */

/** Quantos registros de atividade a coluna lateral mostra. */
const SHOWN_EVENTS = 8;

export function previewProjectDetails(id: string): ProjectDetails | null {
  const project = findProject(id);
  if (!project) return null;

  const tasks = previewTasks.filter((task) => task.project?.reference === project.reference);

  const listed: ProjectTask[] = tasks.map((task) => ({
    id: task.id,
    reference: task.reference,
    title: task.title,
    stage: task.stage,
    priority: task.priority,
    dueDate: task.dueDate,
    owner: task.owner,
  }));

  /* O orçamento não guarda o id do cliente, só o nome e a empresa: na prévia o vínculo é pelo nome, e no
     banco será pela chave. */
  const quotes: ProjectQuote[] = previewQuotes
    .filter((quote) => quote.client.name === project.client.name)
    .map((quote) => ({
      id: quote.id,
      number: quote.number,
      title: quote.title,
      amount: quoteTotals(quote).total,
      status: quote.status,
      date: quote.issuedAt,
    }));

  /* Quem tem o projeto na própria ficha de membro está nele; quem responde vai sempre primeiro, e entra
     mesmo quando a ficha dele ainda não lista o projeto. */
  const members: ProjectMember[] = previewTeamSummary.members
    .filter((member) => member.projects.some((entry) => entry.reference === project.reference))
    .map((member) => ({ id: member.id, name: member.name, role: member.role, avatarUrl: member.avatarUrl }));
  const owner = members.find((member) => member.name === project.owner.name) ?? {
    id: "owner",
    name: project.owner.name,
    role: "Responsável pelo projeto",
    avatarUrl: project.owner.avatarUrl,
  };
  const people = [owner, ...members.filter((member) => member !== owner)];

  const activity: ProjectEvent[] = tasks
    .flatMap((task) => task.activity.map((event) => ({ id: `${task.id}-${event.id}`, person: event.person, action: event.action, task: task.title, at: event.at })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, SHOWN_EVENTS);

  return {
    ...project,
    people,
    tasks: listed,
    openTasks: tasks.filter((task) => stageStatus(task.stage) !== "done").length,
    totalTasks: tasks.length,
    quotes,
    activity,
  };
}
