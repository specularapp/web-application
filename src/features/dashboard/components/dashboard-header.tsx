"use client";

import styled from "@emotion/styled";
import { CalendarBlankIcon, GearSixIcon, MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CommandPalette } from "@/components/layout/command-palette";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Listbox } from "@/components/ui/listbox";
import { dashboardPeriods, PERIOD_PARAM, type DashboardPeriod } from "../period";

export type DashboardUser = { name: string; email: string | null; avatarUrl: string | null };

export type DashboardHeaderProps = {
  user: DashboardUser;
  greeting: string;
  period: DashboardPeriod;
  /** Guarda o período localmente em vez de escrever na URL do painel: é o formato da vitrine. */
  demo?: boolean;
};

/* O seletor de período veste a roupa do botão de ícone fantasma ao lado: mesmo quadrado de 36, mesmo
   raio de metade do lado e o mesmo preenchimento no hover, para a fila de ícones ler como uma só. */
/* O botão de criar tem texto no desktop e vira só ícone no celular, por CSS e não por media query em
   JS, para a marcação não saltar na hidratação: os dois existem e cada largura mostra um. */
const Wide = styled.span`
  display: contents;

  @media (max-width: 47.9375rem) {
    display: none;
  }
`;

const Narrow = styled.span`
  display: none;

  @media (max-width: 47.9375rem) {
    display: contents;
  }
`;

const Period = styled.span`
  --listbox-trigger-height: var(--control-height-sm);
  --listbox-trigger-radius: var(--icon-button-radius-sm);
  --listbox-trigger-background: transparent;
  --listbox-trigger-background-hover: var(--color-fill-quaternary);
  --listbox-trigger-border: transparent;
  display: inline-flex;

  @media (pointer: coarse) {
    --listbox-trigger-height: max(var(--control-height-sm), var(--touch-target));
  }
`;

// Cabeçalho do painel: a pessoa à esquerda e, à direita, o que ela faz todo dia. Só ícones, menos o
// de criar orçamento, que é a ação principal e leva texto. Buscar abre a mesma busca do menu; o
// período vai para a URL, que é de onde os blocos do painel vão ler.
export function DashboardHeader({ user, greeting, period, demo = false }: DashboardHeaderProps) {
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [searchKey, setSearchKey] = useState(0);
  const [local, setLocal] = useState(period);
  const current = demo ? local : period;

  const openSearch = () => {
    setSearchKey((key) => key + 1);
    setSearching(true);
  };

  const changePeriod = (next: DashboardPeriod) => {
    if (demo) {
      setLocal(next);
      return;
    }
    router.replace(`/dashboard?${PERIOD_PARAM}=${next}`, { scroll: false });
  };

  return (
    <>
      <PageHeader
        compact
        leading={<Avatar name={user.name} src={user.avatarUrl ?? undefined} seed={user.email ?? user.name} size="md" />}
        title={user.name}
        description={greeting}
        actions={
          <>
            <IconButton label="Buscar" variant="ghost" size="sm" onClick={openSearch}>
              <MagnifyingGlassIcon />
            </IconButton>
            <Period>
              <Listbox
                label="Período"
                icon={<CalendarBlankIcon />}
                iconOnly
                options={dashboardPeriods}
                value={current}
                onChange={changePeriod}
              />
            </Period>
            <IconButton label="Personalizar painel" variant="ghost" size="sm">
              <GearSixIcon />
            </IconButton>
            <Wide>
              <Button href="/orcamentos/novo" size="sm" iconStart={<PlusIcon />}>
                Criar orçamento
              </Button>
            </Wide>
            <Narrow>
              <IconButton label="Criar orçamento" href="/orcamentos/novo" size="sm">
                <PlusIcon />
              </IconButton>
            </Narrow>
          </>
        }
      />
      <CommandPalette key={searchKey} open={searching} onClose={() => setSearching(false)} />
    </>
  );
}
