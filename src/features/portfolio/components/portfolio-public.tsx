"use client";

import { ArrowSquareOutIcon, GlobeSimpleIcon } from "@phosphor-icons/react";
import Image from "next/image";
import type { CSSProperties } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { industryLabels } from "@/features/onboarding/labels";
import type { OrganizationIndustry } from "@/features/organizations/schemas";
import { ToolTile } from "@/features/projects/components/tool-tile";
import { projectArtworkUrl } from "@/features/projects/list-options";
import { siteConfig } from "@/lib/metadata";
import { squircle } from "@/lib/corners";
import type { Portfolio, PortfolioProject } from "../service";
import styles from "./portfolio-public.module.css";

/** Quantas marcas o cartão mostra antes de resumir o resto em "+N". */
const SHOWN_TOOLS = 5;

const external = { target: "_blank", rel: "noreferrer" } as const;

/**
 * A vitrine pública (2026-09-17): quem a equipe é no topo, e os projetos públicos em cartões. O cartão é a
 * versão de rua do cartão da lista de projetos: a mesma capa, o mesmo nome e descrição, as mesmas etiquetas
 * e ferramentas, sem o que é da equipe (cliente, valor, prazo, situação, leque). Quem chega por aqui não tem
 * conta, e a página não pede nenhuma.
 */
export function PortfolioPublic({ team, projects }: Portfolio) {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        {team.bannerUrl && (
          <div className={styles.banner} {...squircle("xl", { clip: true })}>
            <Image src={team.bannerUrl} alt="" fill sizes="(min-width: 64rem) 64rem, 100vw" unoptimized className={styles.bannerImage} priority />
          </div>
        )}
        <div className={styles.identity}>
          <Avatar name={team.name} src={team.logoUrl ?? undefined} size="lg" shape="squircle" />
          <div className={styles.copy}>
            <Text as="h1" variant="title1" weight="semibold">
              {team.name}
            </Text>
            <div className={styles.line}>
              {team.industry && (
                <Text as="span" variant="callout" tone="secondary">
                  {industryLabels[team.industry as OrganizationIndustry] ?? team.industry}
                </Text>
              )}
              {team.website && (
                <Button variant="outline" size="sm" radius="md" iconStart={<GlobeSimpleIcon />} href={team.website} {...external}>
                  {team.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {projects.length === 0 ? (
        <Text variant="callout" tone="secondary" align="center" className={styles.empty}>
          Os projetos desta equipe ainda não foram publicados.
        </Text>
      ) : (
        <ul className={styles.grid} aria-label={`Projetos de ${team.name}`}>
          {projects.map((project) => (
            <PortfolioCard key={project.id} project={project} />
          ))}
        </ul>
      )}

      <footer className={styles.foot}>
        <Text variant="footnote" tone="secondary">
          Portfólio publicado com{" "}
          <a href={siteConfig.url} className={styles.brand} {...external}>
            {siteConfig.name}
          </a>
        </Text>
      </footer>
    </main>
  );
}

/** Um projeto na vitrine: a capa, o nome e o endereço, a descrição, as etiquetas e as ferramentas. */
export function PortfolioCard({ project }: { project: PortfolioProject }) {
  const hue = { "--project-hue": `var(--sys-${project.hue})` } as CSSProperties;
  const shownTools = project.tools.slice(0, SHOWN_TOOLS);
  const restTools = project.tools.length - shownTools.length;

  return (
    <li className={styles.card} {...squircle("xl", { clip: true })}>
      <div className={styles.cover} style={hue} {...squircle("md", { clip: true })}>
        {project.coverUrl ? (
          <Image src={project.coverUrl} alt="" fill sizes="(min-width: 48rem) 22rem, 100vw" unoptimized className={styles.photo} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- a arte gerada é um SVG servido pela casa, que o next/image não otimiza
          <img src={projectArtworkUrl({ id: project.id, hue: project.hue })} alt="" width={96} height={96} loading="lazy" decoding="async" className={styles.art} />
        )}
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardTitle}>
          <Text as="h2" variant="headline" weight="semibold">
            {project.name}
          </Text>
          {project.url && (
            <Button variant="ghost" size="sm" radius="md" iconStart={<ArrowSquareOutIcon />} href={project.url} {...external}>
              Ver
            </Button>
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

      {project.tools.length > 0 && (
        <div className={styles.tools} aria-label="Ferramentas">
          {shownTools.map((tool) => (
            <ToolTile key={tool} tool={tool} />
          ))}
          {restTools > 0 && (
            <Text as="span" variant="caption1" tone="secondary">
              +{restTools}
            </Text>
          )}
        </div>
      )}
    </li>
  );
}
