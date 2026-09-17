import Image from "next/image";
import type { CSSProperties } from "react";
import { cx } from "@/lib/utils/cx";
import { squircle } from "@/lib/corners";
import { projectArtworkUrl } from "../list-options";
import type { Project, ProjectHue } from "../summary";
import styles from "./project-mark.module.css";

export type ProjectMarkSize = "sm" | "md" | "lg";

/** O mínimo que a marca precisa saber. Um `Project` inteiro serve, e um resumo de lista também. */
export type ProjectMarkItem = {
  id: string;
  name: string;
  hue: ProjectHue;
  logoUrl?: string | null;
  /** A logo da empresa do cliente e o rosto dele, nessa ordem de preferência. */
  client?: { logoUrl?: string | null; avatarUrl?: string | null } | null;
};

export type ProjectMarkProps = {
  project: ProjectMarkItem;
  size?: ProjectMarkSize;
  className?: string;
};

const pixelSizes: Record<ProjectMarkSize, number> = { sm: 32, md: 40, lg: 52 };

/**
 * A marca quadrada de um projeto, para toda vez que ele vira uma linha de lista: a ficha do cliente, o
 * painel, uma menção. Antes disso cada um desses lugares desenhava o mesmo glifo de pasta, e todos os
 * projetos ficavam com a mesma cara (2026-09-16, a pedido).
 *
 * A ordem é: **a logo do projeto**, quando ele tem uma; depois a **logo do cliente**, porque projeto de
 * cliente costuma ser conhecido pela marca de quem contratou; depois o **rosto do cliente**; e, sem nada
 * disso, a arte gerada no matiz do projeto, que é a mesma da capa. É por isso que o campo de logo é
 * opcional: na maior parte das contas a marca certa já está no cadastro do cliente.
 *
 * Server Component com CSS Module: é desenho parado.
 */
export function ProjectMark({ project, size = "md", className }: ProjectMarkProps) {
  const side = pixelSizes[size];
  const borrowed = project.logoUrl ?? project.client?.logoUrl ?? project.client?.avatarUrl ?? null;

  return (
    <span
      className={cx(styles.mark, className)}
      data-size={size}
      style={{ "--project-hue": `var(--sys-${project.hue})` } as CSSProperties}
      aria-hidden="true"
      {...squircle(size === "lg" ? "lg" : size === "sm" ? "sm" : "md")}
    >
      {borrowed ? (
        /* A imagem vem de fora e sem domínio para liberar, então vai sem otimizador, como a logo da empresa
           na ficha do cliente. */
        <Image src={borrowed} alt="" width={side} height={side} unoptimized className={styles.photo} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={projectArtworkUrl(project)} alt="" width={side} height={side} loading="lazy" decoding="async" className={styles.art} />
      )}
    </span>
  );
}

/** O que a marca precisa de um projeto inteiro, para quem já tem um em mãos. */
export const markOf = (project: Project): ProjectMarkItem => ({
  id: project.id,
  name: project.name,
  hue: project.hue,
  logoUrl: project.logoUrl,
  client: project.client,
});
