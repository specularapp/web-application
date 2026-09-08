"use client";

import { SparkleIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { aiShare, type AiUsage } from "@/features/ai/summary";
import { navLocation, type NavCrumb } from "../nav";
import styles from "./topbar.module.css";

export type TopbarProps = {
  /** Sobrescreve o nome da página, quando ele não é o que o menu chama. */
  title?: string;
  /** O uso da IA no ciclo; sem ele o widget não aparece. */
  ai?: AiUsage;
};

/** Quantos degraus a régua de uso tem. Dez, para cada um valer um décimo redondo do plano. */
const AI_SEGMENTS = 10;

/** Os degraus acesos. Uso nenhum não acende nada, e qualquer uso acende ao menos um, senão a régua mentiria. */
function litSegments(usage: AiUsage) {
  if (usage.used <= 0) return 0;
  return Math.max(1, Math.round(aiShare(usage) * AI_SEGMENTS));
}

const usageLabel = (usage: AiUsage) => `${usage.used} de ${usage.limit} ações de IA usadas neste ciclo`;

/* Um degrau da trilha. Com matiz, o glifo entra num azulejo cheio daquela cor e o traço sai em branco;
   sem matiz, sai solto e apagado. É o contraste da referência entre a área, que é contexto largo, e a
   pasta, que é onde a página mora de verdade. */
function Crumb({ crumb, muted }: { crumb: NavCrumb; muted: boolean }) {
  const Glyph = crumb.icon;

  return (
    <>
      {crumb.hue ? (
        <span className={styles.tile} style={{ "--crumb-hue": crumb.hue } as CSSProperties} aria-hidden="true">
          <Glyph weight="fill" />
        </span>
      ) : (
        <Glyph aria-hidden="true" className={styles.crumbIcon} />
      )}
      <Text as="span" variant="footnote" weight="medium" tone={muted ? "secondary" : "default"} truncate>
        {crumb.label}
      </Text>
    </>
  );
}

// O topo padrão de toda página da aplicação, menos o painel, que abre com a pessoa e não se enquadra:
// à esquerda o caminho até a página, no meio o nome dela e na ponta direita o quanto da IA já foi usado.
// O caminho e o nome saem de `navLocation`, então página que nasce no menu ganha o topo de graça e não
// há um segundo mapa de rotas para sair de sincronia.
//
// No celular a trilha sai: numa tela estreita ela comeria o nome da página, e quem já está lá dentro
// sabe onde está. Sobram o nome, alinhado à esquerda, e o widget da IA na outra ponta.
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
          {crumbs.map((crumb, index) => (
            <li key={crumb.label} className={styles.crumb}>
              {index > 0 && (
                <span className={styles.separator} aria-hidden="true">
                  /
                </span>
              )}
              <Crumb crumb={crumb} muted={index < crumbs.length - 1} />
            </li>
          ))}
        </ol>
      </nav>

      {/* O nome fica preso no meio da barra por posição absoluta, e não pelo empurra e puxa das pontas:
          com as pontas mandando, uma trilha longa de um lado e um widget curto do outro tiravam o nome
          do centro do container, que é onde ele tem que estar. Como `h1`, porque é o título da página. */}
      <Text as="h1" variant="subheadline" weight="semibold" truncate className={styles.title}>
        {name}
      </Text>

      <div className={styles.end}>
        {ai && (
          <Link href="/ia" className={styles.ai} title={usageLabel(ai)}>
            <SparkleIcon aria-hidden="true" weight="fill" className={styles.aiIcon} />
            {/* A régua de barrinhas diz o quanto do ciclo já foi, sem número na tela: cada degrau é uma
                fatia do plano, os acesos até onde chegou e os apagados até o fim. O número por extenso
                fica na leitura por voz e na dica do ponteiro. */}
            <span className={styles.meter} aria-hidden="true">
              {Array.from({ length: AI_SEGMENTS }, (_, index) => (
                <span key={index} className={styles.bar} data-on={index < litSegments(ai) || undefined} />
              ))}
            </span>
            <VisuallyHidden>{usageLabel(ai)}</VisuallyHidden>
          </Link>
        )}
      </div>
    </header>
  );
}
