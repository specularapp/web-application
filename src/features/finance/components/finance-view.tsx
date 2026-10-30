"use client";

import { ListBulletsIcon, SquaresFourIcon } from "@phosphor-icons/react";
import { useState } from "react";
import type { PageToolbarView } from "@/components/layout/page-toolbar";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { saveFinanceView, type ChargesView, type FinanceViewScreen } from "../view-cookie";

const options = [
  { value: "grade", label: "Ver em cartões", icon: <SquaresFourIcon /> },
  { value: "tabela", label: "Ver em tabela", icon: <ListBulletsIcon /> },
];

/**
 * Tabela ou cartões numa lista do financeiro (2026-10-29, a pedido: "em todas as tabelas do financeiro ter como
 * ver em cards também"): a escolha nasce do cookie que a página leu, grava no mesmo cookie a cada troca e, no
 * celular, fica sempre nos cartões, que cabem na largura sem rolar de lado. Devolve o seletor pronto para a
 * barra da página.
 */
export function useFinanceView(screen: FinanceViewScreen, saved: ChargesView) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [view, setView] = useState<ChargesView>(saved);

  const toolbar: PageToolbarView = {
    value: view,
    options,
    label: "Jeito de ver a lista",
    onChange: (next) => {
      const value: ChargesView = next === "tabela" ? "tabela" : "grade";
      setView(value);
      saveFinanceView(screen, value);
    },
  };

  return { asTable: view === "tabela" && !mobile, toolbar };
}
