"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { BrandIcon } from "@/components/ui/brand-icon";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { AiUsageDialog } from "@/features/ai/components/ai-usage-dialog";
import { aiShare, type AiUsage } from "@/features/ai/summary";
import { navLocation } from "../nav";
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

// O topo padrão de toda página da aplicação, menos o painel, que abre com a pessoa e não se enquadra: à
// esquerda a rota até a página, no meio o nome dela, como `h1`, e na ponta direita o quanto da IA já foi
// usado. Rota e nome saem de `navLocation`, a fonte única das rotas, então página que nasce no menu ganha
// o topo de graça e não há um segundo mapa para sair de sincronia. A página troca o nome por `title`
// quando se chama diferente do menu.
//
// O widget da IA é um botão: abre a janela com o resumo do ciclo e o caminho para comprar mais crédito.
// A janela só monta aberta, então não pesa na carga da página.
export function Topbar({ title, ai }: TopbarProps) {
  const pathname = usePathname();
  const location = navLocation(pathname);
  const name = title ?? location?.page.label;
  const [usageOpen, setUsageOpen] = useState(false);

  if (!name) return null;

  // A rota vai até a pasta, e não até a página: o nome dela já está no meio da barra, e repetir ali era
  // dizer a mesma coisa duas vezes na mesma linha.
  const crumbs = location ? [location.group, ...(location.folder ? [location.folder] : [])] : [];

  return (
    <header className={styles.topbar}>
      {/* Só os nomes separados por barra, sem glifo, sem link e sem menu: a rota diz onde a pessoa está,
          e quem leva a outro lugar é o menu lateral. Lista ordenada porque é isso que uma rota é, e o
          leitor de tela anuncia a ordem dos degraus. */}
      {crumbs.length > 0 && (
        <nav className={styles.route} aria-label="Rota da página">
          <ol className={styles.crumbs}>
            {crumbs.map((crumb, index) => (
              <li key={crumb.label} className={styles.crumb}>
                {index > 0 && (
                  <span className={styles.separator} aria-hidden="true">
                    /
                  </span>
                )}
                <Text as="span" variant="footnote" tone="secondary" truncate>
                  {crumb.label}
                </Text>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* O nome fica preso no meio da barra por posição absoluta, e não pelo empurra e puxa das pontas:
          com as pontas mandando, uma rota longa de um lado e um widget curto do outro tiravam o nome do
          centro do container, que é onde ele tem que estar. */}
      <Text as="h1" variant="headline" weight="semibold" truncate className={styles.title}>
        {name}
      </Text>

      <div className={styles.end}>
        {ai && (
          <>
            <button
              type="button"
              className={styles.ai}
              title={usageLabel(ai)}
              aria-haspopup="dialog"
              aria-expanded={usageOpen}
              onClick={() => setUsageOpen(true)}
            >
              {/* A marca de quem responde, em máscara na tinta do texto, e a régua de barras dizendo o quanto
                  do ciclo já foi, sem número na tela: cada degrau é uma fatia do plano, os acesos até onde
                  chegou e os apagados até o fim. O número por extenso fica na leitura por voz e na dica do
                  ponteiro. Monocromático porque mora na moldura e não é etiqueta de estado. */}
              <BrandIcon name="openai" />
              <span className={styles.meter} aria-hidden="true">
                {Array.from({ length: AI_SEGMENTS }, (_, index) => (
                  <span key={index} className={styles.bar} data-on={index < litSegments(ai) || undefined} />
                ))}
              </span>
              <VisuallyHidden>{usageLabel(ai)}</VisuallyHidden>
            </button>
            <AiUsageDialog usage={ai} open={usageOpen} onClose={() => setUsageOpen(false)} />
          </>
        )}
      </div>
    </header>
  );
}
