"use client";

import dynamic from "next/dynamic";

// O Recharts sai do pacote inicial da página, como no painel: o gráfico só desenha no cliente, e este
// invólucro é cliente porque `ssr: false` só é permitido dentro de Client Component.
export const CashflowChart = dynamic(() => import("./cashflow-chart").then((module) => module.CashflowChart), {
  ssr: false,
});
