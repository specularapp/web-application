"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import type { AiUsage } from "@/features/ai/summary";
import type { Project, ProjectClient, ProjectOwnerOption } from "../summary";
import { ProjectEditor } from "./project-editor";
import styles from "./projects-screen.module.css";

export type ProjectEditorScreenProps = {
  /** O projeto que está sendo editado; ausente é um novo. */
  project?: Project;
  clients: ProjectClient[];
  owners: ProjectOwnerOption[];
  ai: AiUsage;
};

/**
 * A tela do editor de projeto: o topo padrão da aplicação, com o nome trocado, e o editor tomando o resto. A
 * mesma moldura do editor de contrato e do de orçamento (2026-09-17, a pedido), no lugar da gaveta sobre a
 * lista. Sair volta à lista; salvar abre a ficha do projeto, que é onde a pessoa confere o que acabou de fazer.
 */
export function ProjectEditorScreen({ project, clients, owners, ai }: ProjectEditorScreenProps) {
  const router = useRouter();

  return (
    <div className={styles.screen}>
      <Topbar title={project ? "Editor de projeto" : "Novo projeto"} ai={ai} />
      <ProjectEditor
        project={project}
        clients={clients}
        owners={owners}
        onLeave={() => router.push("/projetos")}
        onSaved={(id) => router.push(`/projetos/${id}` as Route)}
      />
    </div>
  );
}
