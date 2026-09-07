"use client";

import dynamic from "next/dynamic";

// O Recharts sai do pacote inicial do painel: o gráfico só desenha depois de medir a própria caixa no
// cliente, então nunca renderiza no servidor, e carregar a lib junto com a primeira pintura era peso
// sem retorno. Este invólucro é cliente porque `ssr: false` só é permitido dentro de Client Component.
export const ProjectsChart = dynamic(() => import("./projects-chart").then((module) => module.ProjectsChart), {
  ssr: false,
});
