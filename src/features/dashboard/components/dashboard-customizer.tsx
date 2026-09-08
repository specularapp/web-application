"use client";

import styled from "@emotion/styled";
import { GearSixIcon, XIcon } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import type { DashboardBlockId } from "../blocks";
import { saveDashboardLayout, type DashboardLayout } from "../layout-cookie";

export type DashboardCustomizerProps = { layout: DashboardLayout };

/* A lista que arrasta entra por importação dinâmica (varredura de peso de 2026-09-08): ela carrega o
   `@dnd-kit`, quatro pacotes que somam 56 KB comprimidos, e o registro dos blocos com os oito ícones.
   No topo deste arquivo tudo isso viajava em toda carga do painel por causa de uma gaveta que nasce
   fechada. A `Dialog` não renderiza o conteúdo enquanto está fechada, então o pedaço só é buscado
   quando a engrenagem é apertada. */
const DashboardBlocksList = dynamic(() => import("./dashboard-blocks-list").then((module) => module.DashboardBlocksList));

const Drawer = styled(Dialog)`
  --panel-line: 0.0375rem;
`;

const Header = styled.header`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  border-block-end: var(--panel-line) solid var(--color-border);
`;

const Close = styled.span`
  flex-shrink: 0;
  margin-inline-start: auto;
`;

const Scroll = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: var(--space-3);
  flex: 1;
  min-height: 0;
  padding: var(--space-4) var(--space-5) var(--space-5);
  overflow-y: auto;
  overscroll-behavior: contain;
`;

// A engrenagem do cabeçalho abre a gaveta de personalizar o painel, na moldura da casa: a lista dos
// blocos na ordem da grade, cada um com a alça de arrastar para reordenar (ponteiro ou teclado) e o
// interruptor de mostrar. Cada mudança grava o cookie de preferência e refaz a árvore do servidor, que
// é quem monta a grade a partir dele, então a tela atrás se ajusta enquanto a gaveta está aberta.
export function DashboardCustomizer({ layout }: DashboardCustomizerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(layout);
  const [, startTransition] = useTransition();

  const apply = (next: DashboardLayout) => {
    setCurrent(next);
    saveDashboardLayout(next);
    startTransition(() => router.refresh());
  };

  const toggle = (id: DashboardBlockId, visible: boolean) => {
    const hidden = visible ? current.hidden.filter((entry) => entry !== id) : [...current.hidden, id];
    apply({ ...current, hidden });
  };

  return (
    <>
      <IconButton label="Personalizar painel" variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen(true)}>
        <GearSixIcon />
      </IconButton>

      <Drawer open={open} onClose={() => setOpen(false)} label="Personalizar painel" size="sm" placement="end" surface="glass" scrim={false}>
        <Header>
          <Text as="h2" variant="headline" weight="semibold">
            Personalizar painel
          </Text>
          <Close>
            <IconButton label="Fechar" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              <XIcon />
            </IconButton>
          </Close>
        </Header>

        <Scroll>
          <Text variant="footnote" tone="secondary">
            Arraste para mudar a ordem e desligue o que não quer ver. A grade se ajusta na hora.
          </Text>
          <DashboardBlocksList
            order={current.order}
            hidden={current.hidden}
            onReorder={(order) => apply({ ...current, order })}
            onToggle={toggle}
          />
        </Scroll>
      </Drawer>
    </>
  );
}
