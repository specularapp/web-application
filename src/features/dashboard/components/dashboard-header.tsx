"use client";

import styled from "@emotion/styled";
import { CalendarBlankIcon, MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CommandPalette } from "@/components/layout/command-palette";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import type { DashboardLayout } from "../layout";
import { dashboardPeriods, PERIOD_PARAM, type DashboardPeriod } from "../period-options";
import { DashboardCustomizer } from "./dashboard-customizer";

export type DashboardUser = { name: string; email: string | null; avatarUrl: string | null };

export type DashboardHeaderProps = {
  user: DashboardUser;
  greeting: string;
  period: DashboardPeriod;
  /** Ordem e visibilidade dos blocos, para a gaveta de personalizar. */
  layout: DashboardLayout;
  /** Guarda o período localmente em vez de escrever na URL do painel: é o formato da vitrine. */
  demo?: boolean;
};

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

// Cabeçalho do painel: a pessoa à esquerda e, à direita, o que ela faz todo dia. Só ícones, menos o
// de criar orçamento, que é a ação principal e leva texto. Buscar abre a mesma busca do menu; o
// período abre o menu de opções da casa com o escolhido marcado e vai para a URL, que é de onde os
// blocos do painel vão ler; a engrenagem abre a gaveta de personalizar a grade.
export function DashboardHeader({ user, greeting, period, layout, demo = false }: DashboardHeaderProps) {
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
            <DropdownMenu
              label="Período do painel"
              triggerLabel={`Período: ${dashboardPeriods.find((option) => option.value === current)?.label ?? ""}`}
              icon={<CalendarBlankIcon />}
              sections={[
                {
                  id: "periods",
                  label: "Período",
                  items: dashboardPeriods.map((option) => ({
                    id: option.value,
                    label: option.label,
                    selected: option.value === current,
                    onSelect: () => changePeriod(option.value),
                  })),
                },
              ]}
            />
            <DashboardCustomizer layout={layout} />
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
