"use client";

import { ArrowSquareOutIcon, MapPinIcon } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { PortfolioCard } from "@/features/portfolio/components/portfolio-public";
import { siteConfig } from "@/lib/metadata";
import type { PublicResume } from "../public";
import portfolio from "@/features/portfolio/components/portfolio-public.module.css";
import styles from "./resume-public.module.css";

const external = { target: "_blank", rel: "noreferrer" } as const;

/**
 * O currículo público (2026-09-17): a pessoa em cima, o texto, as habilidades, os links e os projetos
 * públicos das equipes dela, nos mesmos cartões da vitrine. Quem chega não tem conta, e a página não pede.
 */
export function ResumePublic({ name, avatarUrl, headline, bio, location, skills, links, team, projects }: PublicResume) {
  const displayName = name ?? "Profissional";

  return (
    <main className={portfolio.page}>
      <header className={styles.hero}>
        <Avatar name={displayName} src={avatarUrl ?? undefined} size="lg" />
        <div className={styles.copy}>
          <Text as="h1" variant="title1" weight="semibold">
            {displayName}
          </Text>
          {headline && (
            <Text variant="title3" tone="secondary">
              {headline}
            </Text>
          )}
          <div className={styles.line}>
            {location && (
              <Text as="span" variant="callout" tone="secondary" className={styles.location}>
                <MapPinIcon aria-hidden="true" /> {location}
              </Text>
            )}
            {team && (
              <Button variant="outline" size="sm" radius="md" href={`${siteConfig.url}/p/${team.slug}`} {...external}>
                {team.name}
              </Button>
            )}
          </div>
        </div>
      </header>

      {bio && (
        <section className={styles.section} aria-label="Sobre">
          <Text variant="callout" className={styles.bio}>
            {bio}
          </Text>
        </section>
      )}

      {skills.length > 0 && (
        <section className={styles.section} aria-label="Habilidades">
          <Text as="h2" variant="caption1" weight="semibold" tone="secondary" className={styles.label}>
            Habilidades
          </Text>
          <ul className={styles.chips}>
            {skills.map((skill) => (
              <li key={skill}>
                <Badge size="sm">{skill}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      {links.length > 0 && (
        <section className={styles.section} aria-label="Links">
          <div className={styles.links}>
            {links.map((link) => (
              <Button key={link.url} variant="outline" size="sm" radius="md" iconEnd={<ArrowSquareOutIcon />} href={link.url} {...external}>
                {link.label}
              </Button>
            ))}
          </div>
        </section>
      )}

      {projects.length > 0 && (
        <section className={styles.section} aria-label="Projetos">
          <Text as="h2" variant="caption1" weight="semibold" tone="secondary" className={styles.label}>
            Projetos
          </Text>
          <ul className={portfolio.grid}>
            {projects.map((project) => (
              <PortfolioCard key={project.id} project={project} />
            ))}
          </ul>
        </section>
      )}

      <footer className={portfolio.foot}>
        <Text variant="footnote" tone="secondary">
          Currículo publicado com{" "}
          <a href={siteConfig.url} className={portfolio.brand} {...external}>
            {siteConfig.name}
          </a>
        </Text>
      </footer>
    </main>
  );
}
