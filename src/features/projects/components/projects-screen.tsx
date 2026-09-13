import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { ProjectsListPage, ProjectsQuery } from "../list-options";
import type { Project, ProjectClient, ProjectOwnerOption } from "../summary";
import type { ProjectEditor } from "./project-form-dialog";
import { ProjectsBoard } from "./projects-board";
import styles from "./projects-screen.module.css";

export type ProjectsScreenProps = {
  page: ProjectsListPage;
  query: ProjectsQuery;
  ai: AiUsage;
  /** O projeto que a URL pede aberto na janela (`/projetos/<id>`); nada para só listar. */
  viewing?: Project | null;
  /** A ficha que a URL pede na gaveta: um projeto para editar (`/projetos/<id>/editar`), `"new"` para criar. */
  editing?: ProjectEditor;
  /** Os clientes e a equipe, para os seletores da ficha. */
  clients: ProjectClient[];
  owners: ProjectOwnerOption[];
};

// A tela de projetos inteira: o topo padrão da aplicação, que sangra de ponta a ponta e traz o `h1`, e abaixo
// a prancha com a busca, a grade de cartões e a paginação, essa sim com o recuo da tela. Server Component, na
// mesma moldura da base de clientes e do catálogo: quem tem estado é a prancha. `/projetos/[id]`,
// `/projetos/novo` e `/projetos/[id]/editar` montam a mesma tela com a janela ou a gaveta já abertas, então a
// ficha tem endereço próprio sem deixar de ser uma camada sobre a lista.
export function ProjectsScreen({ page, query, ai, viewing, editing, clients, owners }: ProjectsScreenProps) {
  return (
    <div className={styles.screen}>
      <Topbar ai={ai} />
      <ProjectsBoard page={page} query={query} viewing={viewing} editing={editing} clients={clients} owners={owners} />
    </div>
  );
}
