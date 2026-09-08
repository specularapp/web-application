"use client";

import { SparkleIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { aiShare, type AiUsage } from "@/features/ai/summary";
import { navLocation } from "../nav";
import styles from "./topbar.module.css";

export type TopbarProps = {
  /** Sobrescreve o nome da página, quando ele não é o que o menu chama. */
  title?: string;
  /** O uso da IA no ciclo; sem ele o widget não aparece. */
  ai?: AiUsage;
};

const share = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

// O topo padrão de toda página da aplicação, menos o painel, que abre com a pessoa e não se enquadra:
// à esquerda o caminho até a página, no meio o nome dela e na ponta direita o quanto da IA já foi usado.
// O caminho e o nome saem de `navLocation`, então página que nasce no menu ganha o topo de graça e não
// há um segundo mapa de rotas para sair de sincronia.
export function Topbar({ title, ai }: TopbarProps) {
  const pathname = usePathname();
  const location = navLocation(pathname);

  if (!location) return null;

  const { group, folder, page } = location;
  const name = title ?? page.label;
  // O caminho vai até a pasta, e não até a página: o nome dela já está no meio da barra, e repetir ali
  // seria dizer a mesma coisa duas vezes na mesma linha.
  const crumbs = [group, ...(folder ? [folder] : [])];

  return (
    <header className={styles.topbar}>
      {/* Só o caminho, sem menu nem link: ele diz onde a pessoa está, e quem leva a outro lugar é o
          menu lateral. Lista ordenada porque é isso que uma trilha é, e o leitor de tela anuncia a
          ordem dos degraus. */}
      <nav className={styles.route} aria-label="Caminho da página">
        <ol className={styles.crumbs}>
          {crumbs.map(({ label, icon: Glyph }, index) => (
            <li key={label} className={styles.crumb}>
              {index > 0 && (
                <span className={styles.separator} aria-hidden="true">
                  /
                </span>
              )}
              <Glyph aria-hidden="true" className={styles.crumbIcon} />
              <Text as="span" variant="footnote" tone="secondary" truncate>
                {label}
              </Text>
            </li>
          ))}
        </ol>
      </nav>

      {/* O nome fica no centro óptico da barra, e não depois da seção: é o que a pessoa lê primeiro ao
          chegar. Como `h1`, porque é o título da página. */}
      <Text as="h1" variant="subheadline" weight="semibold" truncate className={styles.title}>
        {name}
      </Text>

      <div className={styles.end}>
        {ai && (
          <Link href="/ia" className={styles.ai}>
            <SparkleIcon aria-hidden="true" weight="fill" className={styles.aiIcon} />
            <Text as="span" variant="subheadline" weight="medium" className={styles.aiLabel}>
              IA
            </Text>
            {/* A barrinha diz o quanto foi usado sem ocupar linha: o número por extenso fica na leitura
                por voz e na dica do ponteiro. */}
            <span
              className={styles.aiTrack}
              style={{ "--used": share.format(aiShare(ai)) } as CSSProperties}
              aria-hidden="true"
              title={`${ai.used} de ${ai.limit} ações de IA usadas neste ciclo`}
            />
            <VisuallyHidden>{`${ai.used} de ${ai.limit} ações de IA usadas neste ciclo`}</VisuallyHidden>
          </Link>
        )}
      </div>
    </header>
  );
}
