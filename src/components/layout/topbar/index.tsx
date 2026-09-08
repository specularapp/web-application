"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandIcon } from "@/components/ui/brand-icon";
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

/** Quantos degraus a régua de uso tem. Dez, para cada um valer um décimo redondo do plano. */
const AI_SEGMENTS = 10;

/** Os degraus acesos. Uso nenhum não acende nada, e qualquer uso acende ao menos um, senão a régua mentiria. */
function litSegments(usage: AiUsage) {
  if (usage.used <= 0) return 0;
  return Math.max(1, Math.round(aiShare(usage) * AI_SEGMENTS));
}

const usageLabel = (usage: AiUsage) => `${usage.used} de ${usage.limit} ações de IA usadas neste ciclo`;

// O topo padrão de toda página da aplicação, menos o painel, que abre com a pessoa e não se enquadra: o
// nome da página à esquerda, como `h1`, e na ponta direita o quanto da IA já foi usado. Nada mais: o
// menu lateral já diz onde a página mora, e repetir o caminho aqui era ruído. O nome sai de
// `navLocation`, a fonte única das rotas, e a página troca por `title` quando se chama diferente.
export function Topbar({ title, ai }: TopbarProps) {
  const pathname = usePathname();
  const location = navLocation(pathname);
  const name = title ?? location?.page.label;

  if (!name) return null;

  return (
    <header className={styles.topbar}>
      <Text as="h1" variant="headline" weight="semibold" truncate className={styles.title}>
        {name}
      </Text>

      {ai && (
        <Link href="/ia" className={styles.ai} title={usageLabel(ai)}>
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
        </Link>
      )}
    </header>
  );
}
