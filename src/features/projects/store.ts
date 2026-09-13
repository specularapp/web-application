import "server-only";
import { previewClients } from "@/features/clients/list-preview";
import { previewTeamSummary } from "@/features/organizations/preview";
import { normalizeWebsite } from "@/features/organizations/schemas";
import { formatReference } from "@/lib/utils/reference";
import { slugify } from "@/lib/utils/slug";
import { projectHueFor } from "./list-options";
import { previewProjects } from "./list-preview";
import type { ProjectFormInput } from "./schemas";
import type { Project, ProjectClient, ProjectOwnerOption } from "./summary";

/**
 * Onde os projetos vivem enquanto o domínio não existe no banco (2026-09-13, a pedido de criar e editar
 * funcionando de verdade): uma lista na memória do servidor, semeada pela prévia, que a página lê e a action
 * de salvar escreve. Zera quando o processo reinicia e não é compartilhada entre instâncias, então é só a
 * ponte até a tabela: quando ela nascer, `readProjects` vira a consulta com a RLS e `upsertProject` vira a
 * escrita em `service.ts`, com a assinatura que a página e a action já usam.
 */

let projects: Project[] = [...previewProjects];

export function readProjects(): Project[] {
  return projects;
}

export function findProject(id: string) {
  return projects.find((project) => project.id === id) ?? null;
}

/* As duas bases de onde a ficha puxa vínculos, como o formulário as lista: os clientes da casa, em ordem de
   nome, e a equipe da prévia. Quando as tabelas nascerem, viram as consultas da organização em sessão. */
export function readProjectClients(): ProjectClient[] {
  return previewClients
    .map((client) => ({ id: client.id, name: client.name, company: client.company, avatarUrl: client.avatarUrl }))
    .sort((a, b) => (a.company ?? a.name).localeCompare(b.company ?? b.name, "pt-BR"));
}

export function readProjectOwners(): ProjectOwnerOption[] {
  return previewTeamSummary.members.map((member) => ({ name: member.name, role: member.role, avatarUrl: member.avatarUrl }));
}

/* A sequência seguinte sai do maior identificador que existe: o número é o que a pessoa vê e fala, então não
   pode repetir nem reaproveitar buraco. */
function nextSequence() {
  return projects.reduce((max, project) => Math.max(max, Number(project.reference.split("-").at(-1) ?? 0)), 0) + 1;
}

/* O endereço do quadro de tarefas não repete: dois projetos com o mesmo nome ganham sufixo, como o endereço
   público do time. Na edição o slug fica o que era, para o quadro não mudar de lugar. */
function uniqueSlug(name: string) {
  const base = slugify(name, 60) || "projeto";
  let slug = base;
  let suffix = 2;
  while (projects.some((project) => project.slug === slug)) slug = `${base}-${suffix++}`;
  return slug;
}

/**
 * Cria ou edita, com a entrada já validada pelo zod da action. O cliente e quem responde saem das bases da
 * casa pelo id e pelo nome; identificador, endereço do quadro e matiz nascem uma vez e ficam. Devolve nulo
 * quando o cliente não existe mais, que é o único vínculo que a ficha não pode inventar.
 */
export function upsertProject(input: ProjectFormInput): Project | null {
  const client = previewClients.find((entry) => entry.id === input.clientId);
  if (!client) return null;

  const current = input.id ? findProject(input.id) : null;
  const member = previewTeamSummary.members.find((entry) => entry.name === input.ownerName);
  const sequence = current ? 0 : nextSequence();
  const budget =
    input.budgetMin === null && input.budgetMax === null
      ? null
      : { min: input.budgetMin ?? input.budgetMax ?? 0, max: input.budgetMax ?? input.budgetMin ?? 0 };

  const project: Project = {
    id: current?.id ?? `p${sequence}`,
    slug: current?.slug ?? uniqueSlug(input.name),
    reference: current?.reference ?? formatReference("project", new Date().getFullYear(), sequence),
    name: input.name,
    url: normalizeWebsite(input.url),
    description: input.description,
    isPublic: input.isPublic,
    client: { id: client.id, name: client.name, company: client.company, avatarUrl: client.avatarUrl },
    owner: { name: input.ownerName, avatarUrl: member?.avatarUrl ?? null },
    status: input.status,
    tags: input.tags,
    tools: input.tools,
    budget,
    startedAt: input.startedAt,
    dueAt: input.dueAt || null,
    progress: input.progress,
    /* O formulário manda a capa inteira: a que estava, a nova embutida ou vazio para tirar. */
    coverUrl: input.coverUrl || null,
    hue: current?.hue ?? projectHueFor(input.name),
  };

  projects = current ? projects.map((entry) => (entry.id === project.id ? project : entry)) : [project, ...projects];
  return project;
}
