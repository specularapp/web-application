"use client";

import { ArrowLeftIcon, CheckIcon, EyeIcon, PencilSimpleIcon } from "@phosphor-icons/react";
import { format } from "date-fns";
import { useCallback, useId, useRef, useState } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { siteUrl } from "@/lib/utils/site";
import { budgetLabel, dueOf, projectStatuses, shortDate } from "../labels";
import type { Project, ProjectClient, ProjectOwnerOption } from "../summary";
import { ProjectCard } from "./project-card";
import { ProjectForm, type ProjectPreviewSnapshot } from "./project-form-dialog";
import styles from "./project-editor.module.css";

export type ProjectEditorProps = {
  /** O projeto que está sendo editado; ausente é um novo. */
  project?: Project;
  clients: ProjectClient[];
  owners: ProjectOwnerOption[];
  /** Sair sem salvar: volta para a lista. */
  onLeave: () => void;
  /** Salvo, com o id: quem monta leva à ficha do projeto. */
  onSaved: (id: string) => void;
};

/** Qual metade está à vista no celular, onde as duas não cabem lado a lado. */
type EditorTab = "form" | "preview";

/**
 * O editor de projeto em tela inteira, com a prévia ao lado (2026-09-17, a pedido, na mesma moldura do editor
 * de contrato e do de orçamento): à esquerda a ficha, que é o mesmo formulário da gaveta de antes, agora sem
 * cabeçalho nem rodapé próprios; à direita o cartão do projeto **como ele vai aparecer na lista**, redesenhado
 * a cada tecla, e embaixo os fatos que a ficha dele mostra. A barra de cima tem o voltar, o nome, o
 * identificador e as duas ações.
 *
 * A prévia é o próprio `ProjectCard`, e não um segundo desenho: o que a pessoa vê aqui é o que a grade vai
 * mostrar, e um desenho paralelo divergiria no primeiro acerto do cartão. Ele entra inerte, porque o leque e o
 * botão do endereço são de verdade e não têm o que fazer numa prévia.
 *
 * No celular a tela vira duas abas, dados e prévia, como no editor de orçamento; salvar e sair moram na barra
 * flutuante da casa, registrada pelo próprio formulário.
 */
export function ProjectEditor({ project, clients, owners, onLeave, onSaved }: ProjectEditorProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const titleId = useId();
  const form = useRef<HTMLFormElement>(null);
  const [tab, setTab] = useState<EditorTab>("form");
  const [snapshot, setSnapshot] = useState<ProjectPreviewSnapshot | null>(null);
  const onPreview = useCallback((next: ProjectPreviewSnapshot) => setSnapshot(next), []);

  const editing = Boolean(project);
  const showForm = !mobile || tab === "form";
  const showPreview = !mobile || tab === "preview";

  /* No celular, com a prévia à vista, a barra flutuante troca as ações do formulário pelas da prévia: voltar
     aos dados e sair. O formulário registra as dele só enquanto está à vista, porque só então está montado. */
  useFloatingActionsRegistration(
    mobile && tab === "preview" ? { primary: { label: "Voltar aos dados", onClick: () => setTab("form") }, cancel: { label: "Sair", onClick: onLeave } } : null,
  );

  const preview = snapshot ? projectOf(snapshot, project, owners) : project ?? null;

  return (
    <div className={styles.editor}>
      <header className={styles.head}>
        <IconButton label="Voltar para projetos" variant="ghost" size="sm" onClick={onLeave}>
          <ArrowLeftIcon />
        </IconButton>
        <div className={styles.heading}>
          <Text as="h2" id={titleId} variant="headline" weight="semibold" truncate>
            {editing ? project?.name : snapshot?.values.name.trim() || "Novo projeto"}
          </Text>
          {project && (
            <Badge tone="neutral" variant="soft" size="sm">
              {project.reference}
            </Badge>
          )}
        </div>

        {mobile ? (
          <div className={styles.tabs} role="tablist" aria-label="Dados ou prévia">
            <button type="button" role="tab" aria-selected={tab === "form"} className={styles.tab} onClick={() => setTab("form")}>
              <PencilSimpleIcon aria-hidden="true" />
              Dados
            </button>
            <button type="button" role="tab" aria-selected={tab === "preview"} className={styles.tab} onClick={() => setTab("preview")}>
              <EyeIcon aria-hidden="true" />
              Prévia
            </button>
          </div>
        ) : (
          <div className={styles.actions}>
            <Button variant="outline" size="sm" radius="md" onClick={onLeave}>
              Cancelar
            </Button>
            <Button size="sm" radius="md" iconStart={<CheckIcon />} onClick={() => form.current?.requestSubmit()}>
              {editing ? "Salvar" : "Criar projeto"}
            </Button>
          </div>
        )}
      </header>

      <div className={styles.body} data-form={showForm || undefined} data-preview={showPreview || undefined}>
        {showForm && (
          <div className={styles.form}>
            <ProjectForm
              project={project}
              clients={clients}
              owners={owners}
              frame="screen"
              formRef={form}
              onPreview={onPreview}
              onClose={onLeave}
              onSaved={onSaved}
            />
          </div>
        )}

        {showPreview && (
          <aside className={styles.preview} aria-label="Prévia do projeto">
            <Text as="h3" variant="caption1" weight="semibold" tone="secondary" className={styles.previewTitle}>
              Como aparece na lista
            </Text>

            {preview ? (
              <>
                {/* Inerte: o leque e o botão do endereço são de verdade, e não têm o que fazer numa prévia. */}
                <ul className={styles.cardFrame} inert>
                  <ProjectCard project={preview} onOpen={() => undefined} onEdit={() => undefined} />
                </ul>

                <dl className={styles.facts}>
                  <Fact label="Situação" value={projectStatuses[preview.status].label} />
                  <Fact label="Cliente" value={preview.client ? preview.client.company ?? preview.client.name : "Sem cliente"} />
                  <Fact label="Responsável" value={preview.owner.name} />
                  <Fact label="Começo" value={shortDate(preview.startedAt)} />
                  <Fact label="Entrega" value={preview.dueAt ? dueOf(preview).label : "Sem prazo"} />
                  <Fact label="Valor" value={preview.budget ? budgetLabel(preview.budget) : "A combinar"} />
                  <Fact label="Andamento" value={`${preview.progress}%`} />
                  <Fact label="Portfólio" value={preview.isPublic ? "Público" : "Só a equipe"} />
                </dl>
              </>
            ) : (
              <Text variant="footnote" tone="secondary">
                Preencha a ficha e o cartão aparece aqui.
              </Text>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.fact}>
      <Text as="dt" variant="caption1" tone="secondary">
        {label}
      </Text>
      <Text as="dd" variant="footnote" weight="medium" truncate>
        {value}
      </Text>
    </div>
  );
}

/**
 * O projeto como a prévia o desenha, a partir do que a ficha tem agora: os valores crus viram os tipos do
 * modelo, o cliente e quem responde vêm das listas dos seletores, e o que ainda não existe (id, referência,
 * slug) entra com marcador. É a mesma conversão do salvamento, só que no navegador e sem gravar.
 */
function projectOf(snapshot: ProjectPreviewSnapshot, base: Project | undefined, owners: ProjectOwnerOption[]): Project {
  const { values } = snapshot;
  const owner = owners.find((entry) => entry.id === values.ownerId);
  const min = values.budgetMin === "" ? null : Number(values.budgetMin);
  const max = values.budgetMax === "" ? null : Number(values.budgetMax);

  return {
    id: base?.id ?? "novo",
    slug: base?.slug ?? "novo",
    reference: base?.reference ?? "PRJ-NOVO",
    name: values.name.trim() || "Novo projeto",
    url: values.url ? siteUrl(values.url) : null,
    description: values.description,
    isPublic: values.isPublic,
    logoUrl: snapshot.logo,
    client: snapshot.client,
    ownerId: values.ownerId || null,
    owner: owner ? { name: owner.name, avatarUrl: owner.avatarUrl } : base?.owner ?? { name: "Sem responsável", avatarUrl: null },
    memberIds: values.memberIds,
    status: values.status,
    tags: values.tags,
    tools: values.tools,
    budget: min === null && max === null ? null : { min: min ?? max ?? 0, max: max ?? min ?? 0 },
    startedAt: values.startedAt || format(new Date(), "yyyy-MM-dd"),
    dueAt: values.dueAt || null,
    progress: Number(values.progress || 0),
    coverUrl: snapshot.cover,
    hue: snapshot.hue,
  };
}
