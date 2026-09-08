"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { BrandIcon } from "@/components/ui/brand-icon";
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

/** Os três degraus da trilha, do contexto largo ao lugar exato: a área, a pasta e a própria página. */
type CrumbLevel = "group" | "folder" | "page";

/* Um degrau da trilha, na receita da referência. A área leva o glifo solto e apagado; a pasta leva o
   glifo num azulejo cheio no matiz dela, com o traço em branco; a página vai sem glifo e na tinta cheia,
   porque é o mais perto de onde a pessoa está e é o `h1` da tela. */
function Crumb({ crumb, level }: { crumb: NavCrumb; level: CrumbLevel }) {
  const Glyph = crumb.icon;

  return (
    <>
      {level === "group" && <Glyph aria-hidden="true" className={styles.crumbIcon} />}
      {level === "folder" && (
        <span className={styles.tile} style={{ "--crumb-hue": crumb.hue } as CSSProperties} aria-hidden="true">
          <Glyph weight="fill" />
        </span>
      )}
      <Text
        as={level === "page" ? "h1" : "span"}
        variant="footnote"
        weight={level === "page" ? "semibold" : "medium"}
        tone="inherit"
        truncate
        className={styles.label}
      >
        {crumb.label}
      </Text>
    </>
  );
}

// O topo padrão de toda página da aplicação, menos o painel, que abre com a pessoa e não se enquadra:
// à esquerda a trilha até a página, com o nome dela no último degrau, e na ponta direita o quanto da IA
// já foi usado. A trilha sai de `navLocation`, então página que nasce no menu ganha o topo de graça e
// não há um segundo mapa de rotas para sair de sincronia.
//
// No celular só o degrau da página fica: numa tela estreita a trilha inteira comeria o nome, e quem já
// está lá dentro sabe onde está.
export function Topbar({ title, ai }: TopbarProps) {
  const pathname = usePathname();
  const location = navLocation(pathname);

  if (!location) return null;

  const { group, folder, page } = location;
  const crumbs: { crumb: NavCrumb; level: CrumbLevel }[] = [
    { crumb: group, level: "group" },
    ...(folder ? [{ crumb: folder, level: "folder" as const }] : []),
    { crumb: { label: title ?? page.label, icon: page.icon }, level: "page" },
  ];

  return (
    <header className={styles.topbar}>
      {/* Só a trilha, sem menu nem link: ela diz onde a pessoa está, e quem leva a outro lugar é o menu
          lateral. Lista ordenada porque é isso que uma trilha é, e o leitor de tela anuncia a ordem dos
          degraus. O último é o `h1`, então a regra de um título por página se resolve aqui. */}
      <nav className={styles.route} aria-label="Caminho da página">
        <ol className={styles.crumbs}>
          {crumbs.map(({ crumb, level }, index) => (
            <li key={crumb.label} className={styles.crumb} data-level={level}>
              {index > 0 && (
                <span className={styles.separator} aria-hidden="true">
                  /
                </span>
              )}
              <Crumb crumb={crumb} level={level} />
            </li>
          ))}
        </ol>
      </nav>

      <div className={styles.end}>
        {ai && (
          <Link href="/ia" className={styles.ai} title={usageLabel(ai)}>
            {/* A marca de quem responde, em máscara na tinta do texto: monocromática como a régua,
                porque o widget mora na moldura e não é etiqueta de estado. */}
            <BrandIcon name="openai" className={styles.aiIcon} />
            {/* A régua de barras diz o quanto do ciclo já foi, sem número na tela: cada degrau é uma
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
