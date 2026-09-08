"use client";

import { CaretUpDownIcon, SparkleIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
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
// à esquerda onde a página mora, no meio o nome dela e na ponta direita o quanto da IA já foi usado. A
// seção e o nome saem de `navLocation`, então página que nasce no menu ganha o topo de graça e não há um
// segundo mapa de rotas para sair de sincronia. Quando a pasta tem irmãs, a seção vira menu e pula
// direto para elas, que é o atalho que o menu lateral dá em dois toques.
export function Topbar({ title, ai }: TopbarProps) {
  const pathname = usePathname();
  const location = navLocation(pathname);

  if (!location) return null;

  const { section, icon: Glyph, page, siblings } = location;
  const name = title ?? page.label;
  const others = siblings.filter((item) => item.href !== page.href);

  return (
    <header className={styles.topbar}>
      <div className={styles.route}>
        <Glyph aria-hidden="true" className={styles.routeIcon} />
        <Text as="span" variant="subheadline" weight="medium" truncate>
          {section}
        </Text>
        {others.length > 0 && (
          <DropdownMenu
            label={`Páginas de ${section}`}
            triggerLabel={`Ir para outra página de ${section}`}
            icon={<CaretUpDownIcon />}
            sections={[
              {
                id: "siblings",
                items: siblings.map((item) => ({
                  id: item.href,
                  label: item.label,
                  icon: item.icon,
                  href: item.href,
                  selected: item.href === page.href,
                })),
              },
            ]}
          />
        )}
      </div>

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
