import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { Surface } from "@/components/ui/surface";
import { Text } from "@/components/ui/text";
import styles from "./settings.module.css";

export type SettingsPageProps = {
  title: string;
  description?: string;
  /** O que fica na outra ponta do título: um botão, um link, uma etiqueta. */
  aside?: ReactNode;
  children: ReactNode;
};

/**
 * A moldura de toda página de configuração (2026-09-17): o título grande com a linha de apoio, e embaixo as
 * seções em superfície, cada uma com o próprio título. É a mesma moldura que a página de plano e assinatura
 * já tinha, extraída para as outras oito não desenharem cada uma o seu cabeçalho.
 */
export function SettingsPage({ title, description, aside, children }: SettingsPageProps) {
  return (
    <Container>
      <div className={styles.page}>
        <header className={styles.head}>
          <div className={styles.heading}>
            <Text as="h1" variant="title1" weight="semibold">
              {title}
            </Text>
            {description && (
              <Text variant="callout" tone="secondary">
                {description}
              </Text>
            )}
          </div>
          {aside}
        </header>
        {children}
      </div>
    </Container>
  );
}

export type SettingsSectionProps = {
  title: string;
  description?: string;
  /** O que fica na outra ponta do título da seção. */
  aside?: ReactNode;
  /** O nome para leitor de tela, quando o título não basta. */
  label?: string;
  children: ReactNode;
};

export function SettingsSection({ title, description, aside, label, children }: SettingsSectionProps) {
  return (
    <Surface as="section" className={styles.section} aria-label={label ?? title}>
      <div className={styles.sectionHead}>
        <div className={styles.heading}>
          <Text as="h2" variant="title3" weight="semibold">
            {title}
          </Text>
          {description && (
            <Text variant="footnote" tone="secondary">
              {description}
            </Text>
          )}
        </div>
        {aside}
      </div>
      {children}
    </Surface>
  );
}

/** Uma linha rótulo e valor, em duas colunas quando cabe. */
export function SettingsFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.fact}>
      <Text as="dt" variant="footnote" tone="secondary">
        {label}
      </Text>
      <Text as="dd" variant="callout">
        {children}
      </Text>
    </div>
  );
}
