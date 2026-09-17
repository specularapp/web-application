"use client";

import { CalendarBlankIcon, FolderSimpleIcon, GlobeSimpleIcon } from "@phosphor-icons/react";
import Image from "next/image";
import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { Tooltip } from "@/components/ui/tooltip";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { squircle, squircleAuto } from "@/lib/corners";
import { dueOf, projectStatuses, projectTools, shortDate, siteLabel } from "../labels";
import { projectArtworkUrl } from "../list-options";
import type { Project } from "../summary";
import { ProjectMenu } from "./project-menu";
import { ToolTile } from "./tool-tile";
import styles from "./project-card.module.css";

export type ProjectCardProps = {
  project: Project;
  /** Abre a janela do projeto. */
  onOpen: () => void;
  /** Abre a ficha para editar. */
  onEdit: () => void;
  /** Pede a exclusão; quem confirma é a janela da casa, com a pergunta e o aviso. */
  onDelete?: () => void;
};

/* Quantas marcas a fila mostra antes de resumir o resto em "+N". */
const SHOWN_TOOLS = 5;

/* Controles com ação própria dentro do cartão: clique que nasce neles não abre a janela. */
const INTERACTIVE = "button, a, input, label, [role='button'], [role='menuitem']";

/* Links que saem da aplicação abrem em outra aba. */
const external = { target: "_blank", rel: "noreferrer" };

const nameList = new Intl.ListFormat("pt-BR", { type: "conjunction" });

// O cartão do projeto (2026-09-13, sobre uma referência de cartão de projeto do usuário, adaptada aos padrões
// da casa): em cima quem contratou, com o rosto, a empresa e quando começou, a situação em etiqueta e o leque
// na ponta; a capa larga, que é a imagem anexada pela pessoa e, enquanto não há, a arte gerada no matiz do
// projeto; o nome do projeto, que é o nome do site ou de para quem foi feito, com o botão do endereço na
// outra ponta da mesma linha, e a descrição de até cem caracteres embaixo, em duas linhas; as etiquetas em
// contorno; e o pé na receita do cartão de tarefas: as ferramentas na fila agrupada de um lado, até cinco
// azulejos na cor da marca e o resto em "+N" que lista as demais ao apontar (o azulejo da interrogação quando
// ninguém informou nenhuma), e a entrega na etiqueta do prazo do outro. O cartão inteiro abre a janela do
// projeto; o leque e o botão do endereço têm ação própria e não abrem nada. O fio da caixa é o do `Card`, em
// duas camadas recortadas pelo sistema de cantos.
export function ProjectCard({ project, onOpen, onEdit, onDelete }: ProjectCardProps) {
  const status = projectStatuses[project.status];
  const due = dueOf(project);
  const hue = { "--project-hue": `var(--sys-${project.hue})` } as CSSProperties;
  const shownTools = project.tools.slice(0, SHOWN_TOOLS);
  const restTools = project.tools.slice(SHOWN_TOOLS);

  const onClick = (event: MouseEvent<HTMLElement>) => {
    const control = (event.target as HTMLElement).closest(INTERACTIVE);
    if (control && control !== event.currentTarget) return;
    onOpen();
  };

  // Só o teclado abre por tecla, e só quando o foco está no próprio cartão: dentro dele o Enter é do leque.
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <li className={styles.card} data-status={project.status} {...squircle("xl", { clip: true })}>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={`Abrir ${project.name}, ${project.reference}`}
        className={styles.inner}
        onClick={onClick}
        onKeyDown={onKeyDown}
        {...squircleAuto({ clip: true })}
      >
        <header className={styles.head}>
          {/* Sem cliente, o projeto é independente e o lugar do rosto fica com o glifo do que ele é: estudo,
              projeto próprio, protótipo. O bloco não some, senão a linha do cartão dançaria de um para outro. */}
          {project.client ? (
            <Avatar name={project.client.name} src={project.client.avatarUrl ?? undefined} size="sm" shape="squircle" />
          ) : (
            <span className={styles.own} aria-hidden="true" {...squircle("sm")}>
              <FolderSimpleIcon />
            </span>
          )}
          <span className={styles.who}>
            <Text as="span" variant="footnote" weight="semibold" truncate>
              {project.client ? (project.client.company ?? project.client.name) : "Projeto independente"}
            </Text>
            <Text as="span" variant="caption1" tone="secondary" truncate>
              {shortDate(project.startedAt)}
            </Text>
          </span>
          <span className={styles.end}>
            <Badge tone={status.tone} size="sm">
              {status.label}
            </Badge>
            <ProjectMenu project={project} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} />
          </span>
        </header>

        {/* A capa é a imagem que a pessoa anexa, no canto `md` pelo sistema de cantos; sem ela, a arte
            gerada no estilo Waves, preenchendo a capa sobre o véu do matiz do projeto. `<img>` cru para o
            SVG, como no avatar. */}
        <div className={styles.cover} style={hue} {...squircle("md", { clip: true })}>
          {project.coverUrl ? (
            <Image src={project.coverUrl} alt="" fill sizes="(min-width: 48rem) 22rem, 100vw" unoptimized className={styles.photo} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={projectArtworkUrl(project)} alt="" width={96} height={96} loading="lazy" decoding="async" className={styles.art} />
          )}
        </div>

        {/* O nome do projeto e, na outra ponta da mesma linha, o botão do endereço, que abre o site em outra
            aba (a pedido, 2026-09-13; a linha de texto com o domínio durou uma rodada). Embaixo, a descrição,
            em até duas linhas. */}
        <div className={styles.copy}>
          <div className={styles.body}>
            <Text as="h2" variant="headline" weight="semibold" className={styles.title}>
              {project.name}
            </Text>
            {project.url && (
              <IconButton label={`Abrir ${siteLabel(project.url)}`} variant="ghost" size="sm" href={project.url} className={styles.site} {...external}>
                <GlobeSimpleIcon />
              </IconButton>
            )}
          </div>
          {project.description && (
            <Text variant="footnote" tone="secondary" className={styles.description}>
              {project.description}
            </Text>
          )}
        </div>

        {project.tags.length > 0 && (
          <ul className={styles.tags} aria-label="Etiquetas">
            {project.tags.map((tag) => (
              <li key={tag}>
                <Badge variant="outline" size="sm">
                  {tag}
                </Badge>
              </li>
            ))}
          </ul>
        )}

        {/* O pé: as ferramentas de um lado, na fila agrupada da casa, e a entrega do outro, na etiqueta do prazo
            das tarefas. As marcas passam de vinte em projeto grande, então a fila mostra cinco e resume o resto
            em "+N", com os nomes das demais ao apontar; sem nenhuma informada fica um azulejo só, o da
            interrogação, para a fila nunca ficar vazia. Os nomes inteiros seguem na leitura por voz. */}
        <div className={styles.foot}>
          <span className={styles.tools}>
            <span className={styles.stack} aria-hidden="true">
              {shownTools.length === 0 ? <ToolTile tool={null} /> : shownTools.map((tool) => <ToolTile key={tool} tool={tool} />)}
            </span>
            {restTools.length > 0 && (
              <Tooltip content={nameList.format(restTools.map((tool) => projectTools[tool]))}>
                <button type="button" className={styles.more} aria-label={`Mais ${restTools.length} ferramentas`}>
                  +{restTools.length}
                </button>
              </Tooltip>
            )}
            <VisuallyHidden>
              {project.tools.length === 0 ? "Ferramentas não informadas" : `Ferramentas: ${nameList.format(project.tools.map((tool) => projectTools[tool]))}`}
            </VisuallyHidden>
          </span>
          <Badge tone={due.tone} size="sm" icon={<CalendarBlankIcon />}>
            {due.label}
          </Badge>
        </div>
      </div>
    </li>
  );
}
