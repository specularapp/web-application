import type { Icon } from "@phosphor-icons/react";
import { CaretRightIcon } from "@phosphor-icons/react/ssr";
import type { Route } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { squircle } from "@/lib/corners";
import { Avatar, type AvatarProps } from "../avatar";
import { Progress } from "../progress";
import { Text } from "../text";
import styles from "./profile.module.css";

export type ProfileStat = { label: string; value: string };

export type ProfileProps = {
  /** Nome do matiz da paleta do sistema que pinta a capa, o mesmo do rosto gerado (`avatarHue`). */
  hue: string;
  avatar: Pick<AvatarProps, "name" | "src" | "seed">;
  title: string;
  /** Etiquetas ao lado do nome. */
  badges?: ReactNode;
  /** O menu de opções, na outra ponta da linha do nome. */
  menu?: ReactNode;
  /** A linha apagada sob o nome, como o e-mail. */
  handle?: string;
  /** O que a pessoa faz, em uma linha. */
  subtitle?: string;
  stats: ProfileStat[];
  /** Os botões de contato, lado a lado. */
  actions?: ReactNode;
  children: ReactNode;
};

/* Linhas e chips no raio `md` e `sm` da casa, recortados no fallback porque não têm borda. */
const rowCorner = squircle("md", { clip: true });
const chipCorner = squircle("sm", { clip: true });

// O cartão de perfil da casa, para pessoa de fora ou de dentro: a capa no matiz da pessoa, a foto grande
// passando por cima da borda da capa, o nome com etiquetas e menu, a linha apagada e o que ela faz; os
// números da relação em linha; os botões de contato; e as seções que quem chama montar com as peças
// abaixo. Sem diretiva de cliente: é estático, e serve tanto ao servidor quanto a quem já é cliente.
export function Profile({ hue, avatar, title, badges, menu, handle, subtitle, stats, actions, children }: ProfileProps) {
  const vars = { "--cover-hue": `var(--sys-${hue})` } as CSSProperties;

  return (
    <div className={styles.profile} style={vars}>
      <div className={styles.cover} aria-hidden="true" />

      <header className={styles.head}>
        <Avatar {...avatar} size="lg" shape="squircle" className={styles.photo} />
        <div className={styles.identity}>
          <div className={styles.naming}>
            <Text as="h2" variant="title2" weight="semibold" truncate>
              {title}
            </Text>
            {badges && <span className={styles.badges}>{badges}</span>}
          </div>
          {menu}
        </div>
        {handle && (
          <Text variant="footnote" tone="secondary" truncate>
            {handle}
          </Text>
        )}
        {subtitle && (
          <Text variant="subheadline" weight="medium">
            {subtitle}
          </Text>
        )}
      </header>

      <dl className={styles.stats}>
        {stats.map((stat) => (
          <div key={stat.label} className={styles.stat}>
            <Text as="dd" variant="title3" weight="semibold">
              {stat.value}
            </Text>
            <Text as="dt" variant="footnote" tone="secondary">
              {stat.label}
            </Text>
          </div>
        ))}
      </dl>

      {actions && <div className={styles.actions}>{actions}</div>}

      <div className={styles.body}>{children}</div>
    </div>
  );
}

export function ProfileSection({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <Text as="h3" variant="callout" weight="semibold">
          {title}
        </Text>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Um fio que separa uma seção do resto. */
export function ProfileRule() {
  return <hr className={styles.rule} />;
}

export function ProfileFacts({ children }: { children: ReactNode }) {
  return <dl className={styles.facts}>{children}</dl>;
}

/* Um fato: rótulo com ícone à esquerda e valor à direita. */
export function ProfileFact({ icon: Glyph, label, children }: { icon: Icon; label: string; children: ReactNode }) {
  return (
    <div className={styles.fact}>
      <Text as="dt" variant="subheadline" tone="secondary" className={styles.factLabel}>
        <Glyph aria-hidden="true" />
        {label}
      </Text>
      <dd className={styles.factValue}>{children}</dd>
    </div>
  );
}

export function ProfileTags({ children }: { children: ReactNode }) {
  return <div className={styles.tags}>{children}</div>;
}

export function ProfileList({ children }: { children: ReactNode }) {
  return <ul className={styles.list}>{children}</ul>;
}

export type ProfileRowProps = {
  href: Route;
  icon: Icon;
  title: string;
  /** A segunda linha: uma legenda ou a barra de progresso. */
  caption?: ReactNode;
  /** O que fica na ponta: valor, etiqueta. */
  end?: ReactNode;
};

/* Uma linha que leva à tela de algo: ícone num chip, título e legenda, o que for na ponta e o chevron. */
export function ProfileRow({ href, icon: Glyph, title, caption, end }: ProfileRowProps) {
  return (
    <li>
      <Link href={href} className={styles.row} {...rowCorner}>
        <span className={styles.rowIcon} aria-hidden="true" {...chipCorner}>
          <Glyph weight="duotone" />
        </span>
        <span className={styles.rowCopy}>
          <Text as="span" variant="subheadline" weight="medium" truncate>
            {title}
          </Text>
          {typeof caption === "string" ? (
            <Text as="span" variant="footnote" tone="secondary" truncate>
              {caption}
            </Text>
          ) : (
            caption
          )}
        </span>
        {end && <span className={styles.rowEnd}>{end}</span>}
        <CaretRightIcon className={styles.chevron} weight="bold" aria-hidden="true" />
      </Link>
    </li>
  );
}

/* A barra de progresso curta com a porcentagem ao lado, para a legenda de uma linha. */
export function ProfileProgress({ value, done = false }: { value: number; done?: boolean }) {
  return (
    <span className={styles.progressLine}>
      <Progress value={value} size="xs" segments={20} tone={done ? "success" : "accent"} className={styles.progress} />
      <Text as="span" variant="footnote" tone="secondary">
        {value}%
      </Text>
    </span>
  );
}
